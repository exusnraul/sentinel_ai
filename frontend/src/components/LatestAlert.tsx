"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ThreatEvent } from "./Dashboard";
import {
  AlertTriangle,
  ChevronRight,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

export default function LatestAlert({
  event,
  onInvestigate,
  onDismiss,
  onBlock,
}: {
  event: ThreatEvent | null;
  onInvestigate?: () => void;
  onDismiss?: (id: string) => void;
  onBlock?: (id: string) => void;
}) {
  const [showContent, setShowContent] = useState(true);
  const isCritical =
    event?.risk_level === "CRITICAL" || event?.risk_level === "HIGH";

  if (!event) {
    return (
      <div className="glass rounded-xl border border-white/[0.04] h-full flex flex-col items-center justify-center gap-3 p-6">
        <div className="w-14 h-14 rounded-xl bg-neon-green/5 border border-neon-green/15 flex items-center justify-center">
          <Shield className="w-6 h-6 text-neon-green/40" />
        </div>
        <div className="text-center space-y-1">
          <div className="text-xs text-zinc-500 font-mono tracking-widest">
            ALL CLEAR
          </div>
          <div className="text-[9px] text-zinc-700 font-mono">
            No active threats detected
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      key={event.id}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "h-full rounded-xl flex flex-col p-5 overflow-hidden relative",
        isCritical
          ? "glass border border-neon-red/25"
          : "glass border border-neon-yellow/15"
      )}
    >
      {/* Animated gradient bar */}
      {isCritical && (
        <motion.div
          animate={{
            opacity: [0.4, 1, 0.4],
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-neon-red to-transparent bg-[length:200%_100%]"
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            isCritical ? "bg-neon-red/15" : "bg-neon-yellow/15"
          )}
        >
          <AlertTriangle
            className={cn(
              "w-4 h-4",
              isCritical ? "text-neon-red" : "text-neon-yellow"
            )}
          />
        </div>
        <div className="flex-1">
          <div
            className={cn(
              "text-[10px] font-bold font-mono tracking-wider",
              isCritical ? "text-neon-red" : "text-neon-yellow"
            )}
          >
            {event.risk_level} RISK DETECTED
          </div>
          <div className="text-[8px] text-zinc-600 font-mono mt-0.5">
            {timeAgo(event.timestamp)} via {event.source}
          </div>
        </div>
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className={cn(
            "text-[9px] font-mono tracking-wider flex items-center gap-1.5",
            isCritical ? "text-neon-red" : "text-neon-yellow"
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          LIVE
        </motion.div>
      </div>

      {/* Title */}
      <div className="text-sm font-semibold text-zinc-200 mb-1">
        {event.category.replace(/_/g, " ")} Exposure
      </div>
      <div className="text-[10px] text-zinc-500 mb-3">
        Detected in {event.source} content at{" "}
        {new Date(event.timestamp * 1000).toLocaleTimeString()}
      </div>

      {/* Redacted content */}
      <div className="flex-1 bg-black/40 rounded-lg border border-white/[0.04] p-3.5 overflow-y-auto mb-3 relative group">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase">
            {showContent ? "Detected Content (Redacted)" : "Content Hidden"}
          </div>
          <button
            onClick={() => setShowContent(!showContent)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {showContent ? (
              <EyeOff className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
          </button>
        </div>
        {showContent && (
          <pre className="text-[10px] font-mono text-zinc-300 whitespace-pre-wrap break-all leading-relaxed">
            {event.sanitized_content.length > 280
              ? event.sanitized_content.substring(0, 280) + "…"
              : event.sanitized_content}
          </pre>
        )}
      </div>

      {/* Recommendation */}
      <div className="flex items-start gap-2 mb-3 text-[10px] text-zinc-400">
        <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-zinc-600" />
        <span className="leading-relaxed">{event.recommended_action}</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onInvestigate}
          className="flex-1 py-2 text-[10px] font-mono rounded-lg border border-white/8 text-zinc-400 hover:bg-white/5 hover:text-zinc-300 transition-all duration-200"
        >
          Investigate
        </button>
        <button
          onClick={() => onDismiss?.(event.id)}
          className="flex-1 py-2 text-[10px] font-mono rounded-lg border border-white/8 text-zinc-500 hover:bg-white/5 hover:text-zinc-400 transition-all duration-200"
        >
          Dismiss
        </button>
        <button
          onClick={() => onBlock?.(event.id)}
          className={cn(
            "flex-1 py-2 text-[10px] font-mono rounded-lg transition-all duration-200",
            isCritical
              ? "bg-neon-red/10 border border-neon-red/25 text-neon-red hover:bg-neon-red/20"
              : "bg-neon-yellow/10 border border-neon-yellow/25 text-neon-yellow hover:bg-neon-yellow/20"
          )}
        >
          Block
        </button>
      </div>
    </motion.div>
  );
}

