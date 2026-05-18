"use client";
import { ThreatEvent } from "./Dashboard";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  YAxis,
} from "recharts";

const riskScore = (level: string) => {
  if (level === "CRITICAL") return 100;
  if (level === "HIGH") return 75;
  if (level === "MEDIUM") return 50;
  return 20;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    const value = payload[0].value;
    const level =
      value >= 90
        ? "CRITICAL"
        : value >= 65
          ? "HIGH"
          : value >= 35
            ? "MEDIUM"
            : "LOW";
    return (
      <div className="glass rounded-lg px-3 py-2 text-xs border border-white/10 shadow-xl">
        <div className="font-mono text-zinc-400 text-[10px]">Risk Score</div>
        <div className="font-mono text-neon-cyan font-semibold mt-0.5">
          {value}
          <span className="text-zinc-600 text-[9px] ml-1">{level}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function RiskTrend({ events }: { events: ThreatEvent[] }) {
  const data = [...events]
    .reverse()
    .slice(-30)
    .map((e, i) => ({
      i,
      risk: riskScore(e.risk_level),
    }));

  if (data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-zinc-800/30 border border-white/[0.04] flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
        </div>
        <div className="text-[10px] text-zinc-600 font-mono tracking-wider">
          NO DATA
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 8, right: 4, bottom: 0, left: -8 }}
      >
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.5} />
            <stop offset="40%" stopColor="#0088ff" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#0088ff" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="trendGradRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff2244" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#ff2244" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, 100]} />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Area
          type="monotone"
          dataKey="risk"
          stroke="#00e5ff"
          strokeWidth={1.5}
          fill="url(#trendGrad)"
          animationDuration={400}
          dot={false}
          activeDot={{
            r: 3,
            fill: "#00e5ff",
            stroke: "#0c1320",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
