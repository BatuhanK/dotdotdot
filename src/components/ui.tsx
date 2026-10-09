import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export function Section({
  title,
  emoji,
  children,
  defaultOpen = true,
  right,
}: {
  title: string
  emoji?: string
  children: ReactNode
  defaultOpen?: boolean
  right?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-ink/[0.06] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[15px] font-extrabold text-ink"
      >
        <span className="flex items-center gap-2">
          {emoji && <span className="text-base">{emoji}</span>}
          {title}
        </span>
        <span className="flex items-center gap-2">
          {right}
          <ChevronDown className={`h-4 w-4 text-ink/35 transition-transform ${open ? '' : '-rotate-90'}`} />
        </span>
      </button>
      {open && <div className="space-y-3.5 px-4 pb-5">{children}</div>}
    </section>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-ink/55">
        <span>{label}</span>
        {hint && <span className="text-[10px] font-medium text-ink/35">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

export const inputCls =
  'w-full rounded-xl border border-ink/10 bg-cream px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-honey focus:bg-white focus:ring-3 focus:ring-honey/25'

export function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <input
      type="text"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      className={`${inputCls} ${props.className ?? ''}`}
    />
  )
}

export function NumberInput(props: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      value={props.value}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      onChange={(e) => {
        const v = parseFloat(e.target.value)
        if (!Number.isNaN(v)) props.onChange(v)
      }}
      className={inputCls}
    />
  )
}

export function Select<T extends string | number>(props: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="relative">
      <select
        value={String(props.value)}
        onChange={(e) => {
          const opt = props.options.find((o) => String(o.value) === e.target.value)
          if (opt) props.onChange(opt.value)
        }}
        className={`${inputCls} appearance-none pr-8`}
      >
        {props.options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
    </div>
  )
}

export function Segmented<T extends string | number>(props: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[] }) {
  return (
    <div className="flex rounded-2xl bg-ink/[0.05] p-1">
      {props.options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => props.onChange(o.value)}
          className={`flex-1 rounded-xl px-2 py-1.5 text-xs font-bold transition ${
            props.value === o.value ? 'bg-white text-ink shadow-[0_2px_6px_-2px_rgba(60,40,0,0.25)]' : 'text-ink/45 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-0.5 text-left text-sm font-semibold text-ink"
    >
      <span>{label}</span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? 'bg-honey' : 'bg-ink/15'}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

export function Slider(props: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  format?: (v: number) => string
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex justify-between text-xs font-semibold text-ink/55">
        <span>{props.label}</span>
        <span className="text-ink tabular-nums">{props.format ? props.format(props.value) : props.value}</span>
      </label>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 0.01}
        value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
        className="sweet-range w-full"
        style={rangeFill(props.value, props.min, props.max)}
      />
    </div>
  )
}

/** Inline style that colors a .sweet-range up to its value. */
export function rangeFill(value: number, min: number, max: number): CSSProperties {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return { ['--fill' as string]: `${Math.max(0, Math.min(100, pct))}%` }
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-ink/10 bg-cream px-2 py-1.5">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-6 cursor-pointer rounded-md border-0 bg-transparent p-0" />
      <span className="font-mono text-xs text-ink/70">{value.toUpperCase()}</span>
    </label>
  )
}

export function FileButton({ accept, onFile, children, className }: { accept: string; onFile: (f: File) => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={
          className ??
          'flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/15 bg-cream px-3 py-2 text-xs font-semibold text-ink/60 transition hover:border-honey hover:bg-butter/50 hover:text-ink'
        }
      >
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </>
  )
}

export function IconButton({
  onClick,
  title,
  children,
  disabled,
  active,
}: {
  onClick: () => void
  title: string
  children: ReactNode
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-xl transition disabled:opacity-30 ${
        active ? 'bg-sun/50 text-ink' : 'text-ink/50 hover:bg-ink/[0.06] hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
