"use client";
import { useState } from "react";
import { ThreatEvent } from "./Dashboard";
import {
  Copy,
  Check,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowDown,
  Lock,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function SanitizePanel({
  event,
}: {
  event: ThreatEvent | null;
}) {
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const handleCopy = () => {
    if (!event) return;
    navigator.clipboard.writeText(event.sanitized_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass rounded-xl border border-white/[0.04] h-full flex flex-col p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-neon-green/10 flex items-center justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-neon-green" />
        </div>
        <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
          Sanitize & Share
        </span>
      </div>

      {event ? (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Original */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[8px] text-zinc-600 font-mono tracking-wider">
                ORIGINAL
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
            <div className="flex-1 bg-black/40 border border-white/[0.04] rounded-lg p-2.5 overflow-y-auto">
              <pre className="text-[10px] font-mono text-zinc-600 whitespace-pre-wrap break-all">
                {showOriginal
                  ? event.original_content?.substring(0, 200) ?? "N/A"
                  : "••••••••••••••••••••••••••••••••"}
              </pre>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 py-0.5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neon-green/25 to-transparent" />
            <div className="flex items-center gap-1.5">
              <ArrowDown className="w-3 h-3 text-neon-green/60" />
              <span className="text-[8px] text-neon-green/60 font-mono tracking-wider">
                SANITIZED
              </span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neon-green/25 to-transparent" />
          </div>

          {/* Sanitized */}
          <div className="flex-[1.5] flex flex-col min-h-0">
            <div className="flex-1 bg-neon-green/[0.03] border border-neon-green/15 rounded-lg p-2.5 overflow-y-auto">
              <pre className="text-[10px] font-mono text-neon-green/90 whitespace-pre-wrap break-all">
                {event.sanitized_content?.substring(0, 250) ?? "N/A"}
              </pre>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleCopy}
            className={cn(
              "w-full py-2 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-center gap-2 transition-all duration-200",
              copied
                ? "bg-neon-green/20 border border-neon-green/40 text-neon-green"
                : "bg-neon-green/10 border border-neon-green/25 text-neon-green/80 hover:bg-neon-green/15"
            )}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied to Clipboard
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Sanitized Text
              </>
            )}
          </motion.button>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-zinc-800/30 border border-white/[0.04] flex items-center justify-center mx-auto">
              <Lock className="w-4 h-4 text-zinc-600" />
            </div>
            <div className="text-[10px] text-zinc-600 font-mono tracking-wider">
              No Event Selected
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
