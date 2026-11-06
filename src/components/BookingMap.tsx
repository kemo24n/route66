"use client";
import { useState, type ReactNode } from "react";
import type { MapTable } from "./FloorMap";

type BT = MapTable & { state: "free" | "busy" | "small" | "closed"; fit: boolean };
const FONT = "'IBM Plex Sans Arabic',sans-serif";
const K = 0.62, CX = 0.866 * K, CY = 0.5 * K;
const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * CX, (x + y) * CY - z * K];
const pts = (a: number[][]) => a.map(([x, y, z = 0]) => P(x, y, z).join(",")).join(" ");

function Box({ x, y, w, d, h, top, left, right, z0 = 0 }: { x: number; y: number; w: number; d: number; h: number; top: string; left: string; right: string; z0?: number }) {
  const z1 = z0 + h;
  return (<g>
    <polygon points={pts([[x, y + d, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x, y + d, z1]])} fill={left} />
    <polygon points={pts([[x + w, y, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x + w, y, z1]])} fill={right} />
    <polygon points={pts([[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]])} fill={top} />
  </g>);
}
function Cyl({ cx, cy, r, h, top, side, z0 = 0 }: { cx: number; cy: number; r: number; h: number; top: string; side: string; z0?: number }) {
  const [sx, sy] = P(cx, cy, z0), rx = 1.2247 * r * K, ry = 0.7071 * r * K, hh = h * K;
  return (<g>
    <ellipse cx={sx} cy={sy} rx={rx} ry={ry} fill={side} />
    <rect x={sx - rx} y={sy - hh} width={rx * 2} height={hh} fill={side} />
    <ellipse cx={sx} cy={sy - hh} rx={rx} ry={ry} fill={top} />
    <ellipse cx={sx} cy={sy - hh} rx={rx * 0.82} ry={ry * 0.82} fill="none" stroke="#fff" strokeOpacity=".22" />
  </g>);
}
const Chair = ({ x, y, back }: { x: number; y: number; back: "n" | "s" }) => (<g>
  {back === "n" && <Box x={x - 11} y={y - 13} w={22} d={4} h={34} top="#6a4a2a" left="#2a1c10" right="#1d130a" />}
  <Box x={x - 11} y={y - 11} w={22} d={22} h={17} top="#7a5632" left="#3a2815" right="#2a1c10" />
  {back === "s" && <Box x={x - 11} y={y + 9} w={22} d={4} h={34} top="#6a4a2a" left="#2a1c10" right="#1d130a" />}
</g>);
function Plant({ x, y }: { x: number; y: number }) {
  const [sx, sy] = P(x, y);
  return (<g>
    <Cyl cx={x} cy={y} r={13} h={16} top="#5b3a22" side="#3d2616" />
    {[[0, -34, 17], [-11, -26, 13], [11, -26, 13], [0, -48, 12]].map(([dx, dy, r], i) => <ellipse key={i} cx={sx + dx} cy={sy + dy} rx={r} ry={r * 0.9} fill={i % 2 ? "#2f8a42" : "#43a857"} />)}
  </g>);
}

export function BookingMap({ tables, selectedId, onSelect }: {
  width?: number; height?: number; tables: BT[]; selectedId: string | null; onSelect: (t: MapTable) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const hov = tables.find((t) => t.id === hover);
  const label = (t: BT) => t.state === "free" ? "متاحة" : t.state === "busy" ? "محجوزة" : t.state === "small" ? "صغيرة" : "مسكّرة";
  const room = [[60, 30], [60, 90], [80, 400], [100, 450], [900, 460], [900, 30]];
  const items: { d: number; n: ReactNode }[] = [];
  items.push({ d: 70 + 90, n: <g key="counter"><Box x={100} y={44} w={300} d={34} h={42} top="#4a2f18" left="#2b1a0e" right="#1c1109" /><Box x={100} y={44} w={300} d={34} h={4} z0={42} top="#d9b27a" left="#b98f55" right="#9b7340" /></g> });
  [[88, 420], [75, 60], [40, 540], [640, 540], [920, 530], [40, 1020]].forEach(([x, y], i) => items.push({ d: x + y, n: <Plant key={`p${i}`} x={x} y={y} /> }));

  tables.forEach((t, i) => {
    const sel = selectedId === t.id, free = t.state === "free", busy = t.state === "busy";
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2, H = 30;
    const top = sel ? "#ffd978" : busy ? "#d2412f" : free ? "#cf9757" : "#5b5b55";
    const left = sel ? "#c98d1d" : busy ? "#8a2218" : free ? "#8a5a2b" : "#3a3a36";
    const right = sel ? "#a06f10" : busy ? "#6b1a12" : free ? "#6e4620" : "#2c2c29";
    const nTop = Math.ceil(t.seats / 2), nBot = t.seats - nTop;
    const row = (n: number, yy: number, back: "n" | "s") => Array.from({ length: n }, (_, k) => <Chair key={back + k} x={t.x + (t.w * (k + 1)) / (n + 1)} y={yy} back={back} />);
    const [gx, gy] = P(cx, cy, 0), [lx, ly] = P(cx, cy, H + 26);
    items.push({
      d: cx + cy, n: (
        <g key={t.id} className={`r66t ${free ? "free" : ""} ${sel ? "sel" : ""}`} style={{ animationDelay: `${0.3 + i * 0.07}s`, cursor: free ? "pointer" : "not-allowed" }}
          onClick={() => onSelect(t)} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)}>
          <ellipse cx={gx} cy={gy + 6} rx={t.w * 0.78 * CX * 1.6} ry={t.h * 0.7 * CY * 1.5} fill="#000" opacity=".45" style={{ filter: "blur(7px)" }} />
          {(free || busy || sel) && <ellipse className="r66aura" cx={gx} cy={gy + 2} rx={t.w * 0.95 * CX * 1.5} ry={t.h * 0.9 * CY * 1.5} fill={sel || t.fit ? "#F2C14E" : busy ? "#ff3b30" : "#4fd172"} opacity=".4" style={{ filter: "blur(13px)" }} />}
          {row(nTop, t.y - 18, "n")}
          {t.shape === "ROUND" ? <Cyl cx={cx} cy={cy} r={t.w / 2} h={H} top={top} side={left} /> : <Box x={t.x} y={t.y} w={t.w} d={t.h} h={H} top={top} left={left} right={right} />}
          {row(nBot, t.y + t.h + 18, "s")}
          <g transform={`translate(${lx} ${ly})`}>
            <rect x={-24} y={-17} width={48} height={32} rx={11} fill="#0c130e" stroke={sel ? "#F2C14E" : free ? "#4fd172" : busy ? "#ff6b5e" : "#555"} strokeWidth="2" />
            <text y={6} textAnchor="middle" fontSize="20" fontWeight="800" fill={sel ? "#F2C14E" : free ? "#fff" : busy ? "#ff9a90" : "#999"} fontFamily={FONT}>{t.label}</text>
            {busy && <text y={30} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" stroke="#000" strokeWidth="3" paintOrder="stroke" fontFamily={FONT}>🔒 محجوزة</text>}
            {t.fit && free && !sel && <g transform="translate(26 -18)"><circle r="12" fill="#F2C14E" stroke="#0c130e" strokeWidth="2" /><text y="5" textAnchor="middle" fontSize="13" fill="#0c130e">★</text></g>}
          </g>
          {sel && <ellipse className="r66ring" cx={gx} cy={gy} rx={t.w * CX * 1.4} ry={t.h * CY * 1.3} fill="none" stroke="#F2C14E" strokeWidth="3" />}
        </g>
      ),
    });
  });
  items.sort((a, b) => a.d - b.d);
  const [hx, hy] = hov ? P(hov.x + hov.w / 2, hov.y + hov.h / 2, 110) : [0, 0];

  return (
    <svg viewBox="-600 -80 1130 730" className="h-auto w-full select-none" style={{ direction: "ltr" }}>
      <style>{`
        @keyframes r66in{from{opacity:0;transform:translateY(-40px)}to{opacity:1;transform:none}}
        @keyframes r66ring{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.5);opacity:0}}
        @keyframes r66glow{0%,100%{opacity:.25}50%{opacity:.6}}
        @keyframes r66dash{to{stroke-dashoffset:-40}}
        @keyframes r66sun{0%,100%{opacity:.18}50%{opacity:.38}}
        .r66t{animation:r66in .7s cubic-bezier(.2,.9,.3,1.2) both;transition:transform .3s cubic-bezier(.2,.9,.3,1.4)}
        .r66t.free:hover{transform:translateY(-9px)}
        .r66t.sel{transform:translateY(-12px)}
        .r66ring{transform-box:fill-box;transform-origin:center;animation:r66ring 1.7s ease-out infinite}
        .r66aura{animation:r66glow 2.4s ease-in-out infinite}
        .r66path{animation:r66dash 1.4s linear infinite}
        .r66sun{animation:r66sun 6s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){*{animation:none!important}}
      `}</style>
      <defs>
        <filter id="r66blur"><feGaussianBlur stdDeviation="14" /></filter><clipPath id="r66room"><polygon points={pts(room)} /></clipPath>
        <clipPath id="r66ter"><polygon points={pts([[20, 490], [940, 490], [940, 1060], [20, 1060]])} /></clipPath>
        <linearGradient id="r66glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d4efff" /><stop offset="1" stopColor="#7fb8e0" /></linearGradient>
        <linearGradient id="r66light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3c4" stopOpacity=".5" /><stop offset="1" stopColor="#fff3c4" stopOpacity="0" /></linearGradient>
        <radialGradient id="r66vig" cx="50%" cy="48%" r="70%"><stop offset=".6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".65" /></radialGradient>
      </defs>
      <rect x={-600} y={-80} width={1130} height={730} fill="#080e0a" />
      {/* terrace stone */}
      <g clipPath="url(#r66ter)">
        <polygon points={pts([[20, 490], [940, 490], [940, 1060], [20, 1060]])} fill="#3b4740" />
        {Array.from({ length: 14 }, (_, i) => <polyline key={"a" + i} points={pts([[20 + i * 70, 490], [20 + i * 70, 1060]])} stroke="#1f2924" strokeWidth="2" fill="none" />)}
        {Array.from({ length: 9 }, (_, i) => <polyline key={"b" + i} points={pts([[20, 490 + i * 70], [940, 490 + i * 70]])} stroke="#1f2924" strokeWidth="2" fill="none" />)}
      </g>
      <polygon points={pts([[20, 1060], [940, 1060], [940, 1060, -14], [20, 1060, -14]])} fill="#1f2924" />
      {/* wood floor */}
      <polygon points={pts(room)} fill="#7a5230" />
      <g clipPath="url(#r66room)">
        {Array.from({ length: 21 }, (_, i) => <polyline key={i} points={pts([[40, 30 + i * 22], [920, 30 + i * 22]])} stroke={i % 2 ? "#4a2e16" : "#946a40"} strokeOpacity=".6" strokeWidth="1.4" fill="none" />)}
        <polygon className="r66sun" filter="url(#r66blur)" points={pts([[300, 30], [800, 30], [900, 400], [450, 400]])} fill="url(#r66light)" />
      </g>
      {/* back walls (tall) */}
      <polygon points={pts([[60, 30, 0], [900, 30, 0], [900, 30, 120], [60, 30, 120]])} fill="#d8cdb6" />
      <polygon points={pts([[480, 30, 28], [820, 30, 28], [820, 30, 100], [480, 30, 100]])} fill="url(#r66glass)" />
      {[480, 593, 706, 820].map((x) => <polyline key={x} points={pts([[x, 30, 28], [x, 30, 100]])} stroke="#f4ecda" strokeWidth="4" />)}
      <polygon points={pts([[60, 30, 0], [60, 90, 0], [60, 90, 120], [60, 30, 120]])} fill="#b9ae96" />
      <polygon points={pts([[60, 90, 0], [80, 400, 0], [80, 400, 120], [60, 90, 120]])} fill="#b9ae96" />
      <polygon points={pts([[80, 400, 0], [100, 450, 0], [100, 450, 120], [80, 400, 120]])} fill="#a89d85" />
      <polyline points={pts([[60, 30, 120], [900, 30, 120]])} stroke="#fff" strokeOpacity=".5" strokeWidth="3" />
      {/* low front walls with the entrance gap */}
      <polygon points={pts([[100, 450, 0], [400, 450, 0], [400, 450, 16], [100, 450, 16]])} fill="#cfc4ac" />
      <polygon points={pts([[520, 450, 0], [900, 460, 0], [900, 460, 16], [520, 450, 16]])} fill="#cfc4ac" />
      <polygon points={pts([[900, 30, 0], [900, 460, 0], [900, 460, 16], [900, 30, 16]])} fill="#a89d85" />
      <path className="r66path" d="M 0 0" />
      <polyline className="r66path" points={pts([[460, 560], [460, 470], [460, 380]])} stroke="#F2C14E" strokeOpacity=".7" strokeWidth="3" strokeDasharray="8 12" fill="none" strokeLinecap="round" />
      <text x={P(460, 510)[0]} y={P(460, 510)[1] + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#F2C14E" fontFamily={FONT}>⬆ المدخل</text>
      {items.map((i) => i.n)}
      <rect x={-600} y={-80} width={1130} height={730} fill="url(#r66vig)" pointerEvents="none" />
      {hov && (
        <g transform={`translate(${Math.min(Math.max(hx, -440), 380)} ${hy - 30})`} pointerEvents="none">
          <rect x={-115} y={-22} width={230} height={38} rx={19} fill="#0c130e" stroke="#F2C14E" strokeOpacity=".8" />
          <text textAnchor="middle" y={4} fontSize="14" fill="#fff" fontFamily={FONT}>طاولة {hov.label} · {hov.seats} أشخاص · {label(hov)}</text>
        </g>
      )}
    </svg>
  );
}
