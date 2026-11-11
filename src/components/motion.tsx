"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useScroll, useSpring, useTransform, animate, type MotionValue } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

/** fades/slides children in once they scroll into view */
export function Reveal({ children, delay = 0, y = 28, className = "", as = "div" }: { children: React.ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "section" | "li" }) {
  const M = motion[as];
  return (
    <M className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.8, delay, ease }}>
      {children}
    </M>
  );
}

/** headline where each word drops in like letters on a sign */
export function SignWords({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span className="inline-block" initial={{ y: "110%", rotate: 4 }} animate={{ y: 0, rotate: 0 }} transition={{ duration: 0.9, delay: delay + i * 0.09, ease }}>
            {w}
          </motion.span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}

/** number that counts up when it becomes visible (or when it changes) */
export function CountUp({ value, className = "", format = (n: number) => Math.round(n).toLocaleString("en-US") }: { value: number; className?: string; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(prev.current, value, { duration: 1.1, ease, onUpdate: (v) => setShown(v) });
    prev.current = value;
    return () => c.stop();
  }, [value, inView]);
  return <span ref={ref} className={`num ${className}`}>{format(shown)}</span>;
}

/** endless horizontal ticker. speed in px/s */
export function Marquee({ children, speed = 60, reverse = false, className = "" }: { children: React.ReactNode; speed?: number; reverse?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.scrollWidth / 2));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className={`overflow-hidden ${className}`} dir="ltr">
      <div ref={ref} className="flex w-max" style={w ? { animation: `r66marq ${w / speed}s linear infinite ${reverse ? "reverse" : ""}` } : undefined}>
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>{children}</div>
      </div>
      <style>{`@keyframes r66marq{to{transform:translateX(-50%)}}`}</style>
    </div>
  );
}

/** yellow centre line that runs while you scroll */
export function useScrollDash(): MotionValue<string> {
  const { scrollY } = useScroll();
  return useTransform(scrollY, (v) => `${-v * 0.9}px 0`);
}

export function RoadStrip({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  const pos = useScrollDash();
  return (
    <div className={`road relative overflow-hidden ${className}`}>
      <motion.div className="dash-line absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 opacity-90" style={{ backgroundPosition: pos }} />
      <div className="relative">{children}</div>
    </div>
  );
}

/** card that tilts toward the pointer */
export function Tilt({ children, className = "", max = 8 }: { children: React.ReactNode; className?: string; max?: number }) {
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 }), sry = useSpring(ry, { stiffness: 200, damping: 18 });
  return (
    <motion.div className={className} style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * max * 2);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
      }}
      onPointerLeave={() => { rx.set(0); ry.set(0); }}>
      {children}
    </motion.div>
  );
}

/** element that leans toward the cursor a little */
export function Magnetic({ children, className = "", strength = 0.25 }: { children: React.ReactNode; className?: string; strength?: number }) {
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 16 }), sy = useSpring(y, { stiffness: 260, damping: 16 });
  return (
    <motion.div className={`inline-block ${className}`} style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.div>
  );
}

export { motion, ease };
