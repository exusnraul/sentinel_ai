"use client";
import { motion } from "framer-motion";
import { RiskLevel } from "./Dashboard";

const orbConfig = {
  CRITICAL: {
    outerRing: "#ff2244",
    innerRing: "#ff4466",
    core: "#ff0022",
    sweep: "rgba(255,0,34,0.25)",
    glow: "rgba(255,0,34,0.4)",
    label: "86",
    sublabel: "CRITICAL THREAT",
    textColor: "text-neon-red",
  },
  HIGH: {
    outerRing: "#ff6600",
    innerRing: "#ff8833",
    core: "#ff6600",
    sweep: "rgba(255,102,0,0.2)",
    glow: "rgba(255,102,0,0.3)",
    label: "62",
    sublabel: "HIGH RISK",
    textColor: "text-neon-orange",
  },
  MEDIUM: {
    outerRing: "#ffcc00",
    innerRing: "#ffdd44",
    core: "#ffcc00",
    sweep: "rgba(255,204,0,0.15)",
    glow: "rgba(255,204,0,0.2)",
    label: "41",
    sublabel: "ELEVATED",
    textColor: "text-neon-yellow",
  },
  LOW: {
    outerRing: "#00ff88",
    innerRing: "#44ffaa",
    core: "#00ff88",
    sweep: "rgba(0,255,136,0.1)",
    glow: "rgba(0,255,136,0.2)",
    label: "0",
    sublabel: "ALL CLEAR",
    textColor: "text-neon-green",
  },
};

export default function ThreatRadar({
  riskLevel,
  threats = 0,
}: {
  riskLevel: RiskLevel;
  threats?: number;
}) {
  const cfg = orbConfig[riskLevel];
  // For LOW, always show 0. For others, show actual threat count if available, else the config label.
  const centerScore = riskLevel === "LOW" ? "0" : threats > 0 ? String(threats) : cfg.label;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r3 = 92;
  const r2 = 66;
  const r1 = 42;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Glow backdrop */}
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.2, 0.5, 0.2] }}
        transition={{ repeat: Infinity, duration: 2.5 }}
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: cfg.glow }}
      />

      {/* Pulse rings */}
      {riskLevel !== "LOW" && (
        <>
          <motion.div
            animate={{ scale: [1, 2.2, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ repeat: Infinity, duration: 2.5, delay: 0 }}
            className="absolute w-full h-full rounded-full border"
            style={{
              borderColor: cfg.core,
              borderWidth: "1px",
            }}
          />
          <motion.div
            animate={{ scale: [1, 2.2, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ repeat: Infinity, duration: 2.5, delay: 0.8 }}
            className="absolute w-full h-full rounded-full border"
            style={{
              borderColor: cfg.core,
              borderWidth: "1px",
            }}
          />
        </>
      )}

      {/* SVG Radar */}
      <svg width={size} height={size} className="absolute">
        <defs>
          <radialGradient id={`grad-${riskLevel}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={cfg.core} stopOpacity="0.15" />
            <stop offset="60%" stopColor={cfg.core} stopOpacity="0.05" />
            <stop offset="100%" stopColor={cfg.core} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background glow */}
        <circle cx={cx} cy={cy} r={r3} fill={`url(#grad-${riskLevel})`} />

        {/* Crosshairs */}
        <line
          x1={cx}
          y1={4}
          x2={cx}
          y2={size - 4}
          stroke={cfg.outerRing}
          strokeOpacity="0.08"
          strokeWidth={0.5}
        />
        <line
          x1={4}
          y1={cy}
          x2={size - 4}
          y2={cy}
          stroke={cfg.outerRing}
          strokeOpacity="0.08"
          strokeWidth={0.5}
        />
        <line
          x1={8}
          y1={8}
          x2={size - 8}
          y2={size - 8}
          stroke={cfg.outerRing}
          strokeOpacity="0.04"
          strokeWidth={0.5}
        />
        <line
          x1={size - 8}
          y1={8}
          x2={8}
          y2={size - 8}
          stroke={cfg.outerRing}
          strokeOpacity="0.04"
          strokeWidth={0.5}
        />

        {/* Tick marks */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const inner = r3 - 8;
          const outer = r3;
          const round = (v: number) => Math.round(v * 1000) / 1000;
          return (
            <line
              key={i}
              x1={round(cx + inner * Math.cos(angle))}
              y1={round(cy + inner * Math.sin(angle))}
              x2={round(cx + outer * Math.cos(angle))}
              y2={round(cy + outer * Math.sin(angle))}
              stroke={cfg.outerRing}
              strokeOpacity="0.15"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Concentric rings */}
        <circle
          cx={cx}
          cy={cy}
          r={r3}
          fill="none"
          stroke={cfg.outerRing}
          strokeOpacity="0.15"
          strokeWidth={0.5}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r2}
          fill="none"
          stroke={cfg.innerRing}
          strokeOpacity="0.2"
          strokeWidth={0.5}
          strokeDasharray="4 4"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r1}
          fill="none"
          stroke={cfg.innerRing}
          strokeOpacity="0.3"
          strokeWidth={0.5}
          strokeDasharray="2 4"
        />
        <circle
          cx={cx}
          cy={cy}
          r={20}
          fill={cfg.core}
          fillOpacity="0.12"
          stroke={cfg.core}
          strokeOpacity="0.35"
          strokeWidth={1.5}
        />

        {/* Radar sweep */}
        <motion.path
          d={`M ${cx} ${cy} L ${cx} ${cy - r3} A ${r3} ${r3} 0 0 1 ${cx + r3 * Math.sin(Math.PI / 6)} ${cy - r3 * Math.cos(Math.PI / 6)} Z`}
          fill={cfg.sweep}
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration:
              riskLevel === "CRITICAL"
                ? 1.2
                : riskLevel === "HIGH"
                  ? 1.8
                  : 3,
            ease: "linear",
          }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Blips */}
        {riskLevel !== "LOW" && (
          <>
            <motion.circle
              cx={cx + 42}
              cy={cy - 55}
              r={4}
              fill={cfg.core}
              animate={{ opacity: [0, 1, 0], r: [3, 5, 3] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
            />
            <motion.circle
              cx={cx - 50}
              cy={cy + 28}
              r={3}
              fill={cfg.innerRing}
              animate={{ opacity: [0, 1, 0], r: [2, 4, 2] }}
              transition={{ repeat: Infinity, duration: 1.8, delay: 0.8 }}
            />
            <motion.circle
              cx={cx + 10}
              cy={cy - 78}
              r={2.5}
              fill={cfg.innerRing}
              animate={{ opacity: [0, 1, 0], r: [1.5, 3.5, 1.5] }}
              transition={{ repeat: Infinity, duration: 2, delay: 1.4 }}
            />
          </>
        )}
      </svg>

      {/* Center content */}
      <div className="relative z-10 text-center">
        <motion.div
          animate={
            riskLevel === "CRITICAL" || riskLevel === "HIGH"
              ? { scale: [1, 1.05, 1] }
              : {}
          }
          transition={{ repeat: Infinity, duration: 1.2 }}
          className={`text-2xl font-bold font-mono ${riskLevel === "CRITICAL" ? "glow-red" : riskLevel === "HIGH" ? "glow-orange" : riskLevel === "MEDIUM" ? "glow-yellow" : "glow-green"} ${cfg.textColor}`}
        >
          {centerScore}
        </motion.div>
        <div
          className={`text-[7px] font-mono tracking-[0.2em] mt-1 ${cfg.textColor} opacity-70`}
        >
          {cfg.sublabel}
        </div>
      </div>
    </div>
  );
}
