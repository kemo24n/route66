/** road-sign graphics drawn in code, used across the customer site */

/** US-highway style shield with a number in it */
export function Shield({ n, className = "", fill = "#F3ECDD", stroke = "#15170F", text = "#15170F" }: { n: string | number; className?: string; fill?: string; stroke?: string; text?: string }) {
  return (
    <svg viewBox="0 0 64 70" className={className} aria-hidden>
      <path d="M6 6 C14 9 22 9 32 4 C42 9 50 9 58 6 C61 22 61 32 57 44 C52 57 42 63 32 67 C22 63 12 57 7 44 C3 32 3 22 6 6Z" fill={fill} stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M8 18 H56" stroke={stroke} strokeWidth="2.5" />
      <text x="32" y="15" textAnchor="middle" fontSize="7.5" fontWeight="900" fontFamily="Overpass, sans-serif" fill={text} letterSpacing="1">ROUTE</text>
      <text x="32" y="48" textAnchor="middle" fontSize={String(n).length > 2 ? 18 : 25} fontWeight="900" fontFamily="Overpass, sans-serif" fill={text}>{n}</text>
    </svg>
  );
}

/** small directional arrow, points left in RTL reading order */
export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function Bell({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="20" y="6" width="8" height="5" rx="2.5" fill="currentColor" />
      <path d="M8 36c0-10 7-20 16-20s16 10 16 20z" fill="currentColor" />
      <rect x="4" y="36" width="40" height="5" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export function Receipt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z" />
      <path d="M9 8h6M9 12h6" strokeLinecap="round" />
    </svg>
  );
}

/** tiny car used as the progress marker on the booking route */
export function Car({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" className={className} aria-hidden>
      <path d="M6 22 L9 14 Q11 9 17 9 H38 Q43 9 47 13 L52 17 H57 Q61 17 61 21 V24 H6Z" fill="#D9381E" stroke="#15170F" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M18 12 H30 V17 H14 Z M33 12 H38 Q41 12 44 15 L45 17 H33Z" fill="#F3ECDD" stroke="#15170F" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="17" cy="24" r="5" fill="#15170F" /><circle cx="17" cy="24" r="2" fill="#F3ECDD" />
      <circle cx="49" cy="24" r="5" fill="#15170F" /><circle cx="49" cy="24" r="2" fill="#F3ECDD" />
      <rect x="57" y="18" width="4" height="3" rx="1" fill="#F5C518" />
    </svg>
  );
}
