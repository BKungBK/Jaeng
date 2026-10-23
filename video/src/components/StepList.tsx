import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, enter, FONT, thaiWrap } from "../theme";

export type StepItem = {
  text: string;
  sub?: string;
  /** frame (scene-local) when the item appears */
  f: number;
  mark?: "check" | "dash" | "num" | "dot" | "warn" | "shield";
  num?: number;
  color?: string;
};
type Props = {
  items: StepItem[];
  x: number;
  y: number;
  width: number;
  fontSize?: number;
  gap?: number;
  /** dim older items and glow the latest one (the loop mode of the list) */
  focusLatest?: boolean;
};

const Marker: React.FC<{ item: StepItem; frame: number; size: number }> = ({ item, frame, size }) => {
  const { fps } = useVideoConfig();
  // spring with a small bounce only for "choosing/confirming" (motion.ts POP_SPRING)
  const pop = spring({ frame: frame - item.f - 4, fps, config: { damping: 11, stiffness: 190, mass: 0.8 } });
  const color = item.color ?? (item.mark === "dash" ? C.faint : item.mark === "warn" ? C.peach : C.mint);
  const common: React.CSSProperties = {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: size * 0.55,
  };
  if (item.mark === "dash") {
    const off = -(frame - item.f) * 0.4; // the dashes keep creeping: "not done yet"
    return (
      <svg width={size} height={size} style={{ flex: `0 0 ${size}px` }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 3}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray="7 7"
          strokeDashoffset={off}
        />
      </svg>
    );
  }
  if (item.mark === "num") {
    return (
      <div style={{ ...common, background: `linear-gradient(135deg, ${C.dawn1}, ${C.dawn2})`, color: C.onAccent, scale: String(pop) }}>
        {item.num}
      </div>
    );
  }
  if (item.mark === "dot") {
    return (
      <div style={{ ...common, background: "transparent" }}>
        <div style={{ width: size * 0.34, height: size * 0.34, borderRadius: "50%", background: color, scale: String(pop) }} />
      </div>
    );
  }
  const glyph = item.mark === "warn" ? "!" : item.mark === "shield" ? "⛨" : "✓";
  return (
    <div style={{ ...common, background: color, color: C.onAccent, scale: String(pop) }}>
      {glyph}
    </div>
  );
};

/** Items that come in one by one with what is said; ticks spring in. */
export const StepList: React.FC<Props> = ({ items, x, y, width, fontSize = 44, gap = 26, focusLatest = true }) => {
  const frame = useCurrentFrame();
  const shown = items.filter((it) => frame >= it.f);
  const latest = shown.length ? shown[shown.length - 1] : null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width, display: "flex", flexDirection: "column", gap, fontFamily: FONT }}>
      {items.map((it, i) => {
        const p = enter(frame, it.f, 16);
        if (p <= 0) return null;
        const isLatest = latest === it;
        const dim = focusLatest && !isLatest ? interpolate(frame, [latest!.f, latest!.f + 20], [1, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              opacity: p * dim,
              translate: `${(1 - p) * 40}px 0px`,
            }}
          >
            <Marker item={it} frame={frame} size={fontSize * 1.15} />
            <div style={{ lineHeight: 1.4 }}>
              <div
                style={{
                  fontSize,
                  fontWeight: 600,
                  color: C.ink,
                  textShadow: isLatest && focusLatest ? `0 0 28px rgba(244,180,154,0.45)` : "none",
                }}
              >
                {thaiWrap(it.text)}
              </div>
              {it.sub ? <div style={{ fontSize: fontSize * 0.68, color: C.muted, fontWeight: 500 }}>{thaiWrap(it.sub)}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
