/** The orbit-and-sparkle ornament from classic vision boards. `spin` makes the rings turn slowly. */
export function OrbitStar({ size = 34, spin = true, className = '' }: { size?: number; spin?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <g className={spin ? 'orbit-spin' : undefined} style={{ transformOrigin: '20px 20px' }}>
        <ellipse cx="20" cy="20" rx="18" ry="10.5" transform="rotate(30 20 20)" stroke="currentColor" strokeWidth="1.3" />
        <ellipse cx="20" cy="20" rx="18" ry="10.5" transform="rotate(-30 20 20)" stroke="currentColor" strokeWidth="1.3" />
      </g>
      <path d="M20 13.5c.6 4 2.5 5.9 6.5 6.5-4 .6-5.9 2.5-6.5 6.5-.6-4-2.5-5.9-6.5-6.5 4-.6 5.9-2.5 6.5-6.5Z" fill="currentColor" />
    </svg>
  );
}

/** A four-point sparkle. */
export function Sparkle({ size = 12, className = '', style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} style={style} aria-hidden>
      <path d="M10 0c.8 5.6 3.6 8.4 10 10-6.4 1.6-9.2 4.4-10 10-.8-5.6-3.6-8.4-10-10C6.4 8.4 9.2 5.6 10 0Z" fill="currentColor" />
    </svg>
  );
}
