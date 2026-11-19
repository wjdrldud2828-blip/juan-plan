import { cn } from "@/lib/utils";

export function Chip({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block aspect-square rounded-full bg-gold-gradient shadow-gold ring-2 ring-gold/40 ring-offset-2 ring-offset-background",
        "h-[0.8em] w-[0.8em] align-[-0.05em]",
        className,
      )}
    />
  );
}

export function Pieces({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[0.35em] tabular font-bold text-gold", className)}>
      <Chip />
      {n}
      <span className="text-[0.6em] font-semibold text-gold/80">피스</span>
    </span>
  );
}

export function Stars({ n, max = 3, className }: { n: number; max?: number; className?: string }) {
  return (
    <span className={cn("tracking-widest", className)} aria-label={`난이도 ${n}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? "text-gold" : "text-muted-foreground/30"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function Delta({ n, className }: { n: number; className?: string }) {
  const s = n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "±0";
  return (
    <span
      className={cn(
        "tabular font-display",
        n > 0 ? "text-gain" : n < 0 ? "text-loss" : "text-muted-foreground",
        className,
      )}
    >
      {s} 피스
    </span>
  );
}

export function Timer({ sec, className }: { sec: number | null; className?: string }) {
  if (sec === null) return null;
  return (
    <span
      className={cn(
        "tabular font-display",
        sec === 0 ? "text-muted-foreground" : sec <= 5 ? "anim-pulse-red" : "text-foreground",
        className,
      )}
    >
      {sec === 0 ? "마감" : sec}
    </span>
  );
}
