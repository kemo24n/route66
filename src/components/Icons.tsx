/** line icons for the staff side, one stroke weight, drawn for this system */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const Icon = {
  dash: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><path d="M4 13a8 8 0 0 1 16 0" /><path d="M12 13l4-4" /><path d="M3 17h18" /></svg>,
  floor: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><rect x="3" y="3" width="7" height="7" rx="1.5" /><circle cx="17" cy="6.5" r="3.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  bell: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><path d="M5 17h14l-1.5-2V11a5.5 5.5 0 0 0-11 0v4z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>,
  fire: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.5 3-5.5 3.5-9 2 1.3 3 3 3.2 4.6C13.5 9 14.5 7.5 15 6c2.3 2 3.5 5 3.5 8 0 4-2.5 7-6.5 7z" /><path d="M12 21c-1.6 0-2.7-1.1-2.7-2.7 0-1.6 1.4-2.5 2.7-4 1.3 1.5 2.7 2.4 2.7 4 0 1.6-1.1 2.7-2.7 2.7z" /></svg>,
  clock: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M12 13v3l2 1" /></svg>,
  cash: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></svg>,
  menu: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><path d="M5 3v8a3 3 0 0 0 6 0V3M8 3v18" /><path d="M18 21V3c-2.5 1.5-3.5 4-3.5 8h3.5" /></svg>,
  map: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></svg>,
  qr: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></svg>,
  shield: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>,
  users: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.6 3 5.2" /></svg>,
  gear: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  out: (c = "h-4 w-4") => <svg viewBox="0 0 24 24" className={c} {...P}><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>,
  burger: (c = "h-5 w-5") => <svg viewBox="0 0 24 24" className={c} {...P}><path d="M4 7h16M4 12h16M4 17h10" /></svg>,
};
