"use client";
import { motion, AnimatePresence } from "framer-motion";
import { ThreatEvent } from "./Dashboard";
import {
  Copy,
  Camera,
  AlertOctagon,
  ShieldAlert,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

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

export default function ActivityFeed({
  events,
  onEventClick,
}: {
  events: ThreatEvent[];
  onEventClick?: (event: ThreatEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <div className="text-[10px] text-zinc-500 font-mono tracking-widest">
            LISTENING
          </div>
          <div className="text-[8px] text-zinc-700">
            Waiting for activity...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {events.map((e, idx) => {
          const cfg = riskConfig[e.risk_level] || riskConfig.LOW;
          const Icon = cfg.icon;
          const isFirst = idx === 0;

          return (
            <motion.button
              key={e.id}
              layout
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={() => onEventClick?.(e)}
              className={cn(
                "w-full text-left relative rounded-lg border overflow-hidden transition-all duration-200",
                cfg.bg,
                cfg.border,
                isFirst && "ring-1 ring-neon-cyan/20"
              )}
            >
              {/* Left accent bar */}
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-0.5",
                  cfg.bar
                )}
              />

              <div className="flex items-start gap-2.5 p-2.5 pl-3.5">
                <Icon
                  className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", cfg.color)}
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
                    {isFirst && (
                      <span className="text-[7px] text-neon-cyan font-mono ml-auto">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-300 font-medium truncate">
                    {e.category.replace(/_/g, " ")}
                  </div>
                  <div className="text-[8px] text-zinc-600 mt-0.5 truncate leading-relaxed">
                    {e.sanitized_content.substring(0, 80)}
                    {e.sanitized_content.length > 80 ? "…" : ""}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
