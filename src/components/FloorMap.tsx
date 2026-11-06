"use client";

export type MapTable = {
  id: string; label: string; seats: number; shape: "ROUND" | "RECT"; x: number; y: number; w: number; h: number; rotation: number; zoneId: string;
};

export type TableLook = { fill: string; stroke: string; text?: string; badge?: string; badgeColor?: string; pulse?: boolean; dim?: boolean; sub?: string };

/** chairs drawn around a table so customers can read the layout at a glance */
function chairs(t: MapTable) {
  const out: { x: number; y: number }[] = [];
  const n = t.seats;
  if (t.shape === "ROUND") {
    const r = Math.max(t.w, t.h) / 2 + 13;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      out.push({ x: t.w / 2 + Math.cos(a) * r, y: t.h / 2 + Math.sin(a) * r });
    }
    return out;
  }
  const long = t.w >= t.h;
  if (n <= 2) {
    const ends = long ? [{ x: -13, y: t.h / 2 }, { x: t.w + 13, y: t.h / 2 }] : [{ x: t.w / 2, y: -13 }, { x: t.w / 2, y: t.h + 13 }];
    return ends.slice(0, n);
  }
  // split the chairs along the two long sides
  const sideA = Math.ceil(n / 2);
  const sideB = n - sideA;
  const place = (count: number, near: boolean) => {
    for (let i = 0; i < count; i++) {
      const f = (i + 1) / (count + 1);
      if (long) out.push({ x: t.w * f, y: near ? -13 : t.h + 13 });
      else out.push({ x: near ? -13 : t.w + 13, y: t.h * f });
    }
  };
  place(sideA, true);
  place(sideB, false);
  return out;
}

export function FloorMap({
  width, height, tables, look, onSelect, selectedId, decor = true, className = "",
}: {
  width: number; height: number; tables: MapTable[]; look: (t: MapTable) => TableLook; onSelect?: (t: MapTable) => void;
  selectedId?: string | null; decor?: boolean; className?: string;
}) {
  return (
    <svg viewBox={`-30 -30 ${width + 60} ${height + 60}`} className={`h-auto w-full select-none ${className}`} style={{ direction: "ltr" }}>
      <defs>
        <pattern id="floorgrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x={-30} y={-30} width={width + 60} height={height + 60} rx={24} fill="#101a12" />
      <rect x={0} y={0} width={width} height={height} rx={16} fill="url(#floorgrid)" stroke="rgba(255,255,255,0.08)" />
      {decor && <text x={width - 12} y={height - 12} textAnchor="end" fontSize="13" fill="rgba(255,255,255,0.18)" fontFamily="sans-serif">ROUTE 66</text>}
      {tables.map((t) => {
        const l = look(t);
        const sel = selectedId === t.id;
        const clickable = !!onSelect && !l.dim;
        return (
          <g key={t.id} transform={`translate(${t.x} ${t.y}) rotate(${t.rotation} ${t.w / 2} ${t.h / 2})`}
            onClick={() => onSelect && onSelect(t)} style={{ cursor: onSelect ? (clickable ? "pointer" : "not-allowed") : "default" }} opacity={l.dim ? 0.38 : 1}>
            {chairs(t).map((c, i) => (
              <circle key={i} cx={c.x} cy={c.y} r={8} fill={sel ? "#F2C14E" : "#2a3a2d"} stroke="rgba(255,255,255,0.12)" />
            ))}
            {l.pulse && (
              t.shape === "ROUND"
                ? <circle cx={t.w / 2} cy={t.h / 2} r={Math.max(t.w, t.h) / 2 + 6} fill="none" stroke={l.badgeColor || "#F2C14E"} strokeWidth="3"><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" /></circle>
                : <rect x={-6} y={-6} width={t.w + 12} height={t.h + 12} rx={16} fill="none" stroke={l.badgeColor || "#F2C14E"} strokeWidth="3"><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" /></rect>
            )}
            {t.shape === "ROUND"
              ? <ellipse cx={t.w / 2} cy={t.h / 2} rx={t.w / 2} ry={t.h / 2} fill={l.fill} stroke={sel ? "#F2C14E" : l.stroke} strokeWidth={sel ? 4 : 2} />
              : <rect width={t.w} height={t.h} rx={12} fill={l.fill} stroke={sel ? "#F2C14E" : l.stroke} strokeWidth={sel ? 4 : 2} />}
            <g transform={`rotate(${-t.rotation} ${t.w / 2} ${t.h / 2})`}>
              <text x={t.w / 2} y={t.h / 2 + (l.sub ? -2 : 6)} textAnchor="middle" fontSize="20" fontWeight="700" fill={l.text || "#fff"} fontFamily="'IBM Plex Sans Arabic', sans-serif">{t.label}</text>
              <text x={t.w / 2} y={t.h / 2 + (l.sub ? 15 : 22)} textAnchor="middle" fontSize="11" fill={l.text || "#fff"} opacity="0.7" fontFamily="'IBM Plex Sans Arabic', sans-serif">{l.sub ?? `${t.seats} أشخاص`}</text>
            </g>
            {l.badge && (
              <g transform={`translate(${t.w - 4} ${-4})`}>
                <circle r="13" fill={l.badgeColor || "#F2C14E"} />
                <text y="4.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0c130e">{l.badge}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
