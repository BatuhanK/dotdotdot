# Security

## Reporting a vulnerability

Please don't open a public issue for security problems. Report them privately:
**[Report a vulnerability](https://github.com/BatuhanK/dotdotdot/security/advisories/new)** (Security tab → Report a vulnerability).

Say what you found, how to reproduce it and what an attacker could do with it. You'll get a reply within a few days.

## Reporting a shared story

Shared stories (`https://dotdotdot.batuhan.org/s/…`) are made by users. To report one that is illegal or abusive,
use the same private form and include the link. It will be taken down.

## How sharing is protected

- **No accounts.** Publishing returns a random share id and a 192-bit edit token. The server stores only the token's
  SHA-256 and compares it in constant time. The token never leaves the creator's browser otherwise.
- **Validated projects.** A shared project is checked and normalized before it is stored
  ([`src/lib/project-schema.ts`](src/lib/project-schema.ts)), and again in the app before it is rendered. Unknown fields
  are dropped, enums are whitelisted, numbers and durations are clamped.
- **Media only.** Uploads must be photos, videos or sounds: the declared type is whitelisted (no SVG) and the file's
  first bytes must match a known format. Media is served with `Content-Security-Policy: sandbox`,
  `X-Content-Type-Options: nosniff` and `Cross-Origin-Resource-Policy: same-origin`, so a file can't run as a page on the
  site or be embedded by other sites. Shared pages and media are `noindex`.
- **Limits.** Per IP (per /64 for IPv6): a per-minute rate limit and a daily budget for new shares and uploaded bytes
  ([`wrangler.jsonc`](wrangler.jsonc), [`worker/limits.ts`](worker/limits.ts)).
- **Strict pages.** The app is served with a Content Security Policy and related headers
  ([`worker/http.ts`](worker/http.ts)).
