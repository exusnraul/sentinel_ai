"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThreatEvent } from "./Dashboard";
import EventDetailModal from "./EventDetailModal";
import { cn, timeAgo } from "@/lib/utils";
import { useLocalStorage } from "@/lib/storage";
import {
  Copy,
  Camera,
  AlertOctagon,
  ShieldAlert,
  AlertCircle,
  CheckCircle,
  Search,
  X,
  Filter,
  ArrowUpDown,
} from "lucide-react";

const riskConfig = {
  CRITICAL: {
    color: "text-neon-red",
    bg: "bg-neon-red/8",
    border: "border-neon-red/25",
    badge: "bg-neon-red/15 text-neon-red border border-neon-red/30",
    icon: AlertOctagon,
    bar: "bg-neon-red",
  },
  HIGH: {
    color: "text-neon-orange",
    bg: "bg-neon-orange/8",
    border: "border-neon-orange/25",
    badge: "bg-neon-orange/15 text-neon-orange border border-neon-orange/30",
    icon: ShieldAlert,
    bar: "bg-neon-orange",
  },
  MEDIUM: {
    color: "text-neon-yellow",
    bg: "bg-neon-yellow/8",
    border: "border-neon-yellow/20",
    badge: "bg-neon-yellow/15 text-neon-yellow border border-neon-yellow/30",
    icon: AlertCircle,
    bar: "bg-neon-yellow",
  },
  LOW: {
    color: "text-neon-green",
    bg: "bg-neon-green/5",
    border: "border-neon-green/15",
    badge: "bg-neon-green/15 text-neon-green border border-neon-green/30",
    icon: CheckCircle,
    bar: "bg-neon-green",
  },
};

const FILTERS = ["All", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export default function ActivityStreamView({
  events,
  onDismiss,
  onBlock,
}: {
  events: ThreatEvent[];
  onDismiss?: (id: string) => void;
  onBlock?: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [selectedEvent, setSelectedEvent] = useState<ThreatEvent | null>(null);
  const [sortNewest, setSortNewest] = useState(true);

  const filtered = useMemo(() => {
    let result = [...events];
    if (filter !== "All")
      result = result.filter((e) => e.risk_level === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.category.toLowerCase().includes(q) ||
          e.reason.toLowerCase().includes(q) ||
          e.sanitized_content.toLowerCase().includes(q) ||
          e.source.toLowerCase().includes(q)
      );
    }
    if (!sortNewest) result.reverse();
    return result;
  }, [events, filter, search, sortNewest]);

  const stats = useMemo(() => {
    return {
      total: filtered.length,
      critical: filtered.filter((e) => e.risk_level === "CRITICAL").length,
      high: filtered.filter((e) => e.risk_level === "HIGH").length,
      medium: filtered.filter((e) => e.risk_level === "MEDIUM").length,
      low: filtered.filter((e) => e.risk_level === "LOW").length,
    };
  }, [filtered]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 bg-black/30 border border-white/[0.06] rounded-lg pl-9 pr-3 text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-neon-cyan/30 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[9px] font-mono tracking-wider transition-all duration-200",
                filter === f
                  ? f === "All"
                    ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/25"
                    : f === "CRITICAL"
                      ? "bg-neon-red/15 text-neon-red border border-neon-red/25"
                      : f === "HIGH"
                        ? "bg-neon-orange/15 text-neon-orange border border-neon-orange/25"
                        : f === "MEDIUM"
                          ? "bg-neon-yellow/15 text-neon-yellow border border-neon-yellow/25"
                          : "bg-neon-green/15 text-neon-green border border-neon-green/25"
                  : "text-zinc-600 border border-transparent hover:text-zinc-400 hover:bg-white/[0.03]"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSortNewest(!sortNewest)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-mono text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03] transition-all border border-transparent"
        >
          <ArrowUpDown className="w-3 h-3" />
          {sortNewest ? "Newest" : "Oldest"}
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-4 text-[9px] font-mono text-zinc-600">
        <span>
          Total: <span className="text-zinc-400">{stats.total}</span>
        </span>
        <span>
          Critical: <span className="text-neon-red">{stats.critical}</span>
        </span>
        <span>
          High: <span className="text-neon-orange">{stats.high}</span>
        </span>
        <span>
          Medium: <span className="text-neon-yellow">{stats.medium}</span>
        </span>
        <span>
          Low: <span className="text-neon-green">{stats.low}</span>
        </span>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-5 -mb-5 px-5 pb-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
            <div className="w-10 h-10 rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 flex items-center justify-center">
              <Search className="w-4 h-4 text-neon-cyan" />
            </div>
            <div className="text-center space-y-1">
              <div className="text-[10px] text-zinc-500 font-mono tracking-widest">
                {events.length === 0 ? "NO EVENTS" : "NO MATCHES"}
              </div>
              <div className="text-[8px] text-zinc-700">
                {events.length === 0
                  ? "Waiting for activity..."
                  : "Try a different filter or search"}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {filtered.map((e) => {
                const cfg = riskConfig[e.risk_level] || riskConfig.LOW;
                const Icon = cfg.icon;
                return (
                  <motion.button
                    key={e.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    onClick={() => setSelectedEvent(e)}
                    className={cn(
                      "w-full text-left relative rounded-lg border overflow-hidden transition-all duration-200",
                      cfg.bg,
                      cfg.border,
                      selectedEvent?.id === e.id && "ring-1 ring-neon-cyan/30"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute left-0 top-0 bottom-0 w-0.5",
                        cfg.bar
                      )}
                    />
                    <div className="flex items-start gap-2.5 p-2.5 pl-3.5">
                      <Icon
                        className={cn(
                          "w-3.5 h-3.5 mt-0.5 shrink-0",
                          cfg.color
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={cn(
                              "text-[8px] font-bold font-mono px-1.5 py-0.5 rounded",
                              cfg.badge
                            )}
                          >
                            {e.risk_level}
                          </span>
                          <span className="text-[8px] text-zinc-600 font-mono flex items-center gap-1">
                            {e.source === "clipboard" ? (
                              <Copy className="w-2.5 h-2.5" />
                            ) : (
                              <Camera className="w-2.5 h-2.5" />
                            )}
                            {timeAgo(e.timestamp)}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-300 font-medium truncate">
                          {e.category.replace(/_/g, " ")}
                        </div>
                        <div className="text-[8px] text-zinc-600 mt-0.5 truncate leading-relaxed">
                          {e.sanitized_content.substring(0, 100)}
                          {e.sanitized_content.length > 100 ? "…" : ""}
                        </div>
                      </div>
                      <span className="text-[8px] text-zinc-700 font-mono shrink-0 mt-0.5">
                        {new Date(e.timestamp * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDismiss={onDismiss}
        onBlock={onBlock}
      />
    </div>
  );
}
