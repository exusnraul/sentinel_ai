# Sentinel AI — Frontend Architecture

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Design System](#3-design-system)
4. [Component Tree](#4-component-tree)
5. [Component Details](#5-component-details)
6. [Data Flow](#6-data-flow)
7. [State Management](#7-state-management)
8. [Animations](#8-animations)
9. [Theming & CSS](#9-theming--css)
10. [Build & Run](#10-build--run)

---

## 1. Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.2.6 | React framework (App Router) |
| **React** | 19.2.4 | UI library |
| **TypeScript** | ^5 | Type safety |
| **Tailwind CSS** | ^4 | Utility-first CSS framework |
| **Framer Motion** | ^12.38 | Declarative animations |
| **Recharts** | ^3.8.1 | Charting library |
| **Lucide React** | ^1.14 | Icon library (crisp SVG icons) |
| **clsx** | ^2.1.1 | Conditional class joining |
| **tailwind-merge** | ^3.6 | Smart Tailwind class merging |

### Key Decisions

- **Next.js App Router** over Pages Router for the latest React patterns and layout system.
- **Tailwind v4** (not v3) — uses `@import "tailwindcss"` and `@theme` directives instead of `@tailwind base/components/utilities`.
- **No state management library** — WebSocket-driven real-time data makes local React state (`useState`) sufficient.
- **No CSS-in-JS** — Tailwind's utility classes + CSS custom properties cover all styling needs.

---

## 2. Project Structure

```
frontend/
├── public/                     # Static assets
├── src/
│   ├── app/
│   │   ├── globals.css         # Global styles, Tailwind config, animations
│   │   ├── layout.tsx          # Root layout (fonts, metadata)
│   │   └── page.tsx            # Entry point → renders <Dashboard />
│   ├── components/
│   │   ├── Dashboard.tsx       # Main dashboard orchestration
│   │   ├── ThreatRadar.tsx     # SVG radar visualization
│   │   ├── ActivityFeed.tsx    # Real-time event stream
│   │   ├── LatestAlert.tsx     # Prominent alert card
│   │   ├── RiskTrend.tsx       # Area chart (risk over time)
│   │   ├── SanitizePanel.tsx   # Original → Sanitized content
│   │   ├── PolicyControl.tsx   # Toggle-based policy switches
│   │   └── ArchitectureDiagram.tsx  # System architecture graph
│   └── lib/
│       └── utils.ts            # Shared utilities (cn, timeAgo, riskColors)
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── eslint.config.mjs
```

---

## 3. Design System

### Color Palette

Colors are defined in `globals.css` using Tailwind v4's `@theme` directive:

| Token | Hex | Usage |
|---|---|---|
| `--color-cyber-900` | `#060a12` | Primary background |
| `--color-cyber-800` | `#0c1320` | Secondary background |
| `--color-cyber-700` | `#111b2e` | Elevated surface |
| `--color-cyber-600` | `#1a2744` | Border / subtle surfaces |
| `--color-neon-cyan` | `#00e5ff` | Primary accent, active states |
| `--color-neon-blue` | `#0088ff` | Secondary accent |
| `--color-neon-green` | `#00ff88` | Safe / low risk |
| `--color-neon-red` | `#ff2244` | Critical / danger |
| `--color-neon-orange` | `#ff6600` | High risk |
| `--color-neon-yellow` | `#ffcc00` | Medium risk / warning |
| `--color-neon-purple` | `#8844ff` | AI / analysis accent |

### Typography

- **Primary font:** Inter (sans-serif) via `next/font/google`
- **Monospace font:** JetBrains Mono via `next/font/google`
- Applied as CSS variables `--font-inter` and `--font-mono`
- Monospace used for: numbers, badges, labels, code, timestamps
- Sans-serif used for: body text, headings, navigation

### Glass Morphism

All cards use the `glass` utility class:
```css
background: rgba(6, 10, 18, 0.7);
backdrop-filter: blur(24px);
border: 1px solid rgba(255, 255, 255, 0.06);
box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
```
A stronger variant `glass-strong` is used for the sidebar.

### Glow Effects

Text glows (`glow-cyan`, `glow-red`, etc.) and border glows (`glow-border-cyan`) use `text-shadow` and `box-shadow` with the neon color at various opacities.

### Background

The page has a subtle multi-radial-gradient background:
```css
background-image:
  radial-gradient(ellipse 70% 40% at 50% -10%, rgba(0, 140, 255, 0.06) 0%, transparent 60%),
  radial-gradient(ellipse 50% 30% at 80% 90%, rgba(0, 255, 136, 0.03) 0%, transparent 50%),
  radial-gradient(ellipse 40% 30% at 20% 85%, rgba(136, 68, 255, 0.03) 0%, transparent 50%);
```
Plus a `.grid-bg` utility with subtle cyan grid lines.

---

## 4. Component Tree

```
<RootLayout>                      # layout.tsx
  └── <Dashboard>                 # Dashboard.tsx — "use client"
        ├── <aside>               # Sidebar
        │   ├── Logo + Sentinel AI brand
        │   ├── Navigation (2 sections, 6 items)
        │   ├── Protection guards (4 items with status)
        │   ├── 100% LOCAL badge
        │   └── Connection status
        ├── <header>              # Top bar
        │   ├── Title + live clock
        │   ├── Scan/Threat/Safe counters
        │   ├── LIVE indicator
        │   └── Notification bell
        └── <main>                # Content area
              ├── Status Banner (critical only)
              ├── Stats Cards (4)
              ├── Row 2
              │   ├── <ThreatRadar />
              │   ├── <LatestAlert />
              │   └── <RiskTrend />
              └── Row 3
                    ├── <ActivityFeed />
                    ├── AI Analysis panel (inline)
                    ├── <SanitizePanel />
                    └── <PolicyControl />
```

---

## 5. Component Details

### Dashboard.tsx (Orchestrator)

- **Type:** Client component (`"use client"`)
- **State:**
  - `events: ThreatEvent[]` — All WebSocket events (max 100)
  - `connected: boolean` — WebSocket status
  - `activeNav: string` — Active sidebar item
  - `scanCount: number` — Total events received
  - `sidebarCollapsed: boolean` — Collapsible sidebar
  - `time: Date` — Live clock (updates every second)
- **Derived data:** `critical`, `high`, `medium`, `low`, `threats`, `overallRisk`
- **WebSocket:** Connects to `ws://localhost:8000/ws`, auto-reconnects every 3s
- **Layout:** CSS Grid — sidebar (fixed width) + main (flex-1), content uses 12-column grid

### ThreatRadar.tsx

- **Type:** SVG-based radar visualization
- **Props:** `riskLevel: RiskLevel`
- **Features:**
  - 3 concentric rings (outer solid, middle dashed, inner finer dashed)
  - Crosshair lines + 12 tick marks
  - Animated sweep wedge (rotation speed varies by risk level)
  - Pulse ring animations (2 rings for non-LOW states)
  - Blip dots at random radar positions
  - Central score label with glow
- **Animation:** Framer Motion `animate` prop for sweep rotation, pulse rings, and blip opacity

### ActivityFeed.tsx

- **Type:** Scrollable event list
- **Props:** `events: ThreatEvent[]`
- **Features:**
  - AnimatePresence for mount/unmount transitions
  - Left accent color bar (matches risk level)
  - First item gets a cyan ring highlight + "NEW" badge
  - Source icon (clipboard/camera)
  - Relative timestamps via `timeAgo()`
- **Empty state:** Pulsing dot with "LISTENING" text

### LatestAlert.tsx

- **Type:** Prominent alert card
- **Props:** `event: ThreatEvent | null`
- **Features:**
  - Animated gradient bar on top for critical alerts
  - Show/hide redacted content toggle (Eye icon)
  - Risk level badge with live pulsing indicator
  - Recommendation with arrow prefix
  - 3 action buttons: Investigate / Dismiss / Block
- **Empty state:** Shield icon with "ALL CLEAR"

### RiskTrend.tsx

- **Type:** Recharts AreaChart
- **Props:** `events: ThreatEvent[]`
- **Features:**
  - Maps risk levels to numeric scores (CRITICAL=100 → LOW=20)
  - Shows last 30 events (reversed order)
  - Custom gradient fill (cyan to transparent)
  - Custom tooltip with risk level label
  - Active dot on hover
- **Empty state:** Small dot with "NO DATA"

### SanitizePanel.tsx

- **Type:** Content comparison panel
- **Props:** `event: ThreatEvent | null`
- **Features:**
  - Show/hide original content (obscured by default)
  - Gradient divider with animated arrow between original/sanitized
  - Sanitized preview in green-tinted box
  - "Copy Sanitized Text" button with success state
- **Empty state:** Lock icon with "No Event Selected"

### PolicyControl.tsx

- **Type:** Toggle switches for DLP policies
- **Props:** None (self-contained state)
- **Features:**
  - 5 policy toggles (Block Critical, Warn Medium, Auto-Sanitize, Log All, Allow Low)
  - Each toggle is a card with description text
  - Disabled toggles have reduced opacity
  - Spring-animated toggle switch
  - "Custom Rule" button at bottom

---

## 6. Data Flow

```
Backend Services                    Frontend
─────────────────                   ────────
Clipboard Monitor ─┐
Screenshot Monitor ─┤  → WebSocket  →  Dashboard.tsx
                   │  ws://:8000/ws     │
Risk Engine        ─┘                   │
AI Engine                                │
Sanitizer                                ▼
                                    events[] state
                                         │
                           ┌─────────────┼─────────────┐
                           ▼             ▼             ▼
                     ActivityFeed   LatestAlert   RiskTrend
                                         │
                                    SanitizePanel
```

1. Backend monitors clipboard & screenshots
2. Text is analyzed by Risk Engine + AI Engine
3. Result is broadcast as JSON via WebSocket to all connected clients
4. Dashboard receives the event and prepends it to `events[]` (max 100)
5. All child components re-render with the new data
6. Risk levels from events are derived into stats counts

### ThreatEvent Type

```typescript
type ThreatEvent = {
  id: string;
  timestamp: number;       // Unix seconds
  source: string;          // "clipboard" | "screenshot"
  original_content: string;
  original_content_length: number;
  sanitized_content: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;      // 0.0 - 1.0
  category: string;        // e.g. "AWS_CREDENTIALS", "PII"
  reason: string;
  recommended_action: string;
};
```

---

## 7. State Management

There is **no external state management library**. The app uses:

- **`useState`** — Component-local state (events, connected, toggles, etc.)
- **`useRef`** — Mutable ref for WebSocket instance
- **`useEffect`** — WebSocket lifecycle, clock timer

State flows one way: `Dashboard` owns `events[]` and passes slices/filters to children as props. The `PolicyControl` panel is fully self-contained with local state (policies reset on page reload, which is acceptable for MVP).

---

## 8. Animations

All animations use **Framer Motion** (`framer-motion`):

### Mount / Exit Animations
- Stats cards: `initial={{ opacity: 0, y: 20 }}` with staggered delay
- Content row sections: `initial={{ opacity: 0, y: 20 }}` with `transition.delay`
- Latest alert: `initial={{ opacity: 0, scale: 0.97 }}`
- Activity items: slide in from left with height transition

### Continuous Animations
- **Threat Radar sweep:** `animate={{ rotate: 360 }}` (speed varies by risk level)
- **Pulse rings:** `animate={{ scale: [1, 2.2, 1], opacity: [0.3, 0, 0.3] }}`
- **Blip dots:** Oscillating opacity and radius
- **Sidebar logo:** Breathing glow `scale: [1, 1.15, 1]`
- **LIVE indicators:** `opacity: [1, 0.3, 1]`
- **Status dots:** `animate-ping` CSS animation (Tailwind)
- **Critical alert bar:** Gradient position animation

### Interaction Animations
- **Toggle switches:** Spring animation (`type: "spring"`, `stiffness: 500`)
- **Buttons:** `whileHover`, `whileTap` scale transforms
- **Nav indicator:** `layoutId` shared layout animation
- **Hover states:** CSS `transition-all duration-200`

### CSS Keyframe Animations (in globals.css)

| Name | Purpose |
|---|---|
| `scanline` | CRT scanline effect |
| `radar-sweep` | Radar rotation |
| `pulse-ring` | Expanding ring |
| `data-stream` | Moving data line |
| `blink-cursor` | Blinking cursor |
| `breathe` | Gentle opacity oscillation |
| `slide-up` | Content entrance |
| `status-pulse` | Pulsing glow ring on status indicators |

---

## 9. Theming & CSS

### File: `src/app/globals.css`

This is the **only CSS file** (besides Tailwind). It contains:

1. **`@import "tailwindcss"`** — Tailwind v4 entry
2. **`@theme` block** — Custom design tokens (colors, fonts)
3. **`@layer base`** — Global resets, body background (radial gradients), scrollbar
4. **`@utility` directives** — Reusable utility classes:

| Utility | Effect |
|---|---|
| `glass` | Frosted glass panel |
| `glass-strong` | Stronger glass (sidebar) |
| `glow-cyan/red/green/yellow/orange` | Text glow (text-shadow) |
| `glow-border-cyan/red/green` | Border glow (box-shadow) |
| `grid-bg` | Subtle grid pattern overlay |

### Tailwind Usage Patterns

- All colors use the custom `neon-*` tokens: `text-neon-cyan`, `bg-neon-red/10`
- Spacing uses Tailwind's scale: `p-5`, `gap-4`, `m-2`
- Layout uses flexbox + CSS Grid (`grid-cols-12`)
- Transparency via opacity modifiers: `border-white/[0.04]`
- Animation via `animate-pulse` (Tailwind) + custom keyframes

### Custom Utilities (in `src/lib/utils.ts`)

```typescript
cn(...inputs)           // clsx + tailwind-merge for conditional classes
timeAgo(timestamp)      // "just now", "34s ago", "2h ago", etc.
formatNumber(n)         // Locale-formatted numbers
riskColors              // Object mapping RiskLevel → Tailwind class strings
```

---

## 10. Build & Run

### Development

```bash
cd frontend
npm install        # Already done
npm run dev        # → http://localhost:3000
```

### Production Build

```bash
npm run build      # Compiles + TypeScript checks
npm run start      # Serves production build
```

### Linting

```bash
npx eslint src/    # ESLint with @typescript-eslint rules
```

The project enforces:
- No `any` types (one exception: Recharts tooltip)
- No unused variables
- Strict TypeScript (`strict: true` in tsconfig)

---

## Appendix: File Index

| File | Lines | Purpose |
|---|---|---|
| `src/app/globals.css` | ~140 | Global styles, theme tokens, utilities |
| `src/app/layout.tsx` | 35 | Root HTML, fonts, metadata |
| `src/app/page.tsx` | 5 | Entry point |
| `src/lib/utils.ts` | 55 | Utilities (`cn`, `timeAgo`, etc.) |
| `src/components/Dashboard.tsx` | ~320 | Main orchestrator |
| `src/components/ThreatRadar.tsx` | ~150 | SVG radar |
| `src/components/ActivityFeed.tsx` | ~150 | Event stream |
| `src/components/LatestAlert.tsx` | ~160 | Alert card |
| `src/components/RiskTrend.tsx` | ~100 | Trend chart |
| `src/components/SanitizePanel.tsx` | ~130 | Sanitize panel |
| `src/components/PolicyControl.tsx` | ~95 | Policy toggles |
| `src/components/ArchitectureDiagram.tsx` | ~80 | Architecture graph |
