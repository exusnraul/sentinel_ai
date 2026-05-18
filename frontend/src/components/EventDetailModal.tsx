"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThreatEvent } from "./Dashboard";
import {
  X,
  Copy,
  Camera,
  Eye,
  EyeOff,
  AlertOctagon,
  ShieldAlert,
  AlertCircle,
  CheckCircle,
  Search,
  Shield,
  Clock,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

const riskStyles = {
  CRITICAL: {
    border: "border-neon-red/25",
    bg: "bg-neon-red/8",
    badge: "bg-neon-red/15 text-neon-red border border-neon-red/30",
    text: "text-neon-red",
    icon: AlertOctagon,
    bar: "bg-neon-red",
    glow: "shadow-neon-red/20",
  },
  HIGH: {
    border: "border-neon-orange/25",
    bg: "bg-neon-orange/8",
    badge: "bg-neon-orange/15 text-neon-orange border border-neon-orange/30",
    text: "text-neon-orange",
    icon: ShieldAlert,
    bar: "bg-neon-orange",
    glow: "shadow-neon-orange/20",
  },
  MEDIUM: {
    border: "border-neon-yellow/20",
    bg: "bg-neon-yellow/8",
    badge: "bg-neon-yellow/15 text-neon-yellow border border-neon-yellow/30",
    text: "text-neon-yellow",
    icon: AlertCircle,
    bar: "bg-neon-yellow",
    glow: "shadow-neon-yellow/20",
  },
  LOW: {
    border: "border-neon-green/15",
    bg: "bg-neon-green/5",
    badge: "bg-neon-green/15 text-neon-green border border-neon-green/30",
    text: "text-neon-green",
    icon: CheckCircle,
    bar: "bg-neon-green",
    glow: "shadow-neon-green/20",
  },
};

const styleFor = (rl: string) => riskStyles[rl as keyof typeof riskStyles] || riskStyles.LOW;

export default function EventDetailModal({
  event,
  onClose,
  onDismiss,
  onBlock,
}: {
  event: ThreatEvent | null;
  onClose: () => void;
  onDismiss?: (id: string) => void;
  onBlock?: (id: string) => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const handleCopy = () => {
    navigator.clipboard.writeText(event?.sanitized_content ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = (action: string) => {
    setActionMsg(`${action} action recorded`);
    setTimeout(() => setActionMsg(""), 2000);
    if (action === "Dismissed" && onDismiss && event) onDismiss(event.id);
    if (action === "Blocked" && onBlock && event) onBlock(event.id);
  };

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key={event.id}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative w-[640px] max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl",
              styleFor(event.risk_level).border,
              styleFor(event.risk_level).bg,
              styleFor(event.risk_level).glow
            )}
            style={{ backgroundColor: "#0c1320" }}
          >
            {/* Glow header bar */}
            <div
              className={cn(
                "absolute top-0 left-0 right-0 h-[2px]",
                styleFor(event.risk_level).bar
              )}
            />

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition-colors z-10"
            >
              <X className="w-3.5 h-3.5 text-zinc-500" />
            </button>

            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    styleFor(event.risk_level).bg,
                    styleFor(event.risk_level).border
                  )}
                >
                  {(() => {
                    const Icon = styleFor(event.risk_level).icon;
                    return (
                      <Icon
                        className={cn(
                          "w-5 h-5",
                          styleFor(event.risk_level).text
                        )}
                      />
                    );
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span
                      className={cn(
                        "text-[10px] font-bold font-mono px-2 py-0.5 rounded",
                        styleFor(event.risk_level).badge
                      )}
                    >
                      {event.risk_level}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {event.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-zinc-200">
                    {event.category.replace(/_/g, " ")} Exposure
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-zinc-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(event.timestamp * 1000).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      {event.source === "clipboard" ? (
                        <Copy className="w-3 h-3" />
                      ) : (
                        <Camera className="w-3 h-3" />
                      )}
                      {event.source}
                    </span>
                    <span>{timeAgo(event.timestamp)}</span>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              <div className="bg-black/40 rounded-xl border border-white/[0.04] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-neon-purple" />
                  <span className="text-[9px] text-zinc-500 font-mono tracking-wider uppercase">
                    AI Analysis
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {event.reason}
                </p>

                <div className="flex items-center gap-6 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-zinc-600 font-mono tracking-wider">
                      Confidence
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-mono font-semibold",
                        event.confidence > 0.8
                          ? "text-neon-red"
                          : event.confidence > 0.5
                            ? "text-neon-yellow"
                            : "text-neon-green"
                      )}
                    >
                      {(event.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-zinc-600 font-mono tracking-wider">
                      Risk Score
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-mono font-semibold",
                        styleFor(event.risk_level).text
                      )}
                    >
                      {event.risk_level === "CRITICAL"
                        ? "100"
                        : event.risk_level === "HIGH"
                          ? "75"
                          : event.risk_level === "MEDIUM"
                            ? "50"
                            : "20"}
                    </span>
                  </div>
                </div>

                <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${event.confidence * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      event.confidence > 0.8
                        ? "bg-gradient-to-r from-neon-orange to-neon-red"
                        : event.confidence > 0.5
                          ? "bg-gradient-to-r from-neon-yellow to-neon-orange"
                          : "bg-gradient-to-r from-neon-green to-neon-cyan"
                    )}
                  />
                </div>
              </div>

              {/* Content Comparison */}
              <div className="grid grid-cols-2 gap-3">
                {/* Original */}
                <div className="bg-black/40 rounded-xl border border-white/[0.04] p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[8px] text-zinc-600 font-mono tracking-wider uppercase">
                      Original Content
                    </span>
                    <button
                      onClick={() => setShowOriginal(!showOriginal)}
                      className="text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      {showOriginal ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-zinc-600 whitespace-pre-wrap break-all max-h-40 overflow-y-auto leading-relaxed">
                    {showOriginal
                      ? event.original_content || "N/A"
                      : "••••••••••••••••••••••••••••••••"}
                  </pre>
                </div>

                {/* Sanitized */}
                <div className="bg-neon-green/[0.03] rounded-xl border border-neon-green/15 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[8px] text-neon-green/70 font-mono tracking-wider uppercase flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" />
                      Sanitized
                    </span>
                    <button
                      onClick={handleCopy}
                      className="text-neon-green/60 hover:text-neon-green transition-colors"
                    >
                      {copied ? (
                        <span className="text-[9px] font-mono text-neon-green">
                          Copied!
                        </span>
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-neon-green/90 whitespace-pre-wrap break-all max-h-40 overflow-y-auto leading-relaxed">
                    {event.sanitized_content || "N/A"}
                  </pre>
                </div>
              </div>

              {/* Recommendation */}
              <div className="bg-amber-500/8 border border-amber-500/15 rounded-xl p-4">
                <div className="text-[9px] text-amber-400/60 font-mono tracking-wider mb-1.5 uppercase">
                  Recommendation
                </div>
                <div className="text-xs text-amber-300/90 leading-relaxed">
                  {event.recommended_action}
                </div>
              </div>

              {/* Action feedback */}
              {actionMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-[10px] font-mono text-neon-green py-1"
                >
                  {actionMsg}
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleAction("Investigated")}
                  className="flex-1 py-2.5 text-[10px] font-mono rounded-lg border border-white/8 text-zinc-400 hover:bg-white/5 hover:text-zinc-300 transition-all duration-200"
                >
                  Investigate
                </button>
                <button
                  onClick={() => handleAction("Dismissed")}
                  className="flex-1 py-2.5 text-[10px] font-mono rounded-lg border border-white/8 text-zinc-500 hover:bg-white/5 hover:text-zinc-400 transition-all duration-200"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleAction("Blocked")}
                  className={cn(
                    "flex-1 py-2.5 text-[10px] font-mono rounded-lg transition-all duration-200",
                    event.risk_level === "CRITICAL" || event.risk_level === "HIGH"
                      ? "bg-neon-red/10 border border-neon-red/25 text-neon-red hover:bg-neon-red/20"
                      : "bg-neon-yellow/10 border border-neon-yellow/25 text-neon-yellow hover:bg-neon-yellow/20"
                  )}
                >
                  Block
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
