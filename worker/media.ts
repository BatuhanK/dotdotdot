/*
 * Shared media: a file must really be the kind of media it claims to be (checked from its first bytes),
 * and is served so that it can't run as a page or be embedded by other sites.
 */

export type AssetKind = 'image' | 'video' | 'audio'

/** How many leading bytes the format checks need. */
export const SNIFF_BYTES = 16

const ascii = (b: Uint8Array, offset: number, text: string) => [...text].every((ch, i) => b[offset + i] === ch.charCodeAt(0))

const jpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
const png = (b: Uint8Array) => b[0] === 0x89 && ascii(b, 1, 'PNG')
const gif = (b: Uint8Array) => ascii(b, 0, 'GIF8')
const webp = (b: Uint8Array) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')
const bmp = (b: Uint8Array) => ascii(b, 0, 'BM')
/** MP4, MOV, M4A, 3GP, HEIC, AVIF… (ISO base media file format). */
const isoMedia = (b: Uint8Array) => ascii(b, 4, 'ftyp')
/** Older QuickTime files can start with another atom. */
const quickTime = (b: Uint8Array) => ['moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].some((atom) => ascii(b, 4, atom))
/** WebM / Matroska. */
const ebml = (b: Uint8Array) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3
const wav = (b: Uint8Array) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE')
const ogg = (b: Uint8Array) => ascii(b, 0, 'OggS')
const flac = (b: Uint8Array) => ascii(b, 0, 'fLaC')
/** MP3 (ID3 tag or MPEG frame sync), and AAC in ADTS frames. */
const mpegAudio = (b: Uint8Array) => ascii(b, 0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)

const FORMATS: Record<AssetKind, ((b: Uint8Array) => boolean)[]> = {
  image: [jpeg, png, gif, webp, bmp, isoMedia],
  video: [isoMedia, quickTime, ebml],
  audio: [mpegAudio, isoMedia, wav, ogg, flac, ebml],
}

/** True when the file's first bytes match one of the formats allowed for its kind. */
export function looksLike(kind: AssetKind, head: Uint8Array): boolean {
  return head.byteLength >= SNIFF_BYTES && FORMATS[kind].some((test) => test(head))
}

/**
 * Read the first `count` bytes of an upload, and return them with a stream of the whole upload.
 * R2 needs a streamed body's length up front, so the stream is a FixedLengthStream of `length` bytes;
 * it errors (and R2 rejects the object) if the client sends a different amount.
 */
export async function peekBody(body: ReadableStream<Uint8Array>, length: number, count: number) {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let have = 0
  while (have < count) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    have += value.byteLength
  }
  const head = new Uint8Array(Math.min(count, have))
  let offset = 0
  for (const chunk of chunks) {
    if (offset >= head.byteLength) break
    const part = chunk.subarray(0, head.byteLength - offset)
    head.set(part, offset)
    offset += part.byteLength
  }
  const replay = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
    },
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) controller.close()
      else controller.enqueue(value)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })
  const fixed = new FixedLengthStream(length)
  let incomplete = false
  const piped = replay.pipeTo(fixed.writable).catch(() => {
    incomplete = true
  })
  return {
    head,
    body: fixed.readable,
    /** Resolves once the upload has been read; true if it ended early or had the wrong length. */
    failed: async () => {
      await piped
      return incomplete
    },
  }
}

/** Headers for serving a stored file. The preview image may be embedded anywhere (link previews); other media only by this site. */
export function mediaHeaders(obj: R2Object, preview: boolean): Headers {
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('accept-ranges', 'bytes')
  // Media ids never change content; the preview image is replaced on every update.
  headers.set('cache-control', preview ? 'public, max-age=300' : 'public, max-age=86400')
  headers.set('x-content-type-options', 'nosniff')
  // Opened directly, an uploaded file must never run as a page on this origin.
  headers.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
  headers.set('cross-origin-resource-policy', preview ? 'cross-origin' : 'same-origin')
  if (!preview) headers.set('x-robots-tag', 'noindex')
  return headers
}

/** The Content-Range of a partial response, or null when the whole file is sent. */
export function contentRange(obj: R2ObjectBody, rangeRequested: boolean): string | null {
  // The runtime fills in every field of the range, unset ones as undefined.
  const range = obj.range as { offset?: number; length?: number; suffix?: number } | undefined
  if (!rangeRequested || !range) return null
  const suffix = typeof range.suffix === 'number' ? range.suffix : undefined
  const start = suffix !== undefined ? obj.size - suffix : (range.offset ?? 0)
  const length = suffix ?? range.length ?? obj.size - start
  if (start === 0 && length >= obj.size) return null
  return `bytes ${start}-${start + length - 1}/${obj.size}`
}
