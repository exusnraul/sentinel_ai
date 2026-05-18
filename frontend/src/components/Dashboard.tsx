"use client";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  LayoutDashboard,
  List,
  Target,
  TrendingUp,
  Shield as ShieldIcon,
  Settings,
  Copy,
  Camera,

  Upload,
  Lock,
  AlertOctagon,
  Scan,
  Bell,
  ChevronRight,
  Radio,
  Cpu,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import ThreatRadar from "./ThreatRadar";
import ActivityFeed from "./ActivityFeed";
import RiskTrend from "./RiskTrend";
import LatestAlert from "./LatestAlert";
import SanitizePanel from "./SanitizePanel";
import PolicyControl from "./PolicyControl";
import ActivityStreamView from "./ActivityStreamView";
import AnalyticsView from "./AnalyticsView";
import SettingsView from "./SettingsView";
import EventDetailModal from "./EventDetailModal";
import { cn, formatNumber } from "@/lib/utils";
import { useLocalStorage } from "@/lib/storage";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ThreatEvent = {
  id: string;
  timestamp: number;
  source: string;
  original_content: string;
  original_content_length: number;
  sanitized_content: string;
  risk_level: RiskLevel;
  confidence: number;
  category: string;
  reason: string;
  recommended_action: string;
};

const MAX_EVENTS = 500;

const navSections = [
  {
    label: "Main",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", active: true },
      { icon: List, label: "Activity Stream" },
      { icon: Target, label: "Threat Radar" },
      { icon: TrendingUp, label: "Analytics" },
    ],
  },
  {
    label: "Management",
    items: [
      { icon: ShieldIcon, label: "Policy Engine" },
      { icon: Settings, label: "Settings" },
    ],
  },
];


export default function Dashboard() {
  const [events, setEvents] = useLocalStorage<ThreatEvent[]>("events", []);
  const [connected, setConnected] = useState(false);
  const [activeNav, setActiveNav] = useLocalStorage("activeNav", "Dashboard");
  const [scanCount, setScanCount] = useLocalStorage("scanCount", 0);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(
    "sidebarCollapsed",
    false
  );
  const [dismissedIds, setDismissedIds] = useLocalStorage<string[]>(
    "dismissed",
    []
  );
  const [selectedEvent, setSelectedEvent] = useState<ThreatEvent | null>(null);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [loadedFromDb, setLoadedFromDb] = useState(false);
  const [time, setTime] = useState(new Date());
  const [monitorFlags, setMonitorFlags] = useState({
    clipboard_enabled: true,
    screenshot_enabled: true,
    live_monitor_enabled: false,
    file_upload_detection_enabled: false,
  });
  const ws = useRef<WebSocket | null>(null);
  const dedupSet = useRef(new Set<string>());

  // Load initial events from database
  useEffect(() => {
    if (loadedFromDb) return;
    fetch("http://localhost:8001/api/events?limit=500")
      .then((r) => r.json())
      .then((data) => {
        if (data.events?.length) {
          setEvents(data.events);
          data.events.forEach((e: ThreatEvent) => dedupSet.current.add(e.id));
        }
        setLoadedFromDb(true);
      })
      .catch(() => setLoadedFromDb(true));
  }, [loadedFromDb, setEvents]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  // Poll backend for monitoring flag state every 5 s so the sidebar stays in sync
  useEffect(() => {
    let alive = true;
    const poll = () =>
      fetch("http://localhost:8001/api/policies")
        .then((r) => r.json())
        .then((d) => {
          if (alive)
            setMonitorFlags({
              clipboard_enabled: d.clipboard_enabled,
              screenshot_enabled: d.screenshot_enabled,
              live_monitor_enabled: d.live_monitor_enabled,
              file_upload_detection_enabled: d.file_upload_detection_enabled ?? false,
            });
        })
        .catch(() => {});
    poll();
    const id = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);


  useEffect(() => {
    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (destroyed) return;
      try {
        const socket = new WebSocket("ws://localhost:8001/ws");
        ws.current = socket;

        socket.onopen = () => {
          if (destroyed) return;   // cleanup already closed it — don't double-close
          setConnected(true);
        };

        socket.onmessage = (e) => {
          if (destroyed) return;
          try {
            const data = JSON.parse(e.data);
            // Silently discard keepalive pings — they carry no .id
            if (!data.id || data.type === "ping" || data.type === "pong") return;
            if (dedupSet.current.has(data.id)) return;
            dedupSet.current.add(data.id);
            setEvents((prev) => [data as ThreatEvent, ...prev].slice(0, MAX_EVENTS));
            setScanCount((c) => c + 1);
          } catch {
            // Malformed message — ignore
          }
        };

        socket.onclose = () => {
          if (destroyed) return;          // cleanup-initiated close — don't retry
          setConnected(false);
          // 5s gives the server time to restart + load the model
          retryTimer = setTimeout(connect, 5000);
        };

        socket.onerror = () => {
          // onclose will fire immediately after — let it handle retry
        };

      } catch {
        if (!destroyed) retryTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      // Null the onclose handler BEFORE closing so cleanup doesn't schedule a retry
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, [setEvents, setScanCount]);


  const activeEvents = useMemo(
    () => events.filter((e) => !dismissedIds.includes(e.id)),
    [events, dismissedIds]
  );

  const critical = activeEvents.filter((e) => e.risk_level === "CRITICAL").length;
  const high = activeEvents.filter((e) => e.risk_level === "HIGH").length;
  const medium = activeEvents.filter((e) => e.risk_level === "MEDIUM").length;
  const low = activeEvents.filter((e) => e.risk_level === "LOW").length;
  const threats = critical + high;
  const total = events.length;
  const latest = events[0] ?? null;
  const latestAlert = events.find(
    (e) =>
      (e.risk_level === "HIGH" || e.risk_level === "CRITICAL") &&
      !dismissedIds.includes(e.id)
  ) ?? null;

  const overallRisk: RiskLevel =
    critical > 0
      ? "CRITICAL"
      : high > 0
        ? "HIGH"
        : medium > 0
          ? "MEDIUM"
          : "LOW";

  const sidebarWidth = sidebarCollapsed ? "w-16" : "w-60";

  const handleClearData = () => {
    setEvents([]);
    setScanCount(0);
    setDismissedIds([]);
    setLoadedFromDb(false);
  };

  const navigateTo = (view: string) => {
    setActiveNav(view);
  };

  const renderContent = () => {
    switch (activeNav) {
      case "Dashboard":
        return (
          <div className="space-y-5">
            {/* Status Banner */}
            {overallRisk === "CRITICAL" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neon-red/8 border border-neon-red/25"
              >
                <AlertOctagon className="w-4 h-4 text-neon-red shrink-0" />
                <span className="text-xs text-neon-red font-medium">
                  Critical threat level detected — immediate action recommended
                </span>
                <button
                  onClick={() => setActiveNav("Activity Stream")}
                  className="ml-auto text-[10px] px-3 py-1.5 rounded-lg bg-neon-red/15 text-neon-red font-mono hover:bg-neon-red/25 transition-colors"
                >
                  Review Now
                </button>
              </motion.div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: "Total Events",
                  value: total,
                  icon: Activity,
                  color: "cyan",
                  subtitle: "All monitored activity",
                },
                {
                  label: "Threats Blocked",
                  value: threats,
                  icon: ShieldCheck,
                  color: "red",
                  subtitle: "Critical & High risk",
                },
                {
                  label: "Warnings",
                  value: medium,
                  icon: AlertTriangle,
                  color: "yellow",
                  subtitle: "Medium risk events",
                },
                {
                  label: "All Clear",
                  value: low,
                  icon: CheckCircle,
                  color: "green",
                  subtitle: "Low risk events",
                },
              ].map(({ label, value, icon: Icon, color, subtitle }, idx) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "glass rounded-xl p-4 border transition-all duration-300 hover:border-opacity-40 group cursor-default",
                    color === "red"
                      ? "border-neon-red/15 hover:border-neon-red/30"
                      : color === "yellow"
                        ? "border-neon-yellow/15 hover:border-neon-yellow/30"
                        : color === "cyan"
                          ? "border-neon-cyan/15 hover:border-neon-cyan/30"
                          : "border-neon-green/15 hover:border-neon-green/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                      {label}
                    </span>
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110",
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
                            : "text-neon-green",
                      value > 0 && color === "red" && "glow-red",
                      value > 0 && color === "yellow" && "glow-yellow"
                    )}
                  >
                    {formatNumber(value)}
                  </div>
                  <div className="text-[9px] text-zinc-600 mt-1 font-mono">
                    {subtitle}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Row 2: Radar + Alert + Trend */}
            <div className="grid grid-cols-12 gap-5">
              {/* Radar — prominent col-span-4 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="col-span-4 glass rounded-xl border border-white/[0.04] flex flex-col p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-neon-cyan" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                      Threat Radar
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-mono tracking-wider px-2 py-0.5 rounded-full",
                      overallRisk === "CRITICAL"
                        ? "bg-neon-red/15 text-neon-red"
                        : overallRisk === "HIGH"
                          ? "bg-neon-orange/15 text-neon-orange"
                          : overallRisk === "MEDIUM"
                            ? "bg-neon-yellow/15 text-neon-yellow"
                            : "bg-neon-green/15 text-neon-green"
                    )}
                  >
                    {overallRisk}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <ThreatRadar riskLevel={overallRisk} threats={threats} />
                </div>
              </motion.div>

              {/* Latest Alert — col-span-5 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="col-span-5"
              >
                <LatestAlert
                  event={latestAlert}
                  onInvestigate={() => {
                    if (latestAlert) setSelectedEvent(latestAlert);
                  }}
                  onDismiss={(id) =>
                    setDismissedIds((prev) =>
                      prev.includes(id) ? prev : [...prev, id]
                    )
                  }
                  onBlock={(id) =>
                    setDismissedIds((prev) =>
                      prev.includes(id) ? prev : [...prev, id]
                    )
                  }
                />
              </motion.div>

              {/* Risk Trend — col-span-3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="col-span-3 glass rounded-xl border border-white/[0.04] p-5 flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-neon-cyan" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                      Risk Trend
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <RiskTrend events={events} />
                </div>
              </motion.div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-12 gap-5">
              {/* Activity Feed — col-span-5 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="col-span-5 glass rounded-xl border border-white/[0.04] flex flex-col p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <List className="w-3.5 h-3.5 text-neon-cyan" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                      Live Activity
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveNav("Activity Stream")}
                      className="text-[8px] text-zinc-600 hover:text-zinc-400 font-mono tracking-wider transition-colors"
                    >
                      View All →
                    </button>
                  </div>
                </div>
                {/* Show only 5 most recent — keeps height compact */}
                <div className="space-y-0 overflow-hidden">
                  <ActivityFeed
                    events={events.slice(0, 5)}
                    onEventClick={(e) => setSelectedEvent(e)}
                  />
                </div>
                {events.length > 5 && (
                  <button
                    onClick={() => setActiveNav("Activity Stream")}
                    className="mt-3 w-full text-[8px] font-mono text-zinc-600 hover:text-neon-cyan transition-colors text-center tracking-wider"
                  >
                    +{events.length - 5} more events → View All
                  </button>
                )}
              </motion.div>

              {/* AI Explanation — col-span-4 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="col-span-4 glass rounded-xl border border-white/[0.04] p-5 flex flex-col"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className="w-3.5 h-3.5 text-neon-purple" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
                    AI Analysis
                  </span>
                </div>
                {latest ? (
                  <div className="flex-1 flex flex-col gap-3 min-h-0">
                    <div className="flex-1 bg-black/40 rounded-lg p-3.5 border border-white/[0.04] overflow-y-auto">
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {latest.reason}
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-zinc-600 font-mono tracking-wider">
                          CONFIDENCE
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-mono font-semibold",
                            latest.confidence > 0.8
                              ? "text-neon-red"
                              : latest.confidence > 0.5
                                ? "text-neon-yellow"
                                : "text-neon-green"
                          )}
                        >
                          {(latest.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${latest.confidence * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className={cn(
                            "h-full rounded-full",
                            latest.confidence > 0.8
                              ? "bg-gradient-to-r from-neon-orange to-neon-red"
                              : latest.confidence > 0.5
                                ? "bg-gradient-to-r from-neon-yellow to-neon-orange"
                                : "bg-gradient-to-r from-neon-green to-neon-cyan"
                          )}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-zinc-600 uppercase tracking-wider">
                          {latest.category.replace(/_/g, " ")}
                        </span>
                        <span className="text-neon-cyan">{latest.source}</span>
                      </div>
                    </div>
                    <div className="bg-amber-500/8 border border-amber-500/15 rounded-lg p-3">
                      <div className="text-[9px] text-amber-400/60 font-mono tracking-wider mb-1">
                        RECOMMENDATION
                      </div>
                      <div className="text-[10px] text-amber-300/90 leading-relaxed">
                        {latest.recommended_action}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-800/30 border border-white/[0.04] flex items-center justify-center mx-auto">
                        <Cpu className="w-5 h-5 text-zinc-600" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-zinc-600 font-mono tracking-wider">
                          Awaiting Data
                        </div>
                        <div className="text-[9px] text-zinc-700">
                          AI engine is idle
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Sanitize — col-span-3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="col-span-3"
              >
                <SanitizePanel event={latest} />
              </motion.div>
            </div>
          </div>
        );

      case "Activity Stream":
        return (
          <ActivityStreamView
            events={events}
            onDismiss={(id) =>
              setDismissedIds((prev) =>
                prev.includes(id) ? prev : [...prev, id]
              )
            }
            onBlock={(id) =>
              setDismissedIds((prev) =>
                prev.includes(id) ? prev : [...prev, id]
              )
            }
          />
        );

      case "Threat Radar":
        return (
          <div className="h-full flex flex-col items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-neon-cyan" />
              <span className="text-xs text-zinc-500 uppercase tracking-[0.15em] font-mono">
                Real-Time Threat Radar
              </span>
              <span
                className={cn(
                  "text-[10px] font-mono tracking-wider px-2.5 py-1 rounded-full",
                  overallRisk === "CRITICAL"
                    ? "bg-neon-red/15 text-neon-red"
                    : overallRisk === "HIGH"
                      ? "bg-neon-orange/15 text-neon-orange"
                      : overallRisk === "MEDIUM"
                        ? "bg-neon-yellow/15 text-neon-yellow"
                        : "bg-neon-green/15 text-neon-green"
                )}
              >
                {overallRisk}
              </span>
            </div>
            {/* Large centered radar */}
            <div className="flex items-center justify-center">
              <div className="scale-[2.8] origin-center">
                <ThreatRadar riskLevel={overallRisk} threats={threats} />
              </div>
            </div>
            <div className="flex items-center gap-8 text-[9px] font-mono text-zinc-600 mt-12">
              <span>
                Events: <span className="text-zinc-400">{total}</span>
              </span>
              <span>
                Threats: <span className="text-neon-red">{threats}</span>
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "relative flex h-2 w-2",
                    connected && "status-active"
                  )}
                >
                  <span
                    className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      connected ? "bg-neon-green" : "bg-neon-red"
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex rounded-full h-2 w-2",
                      connected ? "bg-neon-green" : "bg-neon-red"
                    )}
                  />
                </span>
                {connected ? "Live" : "Disconnected"}
              </div>
            </div>
          </div>
        );

      case "Analytics":
        return <AnalyticsView events={events} />;

      case "Policy Engine":
        return (
          <div className="flex-1 flex flex-col min-h-0 max-w-lg">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-zinc-200 font-mono">
                Policy Engine
              </h2>
              <p className="text-[10px] text-zinc-600 font-mono mt-1">
                Configure automated response rules for detected threats
              </p>
            </div>
            <div className="flex-1">
              <PolicyControl />
            </div>
          </div>
        );

      case "Settings":
        return (
          <SettingsView
            eventCount={total}
            onClearData={handleClearData}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-cyber-900">
      {/* ── SIDEBAR ── */}
      <aside
        className={cn(
          sidebarWidth,
          "shrink-0 flex flex-col glass-strong border-r border-white/[0.04] z-20 transition-all duration-300 overflow-hidden"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "p-4 border-b border-white/[0.04]",
            sidebarCollapsed ? "px-0 flex justify-center" : ""
          )}
        >
          <div
            className={cn(
              "flex items-center",
              sidebarCollapsed ? "flex-col gap-2" : "gap-3"
            )}
          >
            <div className="relative shrink-0">
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.8, 0.3] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                className="absolute inset-0 bg-neon-cyan rounded-full blur-xl"
              />
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-blue/20 border border-neon-cyan/30 flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-neon-cyan" />
              </div>
            </div>
            {!sidebarCollapsed && (
              <div>
                <div className="text-xs font-bold tracking-[0.15em] text-white">
                  SENTINEL
                </div>
                <div className="text-[9px] text-neon-cyan/60 tracking-[0.2em] uppercase">
                  AI Security
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              {!sidebarCollapsed && (
                <div className="text-[9px] text-zinc-600 uppercase tracking-[0.15em] font-mono mb-2 px-2">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    onClick={() => setActiveNav(label)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all duration-200 group relative",
                      sidebarCollapsed && "justify-center px-2",
                      activeNav === label
                        ? "bg-neon-cyan/8 text-neon-cyan border border-neon-cyan/15"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                    )}
                  >
                    {activeNav === label && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-neon-cyan rounded-full"
                      />
                    )}
                    <Icon className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span>{label}</span>}
                    {label === "Activity Stream" &&
                      events.length > 0 &&
                      !sidebarCollapsed && (
                        <span suppressHydrationWarning className="ml-auto text-[9px] bg-neon-cyan/15 text-neon-cyan px-1.5 py-0.5 rounded font-mono">
                          {events.length}
                        </span>
                      )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Guards */}
        <div className="p-3 border-t border-white/[0.04]">
          {!sidebarCollapsed && (
            <div className="text-[9px] text-zinc-600 uppercase tracking-[0.15em] font-mono mb-2.5 px-1">
              Protection Layer
            </div>
          )}
          <div className="space-y-1.5">
            {[
              { icon: Copy,         label: "Clipboard",    status: monitorFlags.clipboard_enabled },
              { icon: Camera,       label: "Screenshot",   status: monitorFlags.screenshot_enabled },
              { icon: Radio,        label: "Live Mode",    status: monitorFlags.live_monitor_enabled },
              { icon: Upload,       label: "File Upload",  status: monitorFlags.file_upload_detection_enabled ?? false },
              { icon: Lock,         label: "App Detect",   status: true },
              { icon: ShieldCheck,  label: "Web Detect",   status: true },
            ].map(({ icon: Icon, label, status }) => (
              <div
                key={label}
                className={cn(
                  "flex items-center",
                  sidebarCollapsed ? "justify-center" : "justify-between px-1"
                )}
              >
                {!sidebarCollapsed && (
                  <>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      <Icon className="w-3 h-3" />
                      {label}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "relative flex h-2 w-2",
                          status && "status-active"
                        )}
                      >
                        <span
                          className={cn(
                            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                            status ? "bg-neon-green" : "bg-zinc-600"
                          )}
                        />
                        <span
                          className={cn(
                            "relative inline-flex rounded-full h-2 w-2",
                            status ? "bg-neon-green" : "bg-zinc-600"
                          )}
                        />
                      </span>
                      <span
                        className={cn(
                          "text-[9px] font-mono",
                          status ? "text-neon-green" : "text-zinc-600"
                        )}
                      >
                        {status ? "ACTIVE" : "OFF"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>


        {/* Bottom section */}
        <div className="p-3 space-y-2 border-t border-white/[0.04]">
          <div
            className={cn(
              "glass rounded-lg p-2.5 text-center space-y-1.5",
              sidebarCollapsed && "p-2"
            )}
          >
            <Lock
              className={cn(
                "w-3.5 h-3.5 text-neon-green mx-auto",
                sidebarCollapsed && "w-4 h-4"
              )}
            />
            {!sidebarCollapsed && (
              <>
                <div className="text-[9px] font-bold text-neon-green tracking-[0.15em] font-mono">
                  100% LOCAL
                </div>
                <div className="text-[8px] text-neon-green/50">
                  No data leaves device
                </div>
              </>
            )}
          </div>

          <div
            className={cn(
              "flex items-center gap-2 text-[10px] rounded-lg p-2 transition-colors",
              connected
                ? "bg-neon-green/5 text-neon-green"
                : "bg-neon-red/5 text-neon-red",
              sidebarCollapsed && "justify-center p-2"
            )}
          >
            <div className="relative flex h-2 w-2 shrink-0">
              <span
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  connected ? "bg-neon-green" : "bg-neon-red"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  connected ? "bg-neon-green" : "bg-neon-red"
                )}
              />
            </div>
            {!sidebarCollapsed && (
              <span className="font-mono tracking-wider">
                {connected ? "Backbone Connected" : "Disconnected"}
              </span>
            )}
          </div>

          {/* Collapse button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center py-1.5 text-zinc-600 hover:text-zinc-400 transition-colors rounded-lg hover:bg-white/[0.03]"
          >
            <ChevronRight
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-300",
                sidebarCollapsed && "rotate-180"
              )}
            />
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-13 shrink-0 glass border-b border-white/[0.04] flex items-center px-5 justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-semibold text-zinc-200">
                {activeNav === "Dashboard"
                  ? "Security Dashboard"
                  : activeNav}
              </h1>
              <div className="h-3 w-px bg-white/5" />
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-600">
                <Radio className="w-3 h-3 text-neon-cyan" />
                <span suppressHydrationWarning className="tracking-wide">
                  {time.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
              <div className="flex items-center gap-1.5">
                <Scan className="w-3 h-3 text-zinc-600" />
                <span>
                  SCANS{" "}
                  <span className="text-neon-cyan font-semibold">
                    {formatNumber(scanCount)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertOctagon className="w-3 h-3 text-neon-red" />
                <span>
                  THREATS{" "}
                  <span className="text-neon-red font-semibold">
                    {threats}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-neon-green" />
                <span>
                  SAFE{" "}
                  <span className="text-neon-green font-semibold">{low}</span>
                </span>
              </div>
            </div>

            <div className="h-4 w-px bg-white/5" />

            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex items-center gap-1.5 text-neon-green text-[10px] font-mono"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-neon-green" />
              </span>
              <span className="tracking-wider">LIVE</span>
            </motion.div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowNotificationPanel(!showNotificationPanel);
                  if (activeNav !== "Activity Stream")
                    setActiveNav("Activity Stream");
                }}
                className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition-colors"
              >
                <Bell className="w-3.5 h-3.5 text-zinc-500" />
                {threats > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-neon-red rounded-full" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {renderContent()}
        </div>
      </div>

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDismiss={(id) =>
          setDismissedIds((prev) =>
            prev.includes(id) ? prev : [...prev, id]
          )
        }
        onBlock={(id) =>
          setDismissedIds((prev) =>
            prev.includes(id) ? prev : [...prev, id]
          )
        }
      />
    </div>
  );
}
