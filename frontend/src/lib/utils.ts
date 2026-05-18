import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts)
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US")
}

export const riskColors = {
  CRITICAL: {
    text: "text-neon-red",
    bg: "bg-neon-red/10",
    border: "border-neon-red/30",
    badge: "bg-neon-red/15 text-neon-red border border-neon-red/30",
    glow: "glow-red",
    bar: "bg-neon-red",
    dot: "bg-neon-red",
    ring: "ring-neon-red/30",
  },
  HIGH: {
    text: "text-neon-orange",
    bg: "bg-neon-orange/10",
    border: "border-neon-orange/30",
    badge: "bg-neon-orange/15 text-neon-orange border border-neon-orange/30",
    glow: "glow-orange",
    bar: "bg-neon-orange",
    dot: "bg-neon-orange",
    ring: "ring-neon-orange/30",
  },
  MEDIUM: {
    text: "text-neon-yellow",
    bg: "bg-neon-yellow/10",
    border: "border-neon-yellow/30",
    badge: "bg-neon-yellow/15 text-neon-yellow border border-neon-yellow/30",
    glow: "glow-yellow",
    bar: "bg-neon-yellow",
    dot: "bg-neon-yellow",
    ring: "ring-neon-yellow/30",
  },
  LOW: {
    text: "text-neon-green",
    bg: "bg-neon-green/10",
    border: "border-neon-green/30",
    badge: "bg-neon-green/15 text-neon-green border border-neon-green/30",
    glow: "glow-green",
    bar: "bg-neon-green",
    dot: "bg-neon-green",
    ring: "ring-neon-green/30",
  },
} as const
