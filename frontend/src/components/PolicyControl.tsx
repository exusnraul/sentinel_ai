"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Camera,
  Clipboard,
  Radio,
  Shield,
  ShieldAlert,
  Eye,
  Database,
  Trash2,
  AlertTriangle,
  Loader2,
  Wifi,
  WifiOff,
  Upload,
  Monitor,
  Globe,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type PolicyFlags = {
  clipboard_enabled: boolean;
  screenshot_enabled: boolean;
  live_monitor_enabled: boolean;
  file_upload_detection_enabled: boolean;
  monitored_apps: string[];
  monitored_websites: string[];
  block_high_critical: boolean;
  warn_medium: boolean;
  auto_sanitize: boolean;
  log_all: boolean;
  allow_low: boolean;
};

// ── Default values ────────────────────────────────────────────────────────────

const ALL_APPS = [
  "Claude", "ChatGPT", "Gemini", "Copilot",
  "Cursor", "VS Code", "Windsurf", "Zed",
  "Antigravity", "Codex",
  "Terminal", "iTerm2", "Warp",
  "PyCharm", "IntelliJ IDEA", "WebStorm",
  "Slack", "Notion", "Discord",
  "Postman", "Insomnia",
];

const ALL_WEBSITES = [
  "chatgpt.com", "claude.ai", "gemini.google.com",
  "copilot.microsoft.com", "perplexity.ai",
  "poe.com", "you.com", "phind.com",
  "huggingface.co", "cohere.com",
  "anthropic.com", "openai.com", "mistral.ai",
  "groq.com", "together.ai", "replicate.com",
];

const DEFAULT_FLAGS: PolicyFlags = {
  clipboard_enabled: true,
  screenshot_enabled: true,
  live_monitor_enabled: false,
  file_upload_detection_enabled: false,
  monitored_apps: [...ALL_APPS],
  monitored_websites: [...ALL_WEBSITES],
  block_high_critical: true,
  warn_medium: true,
  auto_sanitize: true,
  log_all: true,
  allow_low: true,
};

// ── Policy definitions ────────────────────────────────────────────────────────

type PolicyDef = {
  id: keyof Pick<PolicyFlags,
    "clipboard_enabled" | "screenshot_enabled" |
    "live_monitor_enabled" | "file_upload_detection_enabled" |
    "block_high_critical" | "warn_medium" | "auto_sanitize" |
    "log_all" | "allow_low"
  >;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: "cyan" | "green" | "yellow" | "red" | "purple" | "orange";
  warning?: string;
  defaultOff?: boolean;
};

const MONITOR_POLICIES: PolicyDef[] = [
  {
    id: "screenshot_enabled",
    label: "Screenshot Monitoring",
    desc: "Analyses screenshots when the event occurs — Cmd+Shift+4 on macOS, Print Screen on Windows/Linux. Only fires on actual screenshot events.",
    icon: Camera,
    color: "cyan",
  },
  {
    id: "live_monitor_enabled",
    label: "Live Monitoring",
    desc: "Captures screen every 5 s continuously — targets AI tools and dev environments. High resource usage.",
    icon: Radio,
    color: "orange",
    warning: "High CPU usage. Disabled by default. Requires Screenshot Monitoring to be ON.",
    defaultOff: true,
  },
  {
    id: "clipboard_enabled",
    label: "Clipboard Monitoring",
    desc: "Monitors clipboard on every copy. Raises a threat when sensitive content is pasted into a monitored AI website or app.",
    icon: Clipboard,
    color: "cyan",
  },
  {
    id: "file_upload_detection_enabled",
    label: "File Upload Detection",
    desc: "Detects file uploads to monitored AI websites. Respects the Web Detection whitelist — whitelisted sites are excluded.",
    icon: Upload,
    color: "yellow",
    warning: "Monitors file upload events only on websites in your Web Detection list.",
    defaultOff: true,
  },
];

const BEHAVIOUR_POLICIES: PolicyDef[] = [
  {
    id: "block_high_critical",
    label: "Block High / Critical",
    desc: "Replace clipboard content with a redaction warning for HIGH & CRITICAL events",
    icon: ShieldAlert,
    color: "red",
  },
  {
    id: "warn_medium",
    label: "Warn on Medium",
    desc: "Partially mask MEDIUM-risk clipboard content while preserving context",
    icon: AlertTriangle,
    color: "yellow",
  },
  {
    id: "auto_sanitize",
    label: "Auto-Sanitize",
    desc: "Apply regex redaction before storing or displaying events in the dashboard",
    icon: Shield,
    color: "green",
  },
  {
    id: "log_all",
    label: "Log Everything",
    desc: "Persist all events (including LOW risk) to the local database audit trail",
    icon: Database,
    color: "purple",
  },
  {
    id: "allow_low",
    label: "Allow Low Risk",
    desc: "Pass LOW-risk clipboard content silently without any action",
    icon: Eye,
    color: "green",
  },
];

const COLOR_MAP = {
  cyan:   { active: "text-neon-cyan",   ring: "border-neon-cyan/20",   bg: "bg-neon-cyan",   chip: "bg-neon-cyan/10 border-neon-cyan/25 text-neon-cyan" },
  green:  { active: "text-neon-green",  ring: "border-neon-green/20",  bg: "bg-neon-green",  chip: "bg-neon-green/10 border-neon-green/25 text-neon-green" },
  yellow: { active: "text-neon-yellow", ring: "border-neon-yellow/20", bg: "bg-neon-yellow", chip: "bg-neon-yellow/10 border-neon-yellow/25 text-neon-yellow" },
  red:    { active: "text-neon-red",    ring: "border-neon-red/20",    bg: "bg-neon-red",    chip: "bg-neon-red/10 border-neon-red/25 text-neon-red" },
  purple: { active: "text-neon-purple", ring: "border-neon-purple/20", bg: "bg-neon-purple", chip: "bg-neon-purple/10 border-neon-purple/25 text-neon-purple" },
  orange: { active: "text-neon-orange", ring: "border-neon-orange/20", bg: "bg-neon-orange", chip: "bg-neon-orange/10 border-neon-orange/25 text-neon-orange" },
};

// ── Toggle component ──────────────────────────────────────────────────────────

function PolicyToggle({
  policy,
  value,
  onChange,
  disabled = false,
}: {
  policy: PolicyDef;
  value: boolean;
  onChange: (id: PolicyDef["id"], val: boolean) => void;
  disabled?: boolean;
}) {
  const { active, ring, bg } = COLOR_MAP[policy.color];
  const Icon = policy.icon;

  return (
    <motion.div
      layout
      className={cn(
        "rounded-xl p-3.5 border transition-all duration-300",
        value
          ? `bg-white/[0.025] ${ring}`
          : "bg-black/20 border-white/[0.03] opacity-55",
        disabled && "pointer-events-none opacity-30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div
            className={cn(
              "mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors",
              value ? `bg-white/[0.06]` : "bg-white/[0.02]"
            )}
          >
            <Icon className={cn("w-3 h-3", value ? active : "text-zinc-600")} />
          </div>
          <div className="min-w-0">
            <div
              className={cn(
                "text-[10px] font-semibold leading-tight mb-1",
                value ? "text-zinc-200" : "text-zinc-600"
              )}
            >
              {policy.label}
              {policy.defaultOff && (
                <span className="ml-1.5 text-[7px] text-zinc-600 bg-zinc-800/60 border border-white/[0.04] px-1.5 py-0.5 rounded font-mono tracking-wider">
                  OFF BY DEFAULT
                </span>
              )}
            </div>
            <div className={cn("text-[8px] font-mono leading-relaxed", value ? "text-zinc-500" : "text-zinc-700")}>
              {policy.desc}
            </div>
          </div>
        </div>

        {/* Toggle switch */}
        <motion.button
          onClick={() => onChange(policy.id, !value)}
          className={cn(
            "relative w-9 h-5 rounded-full transition-colors duration-300 shrink-0 mt-0.5",
            value ? bg : "bg-zinc-700/80"
          )}
          whileTap={{ scale: 0.93 }}
        >
          <motion.div
            animate={{ x: value ? 18 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute top-1 w-3 h-3 rounded-full bg-white shadow-md"
          />
        </motion.button>
      </div>

      {/* Warning banner */}
      <AnimatePresence>
        {policy.warning && value && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2.5 overflow-hidden"
          >
            <div className="flex items-start gap-1.5 bg-neon-orange/8 border border-neon-orange/20 rounded-lg px-2.5 py-2">
              <AlertTriangle className="w-2.5 h-2.5 text-neon-orange shrink-0 mt-px" />
              <span className="text-[8px] text-neon-orange/80 font-mono leading-relaxed">
                {policy.warning}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  icon: Icon,
  badge,
}: {
  label: string;
  icon: React.ElementType;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-3 h-3 text-zinc-500" />
      <span className="text-[9px] text-zinc-500 uppercase tracking-[0.18em] font-mono">{label}</span>
      {badge && (
        <span className="ml-auto text-[8px] font-mono text-zinc-600 bg-zinc-800/40 border border-white/[0.04] px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Multi-Select chips component ──────────────────────────────────────────────

function MultiSelectChips({
  allItems,
  selected,
  onSelectionChange,
  color = "cyan",
  collapsed = false,
}: {
  allItems: string[];
  selected: string[];
  onSelectionChange: (items: string[]) => void;
  color?: "cyan" | "green" | "yellow";
  collapsed?: boolean;
}) {
  const toggle = (item: string) => {
    if (selected.includes(item)) {
      onSelectionChange(selected.filter((s) => s !== item));
    } else {
      onSelectionChange([...selected, item]);
    }
  };

  const allSelected = selected.length === allItems.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSelectionChange(allSelected ? [] : [...allItems])}
          className={cn(
            "flex items-center gap-1 text-[8px] font-mono px-2 py-1 rounded-lg border transition-all",
            allSelected
              ? "bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan"
              : "border-white/[0.06] text-zinc-600 hover:text-zinc-400"
          )}
        >
          {allSelected ? <CheckSquare className="w-2.5 h-2.5" /> : <Square className="w-2.5 h-2.5" />}
          {allSelected ? "Deselect All" : "Select All"}
        </button>
        <span className="text-[8px] text-zinc-700 font-mono">
          {selected.length}/{allItems.length} monitored
        </span>
      </div>
      {!collapsed && (
        <div className="flex flex-wrap gap-1.5">
          {allItems.map((item) => {
            const isSelected = selected.includes(item);
            return (
              <motion.button
                key={item}
                onClick={() => toggle(item)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "text-[8px] font-mono px-2 py-1 rounded-lg border transition-all duration-200",
                  isSelected
                    ? COLOR_MAP[color].chip
                    : "border-white/[0.04] text-zinc-700 bg-black/20 hover:text-zinc-500 hover:border-white/[0.08]"
                )}
              >
                {isSelected ? "✓ " : ""}{item}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  badge,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 mb-2 group"
      >
        <Icon className="w-3 h-3 text-zinc-500" />
        <span className="text-[9px] text-zinc-500 uppercase tracking-[0.18em] font-mono">{title}</span>
        {badge && (
          <span className="ml-1 text-[8px] font-mono text-zinc-600 bg-zinc-800/40 border border-white/[0.04] px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
        <span className="ml-auto text-zinc-700 group-hover:text-zinc-500 transition-colors">
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PolicyControl() {
  const [flags, setFlags] = useState<PolicyFlags>(DEFAULT_FLAGS);
  const [synced, setSynced] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  // Load from backend on mount
  useEffect(() => {
    fetch("http://localhost:8001/api/policies")
      .then((r) => r.json())
      .then((data) => {
        setFlags({
          ...DEFAULT_FLAGS,
          ...data,
          monitored_apps: Array.isArray(data.monitored_apps) ? data.monitored_apps : DEFAULT_FLAGS.monitored_apps,
          monitored_websites: Array.isArray(data.monitored_websites) ? data.monitored_websites : DEFAULT_FLAGS.monitored_websites,
        });
        setSynced(true);
      })
      .catch(() => setSynced(false));
  }, []);

  const saveToBackend = useCallback(async (payload: Partial<PolicyFlags>) => {
    setSaving(true);
    try {
      const res = await fetch("http://localhost:8001/api/policies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const updated = await res.json();
      setFlags((prev) => ({
        ...prev,
        ...updated,
        monitored_apps: Array.isArray(updated.monitored_apps) ? updated.monitored_apps : prev.monitored_apps,
        monitored_websites: Array.isArray(updated.monitored_websites) ? updated.monitored_websites : prev.monitored_websites,
      }));
      setSynced(true);
    } catch {
      setSynced(false);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleToggle = useCallback(
    async (id: PolicyDef["id"], value: boolean) => {
      setFlags((prev) => ({ ...prev, [id]: value }));
      const payload: Partial<PolicyFlags> = { [id]: value };
      // live_monitor requires screenshot_enabled
      if (id === "live_monitor_enabled" && value) {
        payload.screenshot_enabled = true;
        setFlags((prev) => ({ ...prev, screenshot_enabled: true }));
      }
      await saveToBackend(payload);
    },
    [saveToBackend]
  );

  const handleAppsChange = useCallback(
    async (apps: string[]) => {
      setFlags((prev) => ({ ...prev, monitored_apps: apps }));
      await saveToBackend({ monitored_apps: apps });
    },
    [saveToBackend]
  );

  const handleWebsitesChange = useCallback(
    async (sites: string[]) => {
      setFlags((prev) => ({ ...prev, monitored_websites: sites }));
      await saveToBackend({ monitored_websites: sites });
    },
    [saveToBackend]
  );

  return (
    <div className="glass rounded-xl border border-white/[0.04] h-full flex flex-col p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-zinc-800/40 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-[0.15em] font-mono font-semibold">
            Policy Engine
          </span>
        </div>

        {/* Sync status */}
        <div className="flex items-center gap-1.5">
          {saving ? (
            <Loader2 className="w-3 h-3 text-neon-cyan animate-spin" />
          ) : synced === true ? (
            <Wifi className="w-3 h-3 text-neon-green" />
          ) : synced === false ? (
            <WifiOff className="w-3 h-3 text-neon-red" />
          ) : (
            <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />
          )}
          <span
            className={cn(
              "text-[8px] font-mono",
              saving
                ? "text-neon-cyan"
                : synced === true
                ? "text-neon-green"
                : synced === false
                ? "text-neon-red"
                : "text-zinc-600"
            )}
          >
            {saving ? "Saving…" : synced === true ? "Synced" : synced === false ? "Offline" : "Loading"}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pr-0.5">

        {/* ── Monitoring Events section ───────────────────────────── */}
        <CollapsibleSection title="Monitoring Events" icon={Radio} defaultOpen={true}>
          <div className="space-y-2">
            {MONITOR_POLICIES.map((p) => (
              <PolicyToggle
                key={p.id}
                policy={p}
                value={flags[p.id] as boolean}
                onChange={handleToggle}
                disabled={
                  p.id === "live_monitor_enabled" && !flags.screenshot_enabled
                }
              />
            ))}
          </div>
        </CollapsibleSection>

        {/* ── App Detection section ───────────────────────────────── */}
        <CollapsibleSection
          title="App Detection"
          icon={Monitor}
          badge={`${flags.monitored_apps.length} active`}
          defaultOpen={true}
        >
          <div className="rounded-xl p-3 bg-black/20 border border-white/[0.04] space-y-2">
            <p className="text-[8px] text-zinc-600 font-mono leading-relaxed">
              Selected apps are <span className="text-neon-cyan">monitored</span>. Deselect to whitelist an app — events from whitelisted apps will be suppressed.
            </p>
            <MultiSelectChips
              allItems={ALL_APPS}
              selected={flags.monitored_apps}
              onSelectionChange={handleAppsChange}
              color="cyan"
            />
          </div>
        </CollapsibleSection>

        {/* ── Web Detection section ───────────────────────────────── */}
        <CollapsibleSection
          title="Web Detection"
          icon={Globe}
          badge={`${flags.monitored_websites.length} active`}
          defaultOpen={true}
        >
          <div className="rounded-xl p-3 bg-black/20 border border-white/[0.04] space-y-2">
            <p className="text-[8px] text-zinc-600 font-mono leading-relaxed">
              Selected websites are <span className="text-neon-cyan">monitored</span>. Deselect to whitelist — clipboard, screenshot, and file upload events will be suppressed for whitelisted sites.
            </p>
            <MultiSelectChips
              allItems={ALL_WEBSITES}
              selected={flags.monitored_websites}
              onSelectionChange={handleWebsitesChange}
              color="cyan"
            />
          </div>
        </CollapsibleSection>

        {/* ── Response Behaviour section ──────────────────────────── */}
        <CollapsibleSection title="Response Behaviour" icon={ShieldAlert} defaultOpen={false}>
          <div className="space-y-2">
            {BEHAVIOUR_POLICIES.map((p) => (
              <PolicyToggle
                key={p.id}
                policy={p}
                value={flags[p.id] as boolean}
                onChange={handleToggle}
              />
            ))}
          </div>
        </CollapsibleSection>

      </div>

      {/* Reset to defaults */}
      <button
        onClick={async () => {
          setSaving(true);
          try {
            const res = await fetch("http://localhost:8001/api/policies", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(DEFAULT_FLAGS),
            });
            const updated = await res.json();
            setFlags({
              ...DEFAULT_FLAGS,
              ...updated,
              monitored_apps: Array.isArray(updated.monitored_apps) ? updated.monitored_apps : DEFAULT_FLAGS.monitored_apps,
              monitored_websites: Array.isArray(updated.monitored_websites) ? updated.monitored_websites : DEFAULT_FLAGS.monitored_websites,
            });
            setSynced(true);
          } catch {
            setSynced(false);
          } finally {
            setSaving(false);
          }
        }}
        className="mt-3 shrink-0 w-full py-2 rounded-lg text-[9px] font-mono text-zinc-600 border border-white/[0.04] hover:bg-white/[0.03] hover:text-zinc-400 transition-all duration-200 flex items-center justify-center gap-1.5"
      >
        <Trash2 className="w-3 h-3" />
        Reset to Defaults
      </button>
    </div>
  );
}
