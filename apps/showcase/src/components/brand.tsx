const DROPLET = 'M32 4 C 46 22 52 30 52 40 A 20 20 0 1 1 12 40 C 12 30 18 22 32 4 Z'

/**
 * The "aurora droplet" brand mark — the same glyph the showcase uses as its
 * favicon and nav logo (cyan → violet → pink, chromatic-aberration rim). Kept
 * pixel-for-pixel identical so the registry and showcase share one identity.
 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ display: 'block' }}
    >
      <defs>
        <clipPath id="lg-clip">
          <path d={DROPLET} />
        </clipPath>
        <linearGradient id="lg-aur" x1=".28" y1=".05" x2=".72" y2=".95">
          <stop stopColor="#5ad8ff" />
          <stop offset=".5" stopColor="#8b6bff" />
          <stop offset="1" stopColor="#ff4f9d" />
        </linearGradient>
        <radialGradient id="lg-depth" cx=".5" cy=".44" r=".6">
          <stop offset=".5" stopColor="#05060f" stopOpacity="0" />
          <stop offset="1" stopColor="#05060f" stopOpacity=".5" />
        </radialGradient>
        <radialGradient id="lg-spec" cx=".5" cy=".5" r=".5">
          <stop stopColor="#fff" stopOpacity="1" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lg-caustic" cx=".5" cy=".5" r=".5">
          <stop stopColor="#fff" stopOpacity=".92" />
          <stop offset=".6" stopColor="#ffe6f4" stopOpacity=".35" />
          <stop offset="1" stopColor="#ffd9f2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lg-rim" x1=".2" y1="0" x2=".8" y2="1">
          <stop stopColor="#fff" stopOpacity=".95" />
          <stop offset=".42" stopColor="#fff" stopOpacity=".1" />
          <stop offset="1" stopColor="#fff" stopOpacity=".4" />
        </linearGradient>
      </defs>
      <g clipPath="url(#lg-clip)">
        <path d={DROPLET} fill="url(#lg-aur)" />
        <rect width="64" height="64" fill="url(#lg-depth)" />
        <ellipse cx="33" cy="49.5" rx="13" ry="7" fill="url(#lg-caustic)" />
        <ellipse cx="23.5" cy="30" rx="7" ry="12" fill="url(#lg-spec)" transform="rotate(-22 23.5 30)" />
        <path
          d="M31 7 C 22 18 16 26 14.5 35"
          fill="none"
          stroke="#fff"
          strokeOpacity=".7"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="26" cy="20.5" r="2.6" fill="#fff" />
      </g>
      <path d={DROPLET} fill="none" stroke="#5ad8ff" strokeWidth="1.4" opacity=".5" transform="translate(-.5 -.5)" />
      <path d={DROPLET} fill="none" stroke="#ff4f9d" strokeWidth="1.4" opacity=".5" transform="translate(.5 .5)" />
      <path d={DROPLET} fill="none" stroke="url(#lg-rim)" strokeWidth="1.5" />
    </svg>
  )
}
