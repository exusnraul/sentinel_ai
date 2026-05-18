"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ThreatEvent } from "./Dashboard";
import { cn, formatNumber } from "@/lib/utils";
import {
  BarChart3,
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  PieChart,
  TrendingUp,
  Copy,
  Camera,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
} from "recharts";

const riskScore = (level: string) => {
  if (level === "CRITICAL") return 100;
  if (level === "HIGH") return 75;
  if (level === "MEDIUM") return 50;
  return 20;
};

const COLORS = {
  CRITICAL: "#ff2244",
  HIGH: "#ff6600",
  MEDIUM: "#ffcc00",
  LOW: "#00ff88",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="glass rounded-lg px-3 py-2 text-xs border border-white/10 shadow-xl">
        <div className="font-mono text-zinc-500 text-[9px]">{label}</div>
        {payload.map((p: any, i: number) => (
          <div
            key={i}
            className="font-mono text-[10px] mt-0.5"
            style={{ color: p.color || "#00e5ff" }}
          >
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsView({
  events,
}: {
  events: ThreatEvent[];
}) {
  const stats = useMemo(() => {
    const critical = events.filter((e) => e.risk_level === "CRITICAL").length;
    const high = events.filter((e) => e.risk_level === "HIGH").length;
    const medium = events.filter((e) => e.risk_level === "MEDIUM").length;
    const low = events.filter((e) => e.risk_level === "LOW").length;
    return { critical, high, medium, low, total: events.length };
  }, [events]);

  const riskTrend = useMemo(
    () =>
      [...events]
        .reverse()
        .slice(-50)
        .map((e, i) => ({
          index: i,
          score: riskScore(e.risk_level),
        })),
    [events]
  );

  const riskDistribution = useMemo(
    () =>
      [
        { name: "CRITICAL", value: stats.critical, color: COLORS.CRITICAL },
        { name: "HIGH", value: stats.high, color: COLORS.HIGH },
        { name: "MEDIUM", value: stats.medium, color: COLORS.MEDIUM },
        { name: "LOW", value: stats.low, color: COLORS.LOW },
      ].filter((d) => d.value > 0),
    [stats]
  );

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((e) => {
      const cat = e.category.replace(/_/g, " ");
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [events]);

  const sourceBreakdown = useMemo(() => {
    const clipboard = events.filter((e) => e.source === "clipboard").length;
    const screenshot = events.filter((e) => e.source === "screenshot").length;
    return [
      { name: "Clipboard", value: clipboard, icon: Copy },
      { name: "Screenshot", value: screenshot, icon: Camera },
    ];
  }, [events]);

  const hourlyActivity = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0,
    }));
    events.forEach((e) => {
      const h = new Date(e.timestamp * 1000).getHours();
      hours[h].count++;
    });
    return hours;
  }, [events]);

  const cards = [
    {
      label: "Total Events",
      value: stats.total,
      icon: Activity,
      color: "cyan",
    },
    {
      label: "Threats Blocked",
      value: stats.critical + stats.high,
      icon: ShieldCheck,
      color: "red",
    },
    {
      label: "Warnings",
      value: stats.medium,
      icon: AlertTriangle,
      color: "yellow",
    },
    {
      label: "All Clear",
      value: stats.low,
      icon: CheckCircle,
      color: "green",
    },
  ];

  const avgConfidence = useMemo(() => {
    if (events.length === 0) return 0;
    return (
      events.reduce((sum, e) => sum + e.confidence, 0) / events.length
    );
  }, [events]);

  const threatRate = stats.total > 0
    ? (((stats.critical + stats.high) / stats.total) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="flex-1 overflow-y-auto space-y-5 min-h-0">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "glass rounded-xl p-4 border transition-all duration-300",
              color === "red"
                ? "border-neon-red/15"
                : color === "yellow"
                  ? "border-neon-yellow/15"
                  : color === "cyan"
                    ? "border-neon-cyan/15"
                    : "border-neon-green/15"
            )}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[9px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                {label}
              </span>
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  color === "red"
                    ? "bg-neon-red/10"
                    : color === "yellow"
                      ? "bg-neon-yellow/10"
                      : color === "cyan"
                        ? "bg-neon-cyan/10"
                        : "bg-neon-green/10"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4",
                    color === "red"
                      ? "text-neon-red"
                      : color === "yellow"
                        ? "text-neon-yellow"
                        : color === "cyan"
                          ? "text-neon-cyan"
                          : "text-neon-green"
                  )}
                />
              </div>
            </div>
            <div
              className={cn(
                "text-2xl font-bold font-mono tracking-tight",
                color === "red"
                  ? "text-neon-red"
                  : color === "yellow"
                    ? "text-neon-yellow"
                    : color === "cyan"
                      ? "text-neon-cyan"
                      : "text-neon-green"
              )}
            >
              {formatNumber(value)}
            </div>
            <div className="text-[9px] text-zinc-600 mt-1 font-mono">
              {color === "red"
                ? "Critical & High risk"
                : color === "yellow"
                  ? "Medium risk events"
                  : color === "cyan"
                    ? "All monitored activity"
                    : "Low risk events"}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-4 text-[9px] font-mono text-zinc-600 pb-1">
        <span>
          Avg Confidence:{" "}
          <span className="text-neon-cyan">
            {(avgConfidence * 100).toFixed(0)}%
          </span>
        </span>
        <span>
          Threat Rate:{" "}
          <span className="text-neon-red">{threatRate}%</span>
        </span>
        <span>
          Data Points:{" "}
          <span className="text-zinc-400">{events.length}</span>
        </span>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-12 gap-5">
        {/* Risk Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="col-span-6 glass rounded-xl border border-white/[0.04] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-3.5 h-3.5 text-neon-cyan" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
              Risk Trend (Last 50)
            </span>
          </div>
          <div className="h-48">
            {riskTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riskTrend} margin={{ top: 5, right: 5, bottom: 0, left: -5 }}>
                  <defs>
                    <linearGradient id="trendGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={[0, 110]} />
                  <Tooltip content={<CustomTooltip label="Event" />} cursor={false} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#00e5ff"
                    strokeWidth={1.5}
                    fill="url(#trendGrad2)"
                    dot={false}
                    animationDuration={400}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[10px] text-zinc-600 font-mono">
                No data
              </div>
            )}
          </div>
        </motion.div>

        {/* Risk Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-3 glass rounded-xl border border-white/[0.04] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-3.5 h-3.5 text-neon-cyan" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
              Risk Distribution
            </span>
          </div>
          <div className="h-48 flex items-center justify-center">
            {riskDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={riskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {riskDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-[10px] text-zinc-600 font-mono">No data</div>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 mt-1">
            {riskDistribution.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-[8px] font-mono text-zinc-600">
                  {d.name}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Source Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="col-span-3 glass rounded-xl border border-white/[0.04] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-3.5 h-3.5 text-neon-cyan" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
              Source Breakdown
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceBreakdown} layout="vertical" margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{
                    fill: "#52525b",
                    fontSize: 10,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  <Cell fill="#00e5ff" />
                  <Cell fill="#a855f7" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-12 gap-5">
        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-7 glass rounded-xl border border-white/[0.04] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-3.5 h-3.5 text-neon-cyan" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
              Category Breakdown
            </span>
          </div>
          <div className="h-56">
            {categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryBreakdown}
                  layout="vertical"
                  margin={{ top: 5, right: 10, bottom: 0, left: 80 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{
                      fill: "#52525b",
                      fontSize: 9,
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {categoryBreakdown.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          i === 0
                            ? "#ff2244"
                            : i === 1
                              ? "#ff6600"
                              : i === 2
                                ? "#ffcc00"
                                : i === 3
                                  ? "#00ff88"
                                  : "#00e5ff"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[10px] text-zinc-600 font-mono">
                No data
              </div>
            )}
          </div>
        </motion.div>

        {/* Hourly Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="col-span-5 glass rounded-xl border border-white/[0.04] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-3.5 h-3.5 text-neon-cyan" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
              Activity by Hour
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyActivity} margin={{ top: 5, right: 5, bottom: 0, left: -5 }}>
                <defs>
                  <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="hour"
                  tick={{
                    fill: "#52525b",
                    fontSize: 9,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(h) => `${h}h`}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip label="Hour" />} cursor={false} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  fill="url(#hourlyGrad)"
                  dot={false}
                  animationDuration={400}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
