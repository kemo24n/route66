"use client";
import { useState } from "react";
import type { MapTable } from "./FloorMap";

type BT = MapTable & { state: "free" | "busy" | "small" | "closed"; fit: boolean };

function chairs(t: MapTable) {
  const top = Math.ceil(t.seats / 2), bot = t.seats - top;
  const row = (n: number, y: number) => Array.from({ length: n }, (_, i) => ({ x: (t.w * (i + 1)) / (n + 1), y }));
  return [...row(top, -12), ...row(bot, t.h + 12)];
}

export function BookingMap({ width, height, tables, selectedId, onSelect }: {
  width: number; height: number; tables: BT[]; selectedId: string | null; onSelect: (t: MapTable) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const hov = tables.find((t) => t.id === hover);
  const label = (t: BT) => t.state === "free" ? "متاحة" : t.state === "busy" ? "محجوزة" : t.state === "small" ? `${t.seats} بس` : "مسكّرة";
  return (
    <svg viewBox={`-20 -20 ${width + 40} ${height + 40}`} className="h-auto w-full select-none" style={{ direction: "ltr" }}>
      <style>{`
        @keyframes r66in{from{opacity:0;transform:translateY(24px) scale(.6)}to{opacity:1;transform:none}}
        @keyframes r66draw{to{stroke-dashoffset:0}}
        @keyframes r66ring{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.5);opacity:0}}
        @keyframes r66glow{0%,100%{filter:drop-shadow(0 0 4px #F2C14E)}50%{filter:drop-shadow(0 0 16px #F2C14E)}}
        @keyframes r66dash{to{stroke-dashoffset:-40}}
        .r66t{transform-box:fill-box;transform-origin:center;animation:r66in .6s cubic-bezier(.2,.9,.3,1.3) both;transition:transform .25s}
        .r66t.free:hover{transform:translateY(-6px) scale(1.08)}
        .r66fit{animation:r66glow 2s ease-in-out infinite}
        .r66ring{transform-box:fill-box;transform-origin:center;animation:r66ring 1.6s ease-out infinite}
        .r66wall{stroke-dasharray:3000;stroke-dashoffset:3000;animation:r66draw 2.2s ease forwards}
        .r66path{animation:r66dash 1.4s linear infinite}
        @media (prefers-reduced-motion:reduce){.r66t,.r66fit,.r66ring,.r66wall,.r66path{animation:none!important;stroke-dashoffset:0}}
      `}</style>
      <defs>
        <radialGradient id="r66bg" cx="50%" cy="30%" r="80%"><stop offset="0" stopColor="#1b2b1f" /><stop offset="1" stopColor="#0a110c" /></radialGradient>
        <linearGradient id="r66free" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3f8f50" /><stop offset="1" stopColor="#1d4a25" /></linearGradient>
        <linearGradient id="r66sel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd978" /><stop offset="1" stopColor="#d9962b" /></linearGradient>
        <pattern id="r66hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#2a1717" /><line x1="0" y1="0" x2="0" y2="8" stroke="#7a3434" strokeWidth="3" /></pattern>
      </defs>
      <rect x={-20} y={-20} width={width + 40} height={height + 40} rx={28} fill="url(#r66bg)" />
      {/* room walls from the sketch */}
      <path className="r66wall" d="M 60 30 L 60 90 L 80 400 L 100 450 L 400 450 M 520 450 L 900 460 L 900 30" fill="none" stroke="#F2C14E" strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 400 450 L 520 450" stroke="#4f9a5e" strokeWidth="5" strokeDasharray="6 8" />
      <text x={460} y={490} textAnchor="middle" fontSize="16" fill="#F2C14E" fontFamily="'IBM Plex Sans Arabic',sans-serif">المدخل</text>
      <path className="r66path" d="M 460 520 L 460 450 L 460 300" stroke="#F2C14E" strokeOpacity=".5" strokeWidth="3" strokeDasharray="8 12" fill="none" />
      <text x={width - 16} y={height - 6} textAnchor="end" fontSize="14" fill="rgba(255,255,255,.15)" fontFamily="sans-serif">ROUTE 66</text>
      {tables.map((t, i) => {
        const sel = selectedId === t.id, free = t.state === "free";
        return (
          <g key={t.id} transform={`translate(${t.x} ${t.y})`}>
            <g className={`r66t ${free ? "free" : ""} ${t.fit && !sel ? "r66fit" : ""}`} style={{ animationDelay: `${0.3 + i * 0.07}s`, cursor: free ? "pointer" : "not-allowed" }}
              onClick={() => onSelect(t)} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)} opacity={free ? 1 : 0.8}>
              {chairs(t).map((c, k) => <rect key={k} x={c.x - 9} y={c.y - 5} width={18} height={10} rx={5} fill={sel ? "#F2C14E" : free ? "#4f9a5e" : "#3a2a2a"} />)}
              {sel && <rect className="r66ring" x={-4} y={-4} width={t.w + 8} height={t.h + 8} rx={t.shape === "ROUND" ? t.h / 2 : 16} fill="none" stroke="#F2C14E" strokeWidth="3" />}
              <rect width={t.w} height={t.h} rx={t.shape === "ROUND" ? t.h / 2 : 14}
                fill={sel ? "url(#r66sel)" : free ? "url(#r66free)" : t.state === "busy" ? "url(#r66hatch)" : "#1a221b"}
                stroke={sel ? "#fff" : free ? (t.fit ? "#F2C14E" : "#76b783") : "#5a3030"} strokeWidth={sel || t.fit ? 3 : 2} />
              <text x={t.w / 2} y={t.h / 2 + 2} textAnchor="middle" fontSize="26" fontWeight="800" fill={sel ? "#0c130e" : free ? "#fff" : "#a98"} fontFamily="'IBM Plex Sans Arabic',sans-serif">{free || sel ? t.label : `🔒`}</text>
              <text x={t.w / 2} y={t.h / 2 + 22} textAnchor="middle" fontSize="12" fill={sel ? "#0c130e" : "#fff"} opacity=".75" fontFamily="'IBM Plex Sans Arabic',sans-serif">{free ? `${t.seats} 👤` : label(t)}</text>
              {t.fit && free && <g transform={`translate(${t.w - 2} -2)`}><circle r="13" fill="#F2C14E" /><text y="5" textAnchor="middle" fontSize="14" fill="#0c130e">★</text></g>}
            </g>
          </g>
        );
      })}
      {hov && (
        <g transform={`translate(${Math.min(Math.max(hov.x + hov.w / 2, 90), width - 90)} ${Math.max(hov.y - 38, 8)})`} pointerEvents="none">
          <rect x={-80} y={-20} width={160} height={34} rx={17} fill="#0c130e" stroke="#F2C14E" strokeOpacity=".6" />
          <text textAnchor="middle" y={3} fontSize="14" fill="#fff" fontFamily="'IBM Plex Sans Arabic',sans-serif">طاولة {hov.label} · {hov.seats} أشخاص · {label(hov)}</text>
        </g>
      )}
    </svg>
  );
}
