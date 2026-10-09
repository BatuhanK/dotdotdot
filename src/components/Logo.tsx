import { useId } from 'react'

export const BRAND = 'dotdotdot'

const DOT_OPACITY = [1, 0.55, 0.25]

/** The app icon: an iMessage typing bubble on a honey squircle. `animated` pulses the dots like someone is typing. */
export function LogoMark({ className = '', animated = false }: { className?: string; animated?: boolean }) {
  const id = useId()
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD84D" />
          <stop offset="1" stopColor="#FFAE00" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill={`url(#${id})`} />
      <g fill="#fff">
        <rect x="76" y="132" width="360" height="200" rx="100" />
        <circle cx="120" cy="328" r="36" />
        <circle cx="74" cy="386" r="17" />
      </g>
      <g fill="#1A1200">
        {[172, 256, 340].map((cx, i) => (
          <circle
            key={cx}
            cx={cx}
            cy={232}
            r={30}
            className={animated ? 'logo-dot' : undefined}
            style={animated ? { animationDelay: `${i * 0.18}s` } : { opacity: DOT_OPACITY[i] }}
          />
        ))}
      </g>
    </svg>
  )
}

/** Icon + wordmark. The three "dot"s fade like the typing dots. */
export function Logo({ className = '', markClassName = 'h-8 w-8', animated = false }: { className?: string; markClassName?: string; animated?: boolean }) {
  return (
    <span className={`flex items-center gap-2 font-rounded font-extrabold tracking-tight ${className}`}>
      <LogoMark className={`shrink-0 ${markClassName}`} animated={animated} />
      <span>
        dot<span className="opacity-60">dot</span>
        <span className="opacity-35">dot</span>
      </span>
    </span>
  )
}
