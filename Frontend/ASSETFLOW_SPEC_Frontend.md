# AssetFlow — Enterprise Asset Management System
## Premium UI Specification — Glassmorphism + Vibrant Design Language

---

## 🎯 VISION

AssetFlow is an enterprise asset management platform that looks and feels like a **₹2 Crore design agency built it** — not a hackathon project. It blends **glassmorphism depth**, **vibrant accent gradients**, and **data-dense precision** into a UI that makes judges stop scrolling and start exploring.

The design draws from Apple's visionOS spatial UI, Linear's speed, and Stripe's data clarity — then layers in frosted glass, animated gradients, and micro-interactions that make every click feel intentional.

---

## TECH STACK (Mandatory)

- **Framework:** Next.js 15 with App Router (TypeScript strict mode)
- **UI Library:** shadcn/ui (latest) — heavily customized tokens
- **Styling:** Tailwind CSS v4 + CSS variables for theming
- **Theme Switching:** next-themes (flicker-free light/dark mode)
- **Icons:** Lucide React (consistent 20px stroke-width 1.5)
- **Charts:** Recharts (analytics/dashboard)
- **Calendar:** react-day-picker (booking calendar views)
- **Animations:** Framer Motion (micro-interactions + presence animations)
- **State Management:** Zustand (with persist middleware for demo continuity)
- **Forms:** React Hook Form + Zod validation
- **Tables:** TanStack Table v8 (data-heavy views)
- **Date Handling:** date-fns
- **Toast/Notifications:** Sonner (positioned top-right, glass-styled)
- **Font:** Inter (variable weight) via next/font/google
- **Additional:** clsx + tailwind-merge (via cn()), vaul (drawer for mobile)

---

## DESIGN PHILOSOPHY — "Frosted Depth"

The UI has **three visual layers** creating a sense of spatial depth:

1. **Background Layer** — Animated gradient mesh (subtle, alive)
2. **Surface Layer** — Solid cards, tables, content areas (clean, readable)
3. **Floating Layer** — Glass elements that hover above (navigation, modals, tooltips, quick actions)

This layering makes the app feel three-dimensional without any 3D rendering.

### Glassmorphism Usage Map:

| Element | Glass Level | Why |
|---------|-------------|-----|
| Sidebar | Heavy glass | Floats over content, always visible |
| Top Bar (on scroll) | Medium glass | Becomes frosted as content scrolls behind |
| Command Palette ⌘K | Heavy glass | Overlay, demands attention |
| Modals/Dialogs | Medium glass | Elevated above page |
| Login/Signup Card | Heavy glass | Hero element, first impression |
| KPI Cards (Dashboard) | Subtle glass | Adds dimension without competing with data |
| Notification Dropdown | Heavy glass | Floating overlay |
| Tooltips | Subtle glass | Quick info popover |
| Context Menus | Medium glass | Right-click/dropdown menus |
| Quick Action Pills | Subtle glass | Dashboard action buttons |
| Floating Action Button (mobile) | Heavy glass | Primary action on mobile |
| Toast Notifications | Subtle glass | Non-intrusive overlays |
| Date Picker Popover | Medium glass | Calendar dropdown |
| Search Suggestions | Medium glass | Autocomplete dropdown |
| Kanban Card (on drag) | Heavy glass | Lifted state while dragging |

### Where NEVER to use glass:
- ❌ Data tables (readability is sacred)
- ❌ Form input fields (contrast needed for typing)
- ❌ Inline text content (body copy areas)
- ❌ Status badges (too small, needs solid color)
- ❌ Charts/graphs (data visualization must be clear)

---

## GLASSMORPHISM SYSTEM (Tailwind Utility Classes)

```css
/* ===== GLASS UTILITIES ===== */

/* Light Glass — for subtle floating elements */
.glass-light {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

/* Medium Glass — for sidebars, dropdowns */
.glass-medium {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: 
    0 4px 24px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* Heavy Glass — for modals, command palette, login card */
.glass-heavy {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 
    0 8px 40px rgba(0, 0, 0, 0.06),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

/* Colored Glass — for accent elements (indigo tinted) */
.glass-accent {
  background: rgba(99, 102, 241, 0.08);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(99, 102, 241, 0.15);
}

/* ===== DARK MODE GLASS ===== */
.dark .glass-light {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.dark .glass-medium {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 4px 24px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.dark .glass-heavy {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    0 8px 40px rgba(0, 0, 0, 0.3),
    0 2px 8px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.dark .glass-accent {
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

/* ===== ANIMATED BACKGROUND MESH ===== */
.gradient-mesh {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.gradient-mesh::before,
.gradient-mesh::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  animation: float 20s ease-in-out infinite;
}

.gradient-mesh::before {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, hsl(238 84% 60% / 0.06) 0%, transparent 70%);
  top: -10%;
  left: -5%;
  animation-delay: 0s;
}

.gradient-mesh::after {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, hsl(217 91% 60% / 0.05) 0%, transparent 70%);
  bottom: -10%;
  right: -5%;
  animation-delay: -10s;
}

/* Third blob via additional element */
.gradient-blob-3 {
  position: fixed;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, hsl(160 84% 39% / 0.04) 0%, transparent 70%);
  filter: blur(80px);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: float 25s ease-in-out infinite reverse;
  pointer-events: none;
  z-index: 0;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}

/* Dark mode: more vibrant blobs */
.dark .gradient-mesh::before {
  opacity: 0.8;
  background: radial-gradient(circle, hsl(238 84% 60% / 0.1) 0%, transparent 70%);
}

.dark .gradient-mesh::after {
  opacity: 0.8;
  background: radial-gradient(circle, hsl(217 91% 60% / 0.08) 0%, transparent 70%);
}
```


---

## COLOR SYSTEM

```css
:root {
  /* ===== BASE ===== */
  --background: 220 20% 97%;          /* Warm off-white (glass needs this) */
  --foreground: 222 47% 11%;          /* Deep navy text */
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 46%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --border: 220 13% 91%;
  --input: 220 13% 91%;
  --ring: 238 84% 60%;
  --radius: 0.75rem;

  /* ===== BRAND ===== */
  --primary: 238 84% 60%;             /* Indigo-600 */
  --primary-foreground: 0 0% 100%;
  --secondary: 220 14% 96%;
  --secondary-foreground: 220 9% 46%;
  --accent: 238 84% 60% / 0.08;       /* Indigo tint for glass-accent */
  --accent-foreground: 238 84% 40%;

  /* ===== SEMANTIC ===== */
  --success: 160 84% 39%;
  --success-light: 160 84% 39% / 0.1;
  --warning: 38 92% 50%;
  --warning-light: 38 92% 50% / 0.1;
  --destructive: 0 84% 60%;
  --destructive-light: 0 84% 60% / 0.1;
  --info: 217 91% 60%;
  --info-light: 217 91% 60% / 0.1;

  /* ===== GRADIENT ACCENTS (for buttons, highlights) ===== */
  --gradient-primary: linear-gradient(135deg, hsl(238 84% 60%) 0%, hsl(250 84% 55%) 100%);
  --gradient-success: linear-gradient(135deg, hsl(160 84% 39%) 0%, hsl(160 74% 35%) 100%);
  --gradient-warm: linear-gradient(135deg, hsl(38 92% 50%) 0%, hsl(25 95% 53%) 100%);
}

.dark {
  --background: 222 47% 5%;           /* Near-black navy */
  --foreground: 213 31% 91%;
  --muted: 223 47% 10%;
  --muted-foreground: 215 20% 65%;
  --card: 222 47% 7%;
  --card-foreground: 213 31% 91%;
  --border: 216 34% 15%;
  --input: 216 34% 15%;
  --ring: 238 84% 67%;

  --primary: 238 84% 67%;
  --primary-foreground: 0 0% 100%;
  --secondary: 223 47% 10%;
  --secondary-foreground: 215 20% 65%;
  --accent: 238 84% 67% / 0.12;
  --accent-foreground: 238 84% 80%;

  --success: 160 84% 45%;
  --warning: 38 92% 55%;
  --destructive: 0 63% 55%;
  --info: 217 91% 65%;

  --gradient-primary: linear-gradient(135deg, hsl(238 84% 67%) 0%, hsl(250 84% 62%) 100%);
}
```

### Vibrant Color Accents — Where to Pop:
- Primary CTA buttons use `--gradient-primary` (not flat color)
- Active sidebar item has indigo glow (`box-shadow: 0 0 12px hsl(var(--primary) / 0.3)`)
- Success toasts have green left-border accent
- Critical alerts pulse with red glow
- Chart lines use gradient strokes
- The login button glows subtly on hover

---

## TYPOGRAPHY

```
Hero:      text-4xl (36px) font-bold tracking-tight       — Login page headline
Display:   text-2xl (24px) font-semibold tracking-tight   — Page titles  
Heading:   text-lg (18px) font-semibold                   — Section headers
Subhead:   text-base (16px) font-medium                   — Card titles
Body:      text-sm (14px) font-normal                     — Default everywhere
Caption:   text-xs (12px) font-medium text-muted-foreground — Meta info
Tiny:      text-[11px] font-medium uppercase tracking-wider — Section labels, sidebar groups
```

---

## COMPONENT DESIGN LANGUAGE

### Sidebar Navigation (HEAVY GLASS)
- Fixed left, 260px width, full viewport height
- **Glass:** `glass-medium` class — frosted, semi-transparent, content scrolls behind it
- Logo area: AssetFlow icon + wordmark at top, `h-16` with bottom border
- Nav groups separated by `text-[11px] uppercase tracking-wider text-muted-foreground/60` labels
- Nav items: `text-sm font-normal`, `rounded-lg`, `px-3 py-2`, `gap-3` (icon + text)
- **Active state:** `bg-primary/10 text-primary font-medium` + left 3px indigo bar (rounded) + subtle indigo glow shadow
- **Hover state:** `bg-white/20 dark:bg-white/5` (glass highlight)
- Bottom: User card — avatar (32px, ring on online) + name + role badge + settings gear icon
- Collapse: On `< 1024px` → icon-only mode (48px width), tooltip on hover for labels
- Mobile: Drawer from left (vaul), glass overlay

### Top Bar (GLASS ON SCROLL)
- `h-14`, `sticky top-0 z-40`
- **Default (at top):** Transparent background, no border
- **On scroll (>20px):** Transitions to `glass-medium` + `border-b border-border/30` (smooth 200ms)
- Left: Dynamic breadcrumb (Home > Assets > MacBook Pro #A1234)
- Right section:
  - Search pill: `glass-light rounded-full px-3 py-1.5` with search icon + "Search... ⌘K" text
  - Notification bell: Icon with red dot badge (unread count) — click → glass dropdown
  - Theme toggle: Animated sun↔moon morph (Framer Motion `layoutId`)
  - User avatar: 28px circle, click → glass dropdown menu

### KPI Cards (GLASS — Dashboard)
- `glass-light` background with colored left accent border (3px, rounded-full)
- Layout: Icon top-left (20px, muted) → Number (text-2xl font-bold) → Label (text-xs muted) → Trend badge bottom
- Trend: Green "↑ 12%" or Red "↓ 5%" with tiny arrow icon
- **Hover:** `translate-y-[-2px]` + shadow increase + border color intensifies
- **Mount animation:** Stagger fade-up (50ms between each), number counts up from 0

### Buttons
- **Primary:** `bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-lg h-9 px-4 text-sm font-medium`
  - Hover: brightness increase + subtle glow `shadow-lg shadow-indigo-500/25`
  - Press: `scale-[0.97]` (60ms)
- **Secondary (Glass):** `glass-light rounded-lg h-9 px-4 text-sm font-medium text-foreground`
  - Hover: border becomes visible, slight bg opacity increase
- **Ghost:** Transparent, hover → `bg-muted/50`
- **Destructive:** `bg-gradient-to-br from-red-500 to-red-600 text-white` — used sparingly
- **Icon Button:** `h-8 w-8 rounded-lg` flex center, ghost style by default

### Modals/Dialogs (HEAVY GLASS)
- **Overlay:** `bg-black/30 backdrop-blur-[6px]` — blurs page content softly
- **Container:** `glass-heavy rounded-2xl` (16px radius for modals only)
- Max-width: `sm:max-w-lg` default, `sm:max-w-2xl` for multi-step
- Header: Title (text-lg semibold) + close X button (top-right)
- Footer: Right-aligned actions, secondary button left of primary
- **Entry:** `scale-95 opacity-0` → `scale-100 opacity-100` (200ms spring)
- **Exit:** `scale-98 opacity-0` (150ms ease-out)

### Command Palette ⌘K (HEAVY GLASS — Showcase Element)
- Centered vertically, `max-w-xl w-full`
- **Glass:** `glass-heavy` with extra shadow depth
- Overlay: Full screen `bg-black/40 backdrop-blur-sm`
- Search input: Large, `text-lg`, no border, placeholder "Search assets, people, actions..."
- Below: Results grouped by category (Assets, People, Actions, Pages)
- Each result: Icon + Title + subtitle + keyboard shortcut badge (if applicable)
- Active item: `bg-primary/10 rounded-lg` highlight
- Footer: Keyboard hints — "↑↓ Navigate", "↵ Select", "Esc Close"
- **Categories on empty:** Recent searches + quick actions grid (6 tiles)

### Tables (NO GLASS — Pure Data)
- Container: Solid `bg-card rounded-xl border` wrapper
- Header: `bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground`
- Rows: `h-12 border-b border-border/40`
- Hover: `bg-muted/20`
- Selected row: `bg-primary/5 border-l-2 border-l-primary`
- Pagination: Clean, bottom-right, showing "1-10 of 234"
- Column resize handles (subtle line on hover)
- Empty state: Centered illustration + message + CTA button

### Tooltips (SUBTLE GLASS)
- `glass-light rounded-lg px-3 py-1.5 text-xs font-medium`
- Arrow pointer (CSS triangle matching glass bg)
- Delay: 500ms hover before showing
- Animation: Fade + slight translate-y

### Context Menus / Dropdowns (MEDIUM GLASS)
- `glass-medium rounded-xl` with `shadow-lg`
- Items: `text-sm px-3 py-2 rounded-lg` hover state
- Dividers: `border-t border-border/30 my-1`
- Icons left-aligned, keyboard shortcuts right-aligned

### Toast Notifications (SUBTLE GLASS)
- Position: Top-right
- `glass-light rounded-xl px-4 py-3` with colored left border (2px)
- Icon (success/error/info) + title + message
- Auto-dismiss: 4 seconds with progress bar at bottom
- Swipe to dismiss on mobile

### Date Picker Popover (MEDIUM GLASS)
- `glass-medium rounded-xl shadow-xl`
- Calendar grid clean and readable
- Today: indigo ring, Selected: indigo fill
- Navigation arrows for month/year


---

## ROLE-BASED ACCESS (4 Roles)

| Role | Dashboard | Org Setup | Assets | Allocations | Bookings | Maintenance | Audits | Reports | Activity |
|------|-----------|-----------|--------|-------------|----------|-------------|--------|---------|----------|
| Admin | Full + Org-wide analytics | Full (manage depts, categories, promote roles) | Full | Full | Full | Full | Full | Full | Full |
| Asset Manager | Full | View only | Register + Allocate + Track | Approve transfers + allocate + return check-in | Full | Approve requests + assign technicians + resolve | Create cycles + assign auditors | Full | Full |
| Dept Head | Dept-scoped KPIs | — | View dept assets | Approve allocation/transfer within dept | Book on behalf of dept | View dept requests | View dept audits | Dept-scoped | Dept |
| Employee | Personal assets + bookings | — | View all (read-only) | Request allocation + initiate return/transfer | Book shared resources | Raise maintenance requests | — | — | Own activity |

### Role Assignment Rules (Critical):
- **Signup creates Employee role ONLY** — no role selection at signup
- **Admin promotes** employees to Dept Head or Asset Manager **exclusively from Organization Setup → Employee Directory** (Screen 3, Tab C)
- This prevents self-elevation — realistic enterprise security
- Role changes are logged in Activity and trigger notifications

## ASSET LIFECYCLE STATES

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
[Available] ──→ Allocated ──→ [Available] (on return)            │
     │              │                                             │
     │              ├──→ Transfer Request ──→ Approved ──→ Re-allocated
     │              │
     ├──→ Reserved ─┤
     │              │
     ├──→ Under Maintenance ──→ [Available] (on resolution)
     │              │
     │              ├──→ Retired ──→ Disposed
     │              │
     └──→ Lost (flagged by audit) ──→ Retired ──→ Disposed
```

### State Transition Rules (from PDF):
- **Available ↔ Under Maintenance** — bidirectional (asset goes to maintenance, comes back)
- **Allocated → Available** — on return (condition check-in captured)
- **Available → Allocated** — on allocation (conflict: can't allocate if already taken)
- **Any → Lost** — flagged during audit cycle for confirmed-missing items
- **Audit cycle close** — locks the cycle and auto-updates statuses (e.g., Lost for confirmed-missing)
- **Under Maintenance** — status auto-updates on maintenance approval (not on request creation)
- **Available on resolution** — status auto-reverts when maintenance is marked resolved

### Auto-Generated Asset Tag:
- Format: `AF-XXXX` (e.g., AF-0001, AF-0042, AF-0513)
- Auto-incremented on registration
- Used alongside Serial Number for internal tracking
- Searchable via QR code scan (each asset gets a QR linking to its detail page)

Badges (pill-shaped, `rounded-full px-2.5 py-0.5 text-xs font-medium`):
- **Available:** `bg-emerald-100/80 text-emerald-700 border border-emerald-200/50` | dark: `bg-emerald-950/40 text-emerald-400 border-emerald-800/50`
- **Allocated:** `bg-blue-100/80 text-blue-700 border border-blue-200/50`
- **Reserved:** `bg-amber-100/80 text-amber-700 border border-amber-200/50`
- **Under Maintenance:** `bg-orange-100/80 text-orange-700 border border-orange-200/50`
- **Lost:** `bg-rose-100/80 text-rose-700 border border-rose-200/50`
- **Retired:** `bg-gray-100/80 text-gray-600 border border-gray-200/50`
- **Disposed:** `bg-gray-50/80 text-gray-500 border border-gray-100/50`

---

## 10 SCREENS — DETAILED SPECIFICATIONS

---

### Screen 1: Login / Signup — "The Glass Portal"

**This is your award moment.** The first screen judges see. Make it unforgettable.

**Full-page Layout:**
- Full viewport, no scrolling
- **Background:** Animated gradient mesh covering entire viewport
  - 3 large blurred orbs (indigo, blue, purple/teal) slowly floating (20s animation cycle)
  - Light mode: 8-10% opacity blobs on white
  - Dark mode: 12-15% opacity blobs on deep navy
  - Subtle noise texture overlay (2% opacity) for grain/depth
- **Centered glass card:** `glass-heavy`, `max-w-md w-full`, `rounded-2xl`, `p-8`
- Card has subtle `ring-1 ring-white/20` and `shadow-2xl`

**Login Form — Superior to Basic Auth:**
- **Logo:** AssetFlow animated logo — icon morphs/pulses on page load (one-time, 1s)
- **Heading:** "Welcome back" (text-2xl font-bold) + "Manage your fleet with clarity" (text-sm muted)
- **Email field:** Icon prefix (Mail), `rounded-xl`, focus → indigo ring glow + inner shadow
- **Password field:** Icon prefix (Lock), eye toggle button, same style
- **Row:** "Remember me" (checkbox) ←→ "Forgot password?" (text-sm link, indigo)
- **Login Button:** Full width, gradient indigo, `rounded-xl h-11 text-sm font-semibold`
  - Hover: Glow intensifies (`shadow-lg shadow-indigo-500/30`)
  - Loading state: Spinner replaces text
- **Divider:** Horizontal line with centered "or continue with" text (muted)
- **Social Auth:** Two glass buttons side-by-side — Google (G icon) + Microsoft (MS icon)
  - `glass-light rounded-xl h-11` with brand icon + "Google" / "Microsoft" text
- **Footer:** "New here? Create an account" → navigates to signup

**Signup Form — Same Card, Different Content:**
- **Fields:** Full Name, Work Email, Password (with animated strength meter — 4 colored bars), Confirm Password, Department (combobox with search), Designation
- **NO role selection field** — signup ONLY creates Employee accounts (enterprise security enforced by design)
- Admin promotes employees to Dept Head / Asset Manager exclusively from Organization Setup → Employee Directory
- **Password Strength:** 4 small bars below input — gray → red → amber → green as strength increases, animated fill
- **Terms:** "I agree to the Terms of Service and Privacy Policy" checkbox
- **Submit:** "Create Account" gradient button
- **Success State:** Card content fades out → animated checkmark (Lottie-style SVG) + "Account created! Redirecting..." + auto-redirect countdown
- **Forgot Password Flow:** Email input → Send reset link → Success message (all within same glass card, animated tab switch)

**3D Tilt Effect (both forms):**
- On mouse move over card: Subtle perspective tilt (max ±3 degrees on X/Y)
- `transform-style: preserve-3d`, inner elements have slight `translateZ(20px)` for parallax
- Disabled on mobile/touch devices

**Floating Elements (background decoration):**
- 4-5 small glass circles (20-40px) floating slowly at random positions
- Very low opacity (15-20%), adds life without distraction
- Pause animation when card is being interacted with (reduce motion)

---

### Screen 2: Dashboard — "Mission Control"

**Page Structure:** No page title (the greeting IS the title). Dense, information-rich.

**Greeting Row:**
- Left: "Good morning, Ridham 👋" (text-2xl semibold) + date "Sunday, July 12, 2026" (text-sm muted)
- Right: Quick Action pills (3):
  - "➕ Allocate" | "📅 Book" | "🔧 Maintenance"
  - Each: `glass-light rounded-full px-4 py-2 text-sm font-medium gap-2`
  - Hover: `scale-[1.02]` + border color shifts to primary

**KPI Row (6 glass cards, single scrollable row on mobile):**
- Layout: `grid grid-cols-6 gap-3` (desktop) → horizontal scroll (mobile)
- Each KPI card: `glass-light rounded-xl p-5`
  - Left accent bar: 3px width, rounded, colored by semantic meaning
  - Content: Label (text-xs muted uppercase) → Number (text-2xl bold) → Trend (text-xs with icon)
- Cards (matching PDF requirements):
  1. Assets Available — green accent — "142" — "↑ 8% from last month"
  2. Assets Allocated — blue accent — "287" — "↑ 3%"
  3. Maintenance Today — orange accent — "5" — active requests
  4. Active Bookings — indigo accent — "18" — currently ongoing
  5. Pending Transfers — amber accent — "3" — awaiting approval
  6. Overdue Returns — red accent — "7" — "↑ 2 new" (pulsing red dot, auto-flagged)
- **Overdue Returns card has special treatment:** Red accent + pulsing dot + clicking navigates to filtered allocations view

**Main Content Grid (below KPIs):**

**Left Column (60% width): Recent Activity Feed**
- Section header: "Recent Activity" + "View all →" link
- Timeline list (8-10 items visible):
  - Each: Colored action dot + Avatar (24px) + Rich text + Relative time
  - Example: 🟢 Priya Sharma allocated **MacBook Pro M3** to Arjun Mehta — *2 hours ago*
  - Hover: `bg-muted/30 rounded-lg` + "→" arrow appears right-aligned
- Load more: "Show older activity" button at bottom

**Right Column (40% width): Two Stacked Widgets**

*Widget 1: Asset Utilization Chart*
- Area chart (Recharts): 30-day trend
- Gradient fill under line (indigo, 20% opacity at bottom → 0%)
- Tooltip on hover: exact % + date
- Mini legend below

*Widget 2: Upcoming Returns*
- Compact list (5 items):
  - Asset name + Person (avatar + name) + Due date
  - Overdue: Red text + "⚠ Overdue" badge
  - Due today: Amber text
  - Normal: Muted text
- "View all returns →" link

**Bonus Widget (Optional — Top-Right Corner):**
- "Fleet Health" — animated donut/ring chart (82%)
- Indigo gradient stroke, gray remaining
- Center: percentage number (animates up on mount)
- Below: "Good standing" text label

---

### Screen 3: Organization Setup — "Company Blueprint"

**Header:** "Organization Setup" (text-2xl) + "Configure departments, categories, and manage your team" (text-sm muted)

**Tabs (shadcn Tabs, underline variant):** Departments | Asset Categories | Employee Directory

**Departments Tab — Card Grid (not table):**
- `grid grid-cols-3 gap-4` (desktop, 2 tablet, 1 mobile)
- Each department card: `bg-card rounded-xl border p-5 hover:shadow-md transition`
  - Department name (text-lg font-semibold)
  - Head: Avatar (32px) + name + designation (text-sm muted)
  - Parent Department: If nested, shows "under [Parent]" tag (supports hierarchy)
  - Status: Active (green dot) / Inactive (gray dot)
  - Footer row: Employee count badge + Asset count badge
  - Top-right: "⋯" menu button (Edit, Deactivate, Delete)
- "Add Department" card: Dashed border, centered "+" icon + "Add Department" text, hover → solid border + primary color
- Click "Add" or dashed card → Glass modal:
  - Fields: Department Name, Select Department Head (combobox with avatars), Parent Department (optional — for hierarchy), Status (Active/Inactive toggle), Description
  - Create button

**Asset Categories Tab — Interactive Tree:**
- Left panel (tree): Indented rows with expand/collapse chevrons
  - Each row: Icon (folder for parent, file for leaf) + Category name + asset count badge
  - Active/selected: `bg-primary/5 border-l-2 border-primary rounded-r-lg`
  - Hover: `bg-muted/30`
- Right panel (details): Shows selected category's info + **category-specific custom fields**
- Tree structure: IT → [Laptops (42), Desktops (18), Peripherals (67)] | Furniture → [Desks (45), Chairs (50)] | Vehicles → [Cars (5), Two-wheelers (3)]
- "Add Category" button → Glass modal:
  - Name, Parent Category select, Icon select
  - **Category-specific fields section:** Add custom fields that apply to all assets in this category
    - Example: "Electronics" gets → Warranty Period, Processor, RAM, Storage
    - Example: "Vehicles" gets → Registration Number, Insurance Expiry, Fuel Type
    - Each field: Name + Type (Text/Number/Date/Select) + Required toggle
  - These custom fields appear in Asset Registration (Screen 4) when that category is selected

**Employee Directory Tab — Premium Data Table (ROLE PROMOTION HAPPENS HERE):**
- Filters row: Search input + Department dropdown + Role dropdown + Status toggle
- Table columns: Checkbox | Avatar+Name | Email | Department (badge) | Role (inline select) | Status (dot + text) | Joined Date | Actions
- **Role select (ADMIN ONLY):** Inline `<Select>` dropdown — this is THE ONLY place roles are assigned/promoted
  - Options: Employee → Department Head → Asset Manager
  - Change triggers confirmation dialog: "Promote Arjun Mehta to Asset Manager?"
  - On confirm: Toast notification + Activity log entry + Email notification to user
- Status: Active (green dot) / Inactive (gray dot)
- Bulk actions: Floating bar at bottom when rows selected — "Change Role" | "Deactivate" | "Export"
- Row click → Right slide-out panel (`glass-medium`, 400px):
  - Full employee profile: Large avatar, name, email, department, role, joined date
  - "Assets Assigned" list: Their current allocations
  - "Recent Activity": Last 5 actions by this person
  - Actions: Promote Role, Deactivate, Remove

---

### Screen 4: Asset Registration & Directory — "The Inventory"

**Sticky Top Bar:**
- Search: Full-width input with magnifying glass icon + `⌘K` badge
- Below: Filter row — Category (multi-select), Status (multi-select), Department, Date range
  - Applied filters show as removable chips with × close
- Right: View toggle (List | Grid icons, `rounded-lg` pair) + "Register Asset" primary button

**List View (default) — TanStack Table:**
- Columns: Thumbnail (32px square) | Asset Tag (monospace, auto-generated e.g. AF-0042) | Asset Name (bold, clickable link) | Serial No. (monospace) | Category (text badge) | Status (colored badge) | Assigned To (avatar + name or "—") | Location | Bookable (icon) | Added Date
- Features: Column sorting, column visibility dropdown, resize handles
- Row actions: "⋯" menu → View, Allocate, Transfer, Mark Maintenance, Retire, Delete
- Pagination: "Showing 1-25 of 487 assets" + page size selector + nav arrows
- **Search supports:** Asset Tag, Serial Number, QR code scan (camera icon button for mobile), category, status, department, location
- Empty state: Illustration (filing cabinet) + "No assets found" + "Register your first asset" CTA

**Grid View:**
- `grid grid-cols-4 gap-4` (desktop, 3 laptop, 2 tablet, 1 mobile)
- Each card: `bg-card rounded-xl border overflow-hidden hover:shadow-lg transition group`
  - Top: Asset type icon/illustration (colored bg, 120px height area)
  - Body: Name (font-medium) + Serial (text-xs mono muted) + Category tag
  - Footer: Status badge + Assigned avatar (or empty circle)
  - Hover: Overlay with "View Details" button (glass-light, centered)
- Animated mount: Cards stagger fade-up (30ms delay each)

**Register Asset — Multi-Step Glass Modal (`max-w-2xl`):**
- **Stepper indicator:** 3 connected dots with labels — "Details" → "Location" → "Documents"
  - Active: Indigo filled dot + bold label
  - Completed: Green check dot
  - Pending: Gray outline dot
  - Connecting line fills with indigo as steps complete

- **Step 1 — Basic Info:**
  - Asset Name (text input)
  - Serial Number (text input, monospace)
  - **Asset Tag: Auto-generated** — displayed as read-only field showing next tag (e.g., "AF-0488") with info tooltip "Auto-assigned on registration"
  - Category (combobox with search + hierarchy display)
  - **Category-specific fields appear dynamically** based on selected category:
    - Electronics: Warranty Period, Processor, RAM, Storage
    - Vehicles: Registration Number, Insurance Expiry, Fuel Type
    - Furniture: Material, Color, Weight Capacity
  - Acquisition Date (date picker)
  - Acquisition Cost (₹ number input with comma formatting — for ranking/reports only, not accounting)
  - Condition (New / Refurbished / Used radio cards)
  - **☑ "Shared/Bookable Resource"** toggle — marks this asset as available for time-slot booking (appears in Resource Booking screen)

- **Step 2 — Location & Assignment:**
  - Location: Building → Floor → Room (cascading selects)
  - Assign to Employee (optional combobox with avatars) — "Leave blank if unassigned"
  - Department (auto-fills from employee if assigned)
  - Notes (textarea, optional)

- **Step 3 — Documents & Media:**
  - Drag-drop upload zone: Dashed border area, "Drop files here or click to upload"
  - File types: PDF, JPG, PNG — max 10MB each
  - Upload preview: Thumbnail grid with filename, size, remove button
  - Categories: Purchase Receipt, Warranty Card, Manual, Photo, Other (tag per file)
  - **QR Code: Auto-generated** — preview shown, links to asset detail page, downloadable/printable

- **Navigation:** "Back" (ghost) | "Next" (primary) | Final: "Register Asset" (gradient primary)
- State persists in Zustand (close modal → reopen → state intact)
- On success: Toast "Asset registered as AF-0488" + option to "Allocate Now" or "Register Another"

**Asset Detail Page (`/assets/[id]`):**
- **Top Hero Section:** 
  - Left: Asset name (text-2xl bold) + Asset Tag badge (monospace, `AF-0042`) + Serial (text-sm mono muted)
  - Center: Status badge (large) + Category tag + QR code icon (click to view/download QR)
  - Right: Actions — "Edit" (secondary) + "⋯" dropdown (Transfer, Mark Maintenance, Retire, Dispose)

- **Two Column Layout:**
  - **Left (60%): Asset Information**
    - Definition list in `bg-card rounded-xl border p-6`:
      - Fields: Category, Serial Number, Purchase Date, Purchase Value, Warranty Expiry, Location, Condition, Assigned To, Department
      - Each row: Icon + Label (muted) + Value
    - Below: Documents section — file cards with download buttons

  - **Right (40%): Lifecycle Timeline**
    - Vertical timeline with glass-styled nodes:
    - Each event: Colored dot (left) → Vertical line → Card (date + action + person avatar + description)
    - Latest event: Pulsing indigo ring
    - Events: "Registered" → "Allocated to Priya Sharma" → "Returned (Good condition)" → "Under Maintenance (Screen damage)" → "Repaired" → "Available"
    - Load more: "Show full history" link at bottom

- **Bottom Section — Per-Asset History Tabs:**
  - **Tab 1: Allocation History** — Table: Allocated To, Department, From Date, To Date, Return Condition, Notes
  - **Tab 2: Maintenance History** — Table: Issue, Priority, Technician, Status, Cost, Resolution Date
  - **Tab 3: Audit History** — Table: Audit Cycle, Auditor, Finding (Verified/Discrepancy/Missing), Date
  - Each history entry clickable to expand full details


---

### Screen 5: Asset Allocation & Transfer — "The Flow Board"

**Layout:** Full-width Kanban board with column-based workflow.

**Kanban Board:**
- 4 Columns: `Pending Requests` | `Approved` | `Active Allocations` | `Overdue`
- Column headers: Title + Count badge (`rounded-full bg-muted text-xs px-2`)
- Column widths: Equal, scrollable vertically within each
- "Overdue" column: Red-tinted header bg (`bg-destructive/5`), column has faint red left border

**Kanban Cards:**
- `bg-card rounded-xl border p-4 cursor-grab shadow-sm`
- Content: Asset name (font-medium) + Serial (text-xs mono) + Requester (avatar 24px + name) + Date + Priority dot
- Priority dots: Low (gray) | Normal (blue) | High (orange) | Urgent (red, pulsing)
- **Drag interaction (Framer Motion):**
  - On grab: Card lifts (`scale-[1.02] shadow-xl rotate-[1deg]`), becomes `glass-heavy` effect
  - On drag: Ghost outline stays in original position
  - On drop: Spring animation to new position
- Card actions (on hover/focus): Transfer | Return | View

**"Allocate Asset" Button → Glass Modal:**
- **Asset search:** Combobox with asset thumbnails + name + Asset Tag + serial + status
  - Only "Available" assets shown in full color
  - Non-available assets shown grayed with reason tooltip
- **Employee select:** Combobox with avatar + name + department
- **Expected Return Date:** Date picker (min: tomorrow) with quick presets (1 week, 2 weeks, 1 month, 3 months) — optional but recommended
- **Notes:** Optional textarea
- **Conflict Rule (from PDF):** System BLOCKS allocation of already-allocated assets.
  - Example: "Priya has Laptop AF-0114. If Raj tries to allocate it, the system blocks it, shows 'Currently held by Priya Sharma (since Mar 12)', and offers a **Transfer Request** button instead."
  - Red alert banner: "⚠ This asset is currently allocated to [Avatar] Priya Sharma. Expected return: Apr 15, 2026"
  - Below alert: "Request Transfer" button (indigo outline) — initiates transfer workflow instead
- **Submit:** "Allocate Asset" gradient button
- **Success:** Toast notification + card appears in "Active Allocations" + asset status → Allocated
- **Overdue auto-flagging:** Allocations past Expected Return Date are automatically flagged → feed Dashboard KPI + Notifications

**Transfer Flow (from Active card → "Transfer" action):**
- Glass modal with visual flow:
  - Left: Current holder card (avatar + name + department) — grayed/disabled
  - Center: Arrow icon (animated, indigo)
  - Right: New holder selector (combobox with avatars)
- Below: Transfer reason (select: Resignation, Department Change, Temporary, Other) + Notes
- **Transfer Workflow (PDF):** Requested → Approved (by Asset Manager/Dept Head) → Re-allocated
  - "Initiate Transfer" creates pending request
  - Approver gets notification
  - On approval: Asset history auto-updates, new allocation record created
  - On rejection: Requester notified with reason

**Return Flow (from Active card → "Return" action):**
- Compact glass modal:
- **Condition Check-in (PDF requirement):** 4 radio cards in a row:
  - Excellent (✨ green) | Good (👍 blue) | Fair (⚠️ amber) | Damaged (💔 red)
  - Each: Icon + label + brief description
- **Check-in Notes:** Textarea for return condition observations (required for Fair/Damaged)
- If "Damaged" selected → Expand section (animated):
  - Damage description (textarea)
  - Photo upload (optional)
  - "Auto-create maintenance request" checkbox (pre-checked)
- "Confirm Return" button
- Status transition: Available (or Under Maintenance if damaged)

**Additional Feature — Approval Queue (for Dept Heads):**
- Sub-tab or toggle above Kanban: "Pending My Approval" — shows requests needing your sign-off
- Each request: Asset, Requester, Reason, Date — "Approve" (green) / "Reject" (red) buttons

---

### Screen 6: Resource Booking — "The Calendar"

**Layout:** Calendar-first design with resource tabs.

**Resource Tabs (top):** Meeting Rooms | Projectors | Vehicles | Shared Equipment
- Underline tab style, each with count badge

**Calendar View (Monthly — default):**
- react-day-picker, heavily customized styling:
  - Day cells: `min-h-[80px]` (desktop), show booking indicators
  - Booking indicators: Small colored pills (3-4 max per day) with truncated resource name
  - Color coding: Green (confirmed), Amber (pending), Gray (cancelled)
  - Today: Indigo ring highlight
  - Past days: Slightly faded
- Header: Month/Year + navigation arrows + "Today" button + View switcher (Month | Week | Day)
- Click day → Day Detail view slides in (from right) OR expands below

**Week View (alternative):**
- Horizontal time grid (7 columns × 12 time slots — 8AM to 8PM)
- Bookings as colored blocks spanning time slots
- Current time: Red horizontal line with dot
- Clickable empty slots → opens booking modal

**Day View (expanded from clicking a day):**
- Vertical time slots (30-min intervals, 8AM → 8PM)
- Booked slots: Colored blocks with resource name + booker avatar + time
- Free slots: Light bg, clickable → opens booking modal
- Hover on free slot: Shows "Book this slot" ghost button

**Booking Modal (GLASS — `glass-heavy rounded-2xl`):**
- **Resource:** Pre-selected (from context) or searchable combobox
  - Shows resource name + location + capacity (for rooms)
- **Date:** Pre-selected (from calendar click) or date picker
- **Time:** Start time + End time (select dropdowns, 30-min intervals)
  - Visual time bar showing selected range
- **Purpose:** Text input (required) — e.g., "Sprint Planning Meeting"
- **Attendees:** Optional multi-select (for meeting rooms)
- **Recurring:** Toggle — Off by default
  - If on: Frequency (Daily/Weekly/Bi-weekly) + End date or "After N occurrences"
- **Overlap Validation (PDF rule):** Two people CANNOT book the same resource at overlapping times.
  - Example from PDF: "Room B2 is booked 9:00–10:00. A request for 9:30–10:30 gets rejected since it overlaps; a request for 10:00–11:00 is fine since it starts right after."
  - As user selects time → checks existing bookings in real-time
  - If conflict: Red alert box "⚠ Overlap: Booked by Arjun Mehta 9:00-10:00 AM — your 9:30 start conflicts"
  - Below conflict: Green suggestion "✓ Available alternatives: Room 3B (same time), Room 2A (10:00-11:00 AM)"
  - Adjacent bookings allowed (end time = next start time)
- **Submit:** "Book Resource" gradient button

**Booking Statuses (from PDF):**
- Upcoming (blue badge) — future confirmed booking
- Ongoing (green badge, pulsing dot) — currently in use
- Completed (gray badge) — past
- Cancelled (red badge, strikethrough on calendar)
- **Cancel/Reschedule:** Available for upcoming bookings
- **Reminder notification:** Auto-sent before slot starts (configurable: 15min/30min/1hr)

**My Bookings Tab (toggle or sub-nav):**
- Table: Resource | Date | Time | Purpose | Status | Actions
- Upcoming: Full color, "Cancel" + "Reschedule" actions available
- Past: Grayed out, "Rebook" action
- Upcoming bookings with < 1 hour: "Starting soon" amber badge with countdown
- Ongoing: Green highlight row with "In Progress" indicator

**Enhancement — Resource Availability Heatmap:**
- Below calendar: Mini grid showing Days (cols) × Hours (rows)
- Color intensity = booking density (white → light indigo → dark indigo)
- Helps users quickly identify free slots at a glance (peak usage windows from PDF)
- Interactive: Hover shows "X bookings at this time"

---

### Screen 7: Maintenance Management — "The Pipeline"

**Layout:** Pipeline visualization at top + filterable data table below.

**Pipeline Stepper (top section, full-width):**
- Horizontal flow: 5 stages connected by lines
  - `Requested (5)` → `Approved (3)` → `Assigned (2)` → `In Progress (4)` → `Resolved (12)`
- Each stage: Pill/capsule shape with icon + label + count
  - Active/selected: `bg-primary text-white` filled
  - Others: `bg-card border` outline style with muted text
  - Connecting lines: Solid (completed) or dashed (pending)
- Click a stage → filters the table below
- "All" option to show everything
- Animated count badges (number changes with transition)

**Data Table:**
- Columns: Priority (dot) | Asset (name + serial) | Issue Type (badge) | Status (stage badge) | Assigned To (avatar or "Unassigned") | Requested By (avatar + name) | Date | SLA Timer
- **SLA Timer column — animated countdown:**
  - Green badge: "4h 32m remaining" (on track)
  - Amber badge: "1h 15m remaining" (warning, < 2hrs)
  - Red badge: "BREACHED -2h 10m" (overdue, pulsing animation)
- Row expandable: Click → expands below with description, attachments (thumbnails), comments
- Row actions: "⋯" → Approve, Assign, Start, Resolve, Escalate

**Priority Visual Selector (not plain text):**
- Low: 🟢 Green dot + "Low"
- Medium: 🟡 Amber dot + "Medium"
- High: 🟠 Orange dot + "High"
- Critical: 🔴 Red dot (pulsing ring animation) + "Critical"

**"New Request" Button → Glass Modal:**
- **Asset:** Searchable combobox — shows asset thumbnail + name + serial + current status badge
  - If asset already under maintenance → warning message
- **Issue Type:** 4 icon-radio cards in a grid:
  - 💻 Hardware | 🖥️ Software | 🔨 Physical Damage | 📦 Other
  - Selected: indigo border + check mark
- **Priority:** Visual dot selector (4 options in a row)
- **Description:** Rich textarea with character count (500 max)
- **Attachments:** Drag-drop image zone (up to 3 photos)
  - Preview thumbnails with remove button
- **Submit:** "Submit Request" button

**Maintenance Workflow (from PDF):** Pending → Approved/Rejected (by Asset Manager) → Technician Assigned → In Progress → Resolved
- **Critical:** Maintenance request must be APPROVED before work starts (approval gate)
- **Asset status auto-update:** On approval → asset automatically flips to "Under Maintenance"
- **On resolution:** Asset status automatically reverts to "Available"
- **Maintenance history retained per asset** (visible in Asset Detail page)

**Workflow Actions (role-based, per card/row):**
- Asset Manager sees: "Approve" / "Reject" (with rejection reason) → "Assign Technician" (combobox select)
- Technician sees: "Start Work" → "Mark Resolved"
- Employee sees: View status only + add comments
- Resolution form (when marking resolved):
  - Resolution notes (textarea)
  - Cost (₹ number input)
  - Parts used (tag input — add parts as chips)
  - Next service date (date picker, optional)
  - Attach proof (optional photo upload)
  - Asset status confirmation: "Mark asset as Available" (default checked) or "Needs further maintenance"

**Detail Panel (slide-out from right — `glass-medium`):**
- 400px width desktop, full-screen mobile
- Top: Asset name + Asset Tag + serial + status badge + priority dot
- Body sections:
  - Issue details (type, description, attachments gallery)
  - Assignment info (requested by, assigned to, dates)
  - Timeline: All state transitions with timestamps + actors
  - Comments thread: Messages with avatars + timestamps (like a mini chat)
- Bottom: Action buttons based on current role + status

---

### Screen 8: Asset Audit — "The Inspector"

**Layout:** Audit cycles list → Click into active audit → Checklist + Reports

**Audit Cycles List (main page):**
- Card grid (`grid-cols-2 lg:grid-cols-3 gap-4`):
  - Each card: `bg-card rounded-xl border p-5`
    - Audit name (font-semibold) + Frequency badge (Monthly/Quarterly/Annual — colored)
    - Departments covered: Avatar stack (up to 4, then +N)
    - Status badge: Scheduled (gray) | In Progress (amber, animated dot) | Completed (green check)
    - Progress bar: Animated fill, percentage below
    - Date range: "Jan 1 — Jan 31, 2026"
    - Actions: "View" button + "⋯" menu (Edit, Delete, Duplicate)
- "Create Audit Cycle" primary button → Glass modal:
  - Audit Name
  - **Scope (from PDF):** Department-based OR Location-based (radio toggle)
    - If Department: Multi-select departments
    - If Location: Select Building/Floor/Area
  - Date range (start date + end date pickers)
  - Assign Auditors: Multi-select employees (one or more auditors per cycle)

**Active Audit View (`/audits/[id]`):**

*Top Section — Glass KPI Cards (3):*
- Completion: Ring chart (animated fill) + "67%" + "80/120 verified"
- Discrepancies: Number + "⚠" icon + "Needs attention" text (amber if >0)
- Pending: Number + "Still to verify" text

*Middle Section — Auditor Assignment Table:*
- Compact table: Department | Assigned Auditor (searchable select) | Status (Not Started/In Progress/Complete)
- "Auto-assign" button: Distributes evenly across available auditors

*Main Section — Audit Checklist Table (the core functionality):*
- Large data table:
  - Columns: # | Asset Name | Serial | Expected Location | Current Status | Verification | Notes | Photo
  - **Verification column — interactive radio group per row:**
    - ✓ Verified (green) | ⚠ Discrepancy (amber) | ✗ Missing (red)
    - Clicking changes immediately (optimistic update with toast)
  - **Notes column:** Inline text input that saves on blur
  - **Photo column:** Camera icon button → opens capture/upload modal
    - After upload: Shows thumbnail with expand-on-click
- **Progress bar (sticky above table):** "45 of 120 assets verified" + animated bar + ETA
- **Filters:** Status filter (All/Verified/Discrepancy/Missing/Pending) + Search
- **Bulk actions:** Select rows → "Mark Verified" | "Flag Discrepancy" | "Export Selected"

**Audit Findings (PDF — auditor marks each asset):**
- ✓ **Verified** — Asset found at expected location, condition acceptable
- ⚠ **Discrepancy** — Asset found but condition/location differs from records
- ✗ **Missing** — Asset not found at expected location

**Close Audit Cycle (PDF requirement):**
- "Close Audit" button (destructive-styled, requires confirmation)
- Confirmation dialog: "Closing this audit will lock all findings and update asset statuses. This cannot be undone."
- On close:
  - Cycle is **locked** — no further edits allowed
  - **Auto-generates discrepancy report** for flagged items
  - **Auto-updates asset statuses:** Confirmed-missing items → status changed to "Lost"
  - Discrepancies → flagged for review/resolution
  - Audit history retained per cycle (timestamped, auditor-attributed)
- Closed audit: Read-only view with "Closed on [date]" banner

*Discrepancy Reports Tab (auto-generated on cycle close):*
- Table: Asset | Asset Tag | Expected Status/Location | Actual Finding | Auditor | Photo | Resolution Status
- Resolution column: "Resolved" (green) | "Pending" (amber) | "Escalated" (red)
- Expandable rows: Full notes + resolution timeline
- Export buttons: "Export PDF" + "Export CSV" (top-right, secondary style)
- **Discrepancy resolution workflow:** Asset Manager reviews → Resolves (update records) or Escalates

**Enhancement — Audit Summary Dashboard (tab or top widget):**
- Historical audits comparison: Line chart of discrepancy % over time
- Department-wise accuracy heatmap
- Most frequently discrepant asset types (bar chart)


---

### Screen 9: Reports & Analytics — "The Insights Lab"

**Layout:** Filter bar → Chart grid → Deep-dive tables

**Filter Bar (sticky, `glass-light` on scroll):**
- Date Range: Preset buttons (7d | 30d | 90d | 1yr | Custom) + custom date picker
- Department: Multi-select combobox
- Category: Multi-select combobox
- "Generate" primary button | "Export PDF" + "Export CSV" secondary buttons (right)
- Applied filters shown as removable chips below

**Chart Grid (2×2 desktop, 2×1 tablet, stacked mobile):**

**1. Asset Utilization Trends — Area/Line Chart:**
- X-axis: Months (last 12 months)
- Y-axis: % Utilization (0-100%)
- Multiple lines: One per category (Laptops, Furniture, Vehicles, etc.)
- Active line: Thick + filled area gradient below
- Inactive lines: Thin + muted
- Tooltip: On hover — shows date + % for each category
- Legend: Bottom, interactive (click to toggle series)
- Empty state: "Not enough data for this period"

**2. Category Distribution — Interactive Donut:**
- Segments: One per asset category, sized by count
- Center: Total asset count (animated number)
- Hover: Segment lifts slightly + tooltip shows category + count + %
- Legend: Right side with color dots + labels + counts
- Click segment: Filters the summary table below to that category
- Colors: Indigo, Blue, Teal, Amber, Orange (muted palette)

**3. Department Asset Usage — Horizontal Bar Chart:**
- Bars: One per department, sorted by count (highest first)
- Bar labels: Department name (left) + Count (inside bar or right)
- Bar color: Gradient from indigo-400 to indigo-600
- Hover: Bar highlights + exact count tooltip
- Click: Filters to show that department's assets

**4. Maintenance Cost Trends — Stacked Bar + Line:**
- Bars: Monthly costs, stacked by issue type (Hardware, Software, Physical, Other)
- Overlay line: Running total/average trend
- Y-axis: ₹ value (formatted — ₹1.2L, ₹45K)
- Tooltip: Breakdown by type + total
- Colors: Distinct but harmonious (indigo, amber, teal, rose)

**Below Charts — Asset Heatmap:**
- Grid visualization: Departments (rows) × Months (columns)
- Cell color: Intensity represents request/allocation volume
- Color scale: White → Light indigo → Dark indigo (light mode) | Dark navy → Bright indigo (dark mode)
- Hover cell: Tooltip with exact count
- Click cell: Shows breakdown of that month × department

**Summary Statistics Table:**
- Sortable table: Department | Total Assets | Active Allocations | Utilization % | Maintenance Cost (₹) | Avg Asset Age | Top Issue
- Sparkline column (optional): Mini inline chart showing 6-month trend per row
- Sortable by any column
- Bottom row: "Total" aggregate with bold values

**Additional Report Types (from PDF):**
- **Most-Used vs Idle Assets:** Bar chart showing top 10 most allocated assets vs bottom 10 idle (never/rarely allocated)
- **Assets Nearing Retirement:** Table of assets approaching end-of-life based on age, condition, maintenance frequency — with "Recommended Action" column
- **Maintenance Frequency by Asset/Category:** Which asset types break down most often — helps procurement decisions
- **Resource Booking Heatmap (peak usage windows):** Grid showing time-of-day × day-of-week with color intensity = booking volume — identifies peak hours for each resource type
- **Exportable Reports:** All charts and tables can be exported as PDF (formatted) or CSV (raw data)

**Enhancement — AI Insights Panel (glass card at top, optional):**
- `glass-accent rounded-xl p-4` with sparkle icon
- Auto-generated insights: "Engineering has 15% more assets than last quarter" | "MacBook maintenance costs are trending up 22%" | "Pune office has lowest utilization at 62%"
- 3-4 rotating insights with fade transition

---

### Screen 10: Activity Logs & Notifications — "The Timeline"

**Layout:** Two-panel on desktop (60/40 split), tabs on mobile.

**Left Panel (60%): Activity Logs — "Everything that happened"**

*Sticky filter bar:*
- Action type: Multi-select (Allocation, Return, Maintenance, Audit, Booking, User Change, System)
- User: Searchable combobox
- Date range: Preset or custom
- "Clear filters" ghost button

*Timeline Feed:*
- Infinite scroll, grouped by date headers ("Today" | "Yesterday" | "July 10, 2026" etc.)
- Each entry:
  ```
  [Action Icon] [User Avatar] [Rich Text Description] .................. [Relative Time]
  ```
  - Action icons: Color-coded by type (green allocation, blue booking, orange maintenance, etc.)
  - Rich text: Bold entity names that are clickable links
    - "**Priya Sharma** allocated **MacBook Pro M3 #NX-LAP-2024-0042** to **Arjun Mehta** in **Engineering**"
  - Hover: `bg-muted/20 rounded-lg` + shows "View →" link
  - Click: Navigates to relevant entity page
- Load more: Intersection observer auto-loads (skeleton appears while loading)

*Activity Types with Icons:*
- 🟢 Allocation (Package icon)
- 🔵 Booking (Calendar icon)
- 🟠 Maintenance (Wrench icon)
- 🟣 Audit (ClipboardCheck icon)
- ⚪ Return (RotateCcw icon)
- 🔴 Alert (AlertTriangle icon)
- ⚙️ System (Settings icon)

**Right Panel (40%): Notifications — Glass-Styled Feed**

*Container: `glass-light rounded-xl` with fixed height and internal scroll*

*Header:*
- "Notifications" title + unread count badge
- "Mark all as read" ghost button (right-aligned)
- Filter: All | Unread toggle

*Notification Items:*
- Each: `px-4 py-3 border-b border-border/30`
  - Unread: Blue dot (left) + slightly bolder text + faint `bg-primary/3` background
  - Read: Normal styling
  - Content: Icon (colored by type) + Title (font-medium) + Description (text-sm muted) + Time (text-xs)
  - Hover: Shows "×" dismiss button (right)

*Notification Types (from PDF — comprehensive list):*
- 📦 **Asset Assigned** — "MacBook Pro AF-0042 has been assigned to you" — purple icon
- 🔄 **Transfer Approved** — "Your transfer request for Dell XPS has been approved" — indigo icon
- ⏰ **Overdue Return Alert** — "Dell XPS overdue from Vikram Singh (3 days)" — red icon (urgent, pulsing)
- 🔧 **Maintenance Approved/Rejected** — "Your maintenance request has been approved" / "rejected: insufficient details" — orange icon
- � **Booking Confirmed** — "Room Kaveri booked for tomorrow 2:00-3:00 PM" — green icon
- ❌ **Booking Cancelled** — "Your booking for Room Ganga was cancelled" — red icon
- 🔔 **Booking Reminder** — "Your booking starts in 15 minutes: Room Kaveri" — amber icon
- 📋 **Audit Discrepancy Flagged** — "3 discrepancies found in Q3 Engineering Audit" — blue icon
- 👤 **Role Changed** — "You've been promoted to Asset Manager by Admin" — indigo icon
- ⚠️ **Maintenance Overdue** — "SLA breached for Projector repair" — red icon

*Full audit log section:*
- Complete log of all admin/manager/employee actions
- "Who did what, when" — full traceability
- Filterable by user, action type, date range
- Exportable for compliance

*Bottom: "Notification Preferences" link → settings page*

**Top Bar Notification Integration:**
- Bell icon in top bar with red badge (count if unread > 0)
- Click → `glass-heavy` dropdown (300px wide, max-h-[400px]):
  - Latest 5 notifications with condensed styling
  - "View all notifications →" link at bottom
  - Auto-refreshes on focus

**Enhancement — Real-time Feel:**
- New notification: Slides in from top with brief indigo flash
- Bell icon: Brief shake animation when new notification arrives
- Count badge: Scales up briefly on increment

---

## LAYOUT ARCHITECTURE

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── layout.tsx              ← Auth layout (gradient mesh bg, centered)
│   ├── (dashboard)/
│   │   ├── layout.tsx              ← Glass Sidebar + TopBar + Content area
│   │   ├── page.tsx                ← Dashboard (Screen 2)
│   │   ├── organization/page.tsx   ← Org Setup (Screen 3)
│   │   ├── assets/
│   │   │   ├── page.tsx            ← Asset Directory (Screen 4)
│   │   │   └── [id]/page.tsx       ← Asset Detail
│   │   ├── allocations/page.tsx    ← Screen 5
│   │   ├── bookings/page.tsx       ← Screen 6
│   │   ├── maintenance/page.tsx    ← Screen 7
│   │   ├── audits/
│   │   │   ├── page.tsx            ← Audit Cycles (Screen 8)
│   │   │   └── [id]/page.tsx       ← Active Audit Detail
│   │   ├── reports/page.tsx        ← Screen 9
│   │   └── activity/page.tsx       ← Screen 10
│   ├── layout.tsx                  ← Root: ThemeProvider, fonts, Toaster
│   └── globals.css                 ← Variables, glass utils, gradient mesh, resets
├── components/
│   ├── ui/                         ← shadcn/ui (customized: button, input, badge, dialog,
│   │                                  tabs, table, select, command, calendar, tooltip,
│   │                                  dropdown-menu, popover, skeleton, progress, sheet)
│   ├── layout/
│   │   ├── sidebar.tsx             ← Glass sidebar with nav groups
│   │   ├── topbar.tsx              ← Glass-on-scroll top bar
│   │   ├── breadcrumb.tsx          ← Dynamic breadcrumb
│   │   ├── theme-toggle.tsx        ← Animated sun/moon toggle
│   │   └── mobile-nav.tsx          ← Bottom tab bar + drawer (mobile)
│   ├── dashboard/
│   │   ├── kpi-cards.tsx           ← Glass KPI row
│   │   ├── activity-feed.tsx       ← Recent activity timeline
│   │   ├── utilization-chart.tsx   ← Area chart widget
│   │   ├── upcoming-returns.tsx    ← Return list widget
│   │   └── health-score.tsx        ← Ring gauge
│   ├── assets/
│   │   ├── asset-table.tsx         ← TanStack table setup
│   │   ├── asset-grid.tsx          ← Grid view cards
│   │   ├── asset-filters.tsx       ← Filter bar + chips
│   │   ├── register-dialog.tsx     ← Multi-step registration
│   │   ├── asset-detail.tsx        ← Detail layout
│   │   └── lifecycle-timeline.tsx  ← Vertical timeline
│   ├── allocations/
│   │   ├── kanban-board.tsx        ← Drag-drop columns
│   │   ├── kanban-card.tsx         ← Individual card
│   │   ├── allocate-dialog.tsx     ← Allocation form
│   │   ├── transfer-dialog.tsx     ← Transfer flow
│   │   └── return-dialog.tsx       ← Return flow
│   ├── bookings/
│   │   ├── booking-calendar.tsx    ← Calendar views
│   │   ├── booking-modal.tsx       ← Glass booking form
│   │   ├── day-view.tsx            ← Time slot view
│   │   ├── my-bookings.tsx         ← Personal bookings table
│   │   └── availability-heatmap.tsx
│   ├── maintenance/
│   │   ├── pipeline-stepper.tsx    ← Stage visualization
│   │   ├── maintenance-table.tsx   ← Data table + expand
│   │   ├── new-request-dialog.tsx  ← Report issue form
│   │   ├── detail-panel.tsx        ← Slide-out detail
│   │   └── sla-timer.tsx           ← Countdown badge
│   ├── audits/
│   │   ├── audit-cards.tsx         ← Cycle card grid
│   │   ├── audit-checklist.tsx     ← Verification table
│   │   ├── discrepancy-list.tsx    ← Flagged items
│   │   └── audit-kpis.tsx          ← Summary metrics
│   ├── reports/
│   │   ├── chart-grid.tsx          ← 2x2 chart layout
│   │   ├── utilization-chart.tsx
│   │   ├── category-donut.tsx
│   │   ├── department-bars.tsx
│   │   ├── cost-chart.tsx
│   │   ├── asset-heatmap.tsx       ← Color intensity grid
│   │   └── summary-table.tsx
│   ├── activity/
│   │   ├── activity-timeline.tsx   ← Infinite scroll feed
│   │   ├── notification-feed.tsx   ← Glass notification panel
│   │   └── notification-dropdown.tsx ← TopBar dropdown
│   └── shared/
│       ├── glass-card.tsx          ← Reusable glass container (light/medium/heavy props)
│       ├── status-badge.tsx        ← Asset status badges
│       ├── data-table.tsx          ← Generic TanStack table wrapper
│       ├── empty-state.tsx         ← Illustration + CTA
│       ├── page-header.tsx         ← Title + description + actions
│       ├── command-menu.tsx        ← ⌘K global search (glass)
│       ├── loading-skeleton.tsx    ← Shimmer skeletons
│       ├── confirm-dialog.tsx      ← Reusable confirmation
│       └── file-upload.tsx         ← Drag-drop upload zone
├── lib/
│   ├── utils.ts                    ← cn(), formatCurrency(), formatDate(), etc.
│   ├── constants.ts                ← Roles, states, categories, priorities
│   └── types.ts                    ← All TypeScript interfaces/types
├── stores/
│   ├── asset-store.ts              ← Assets CRUD + filters
│   ├── allocation-store.ts         ← Allocations + kanban state
│   ├── booking-store.ts            ← Bookings + calendar state
│   ├── maintenance-store.ts        ← Maintenance requests + pipeline
│   ├── audit-store.ts              ← Audit cycles + checklists
│   ├── notification-store.ts       ← Notifications + unread count
│   ├── auth-store.ts               ← Current user + role
│   └── ui-store.ts                 ← Sidebar, command menu, theme
├── hooks/
│   ├── use-scroll.ts               ← Detect scroll position (for glass topbar)
│   ├── use-keyboard-shortcut.ts    ← ⌘K and other shortcuts
│   ├── use-media-query.ts          ← Responsive hooks
│   └── use-debounce.ts
└── data/
    ├── mock-assets.ts              ← 50+ realistic assets
    ├── mock-employees.ts           ← 20+ employees with roles
    ├── mock-bookings.ts            ← 30+ bookings
    ├── mock-maintenance.ts         ← 25+ maintenance records
    ├── mock-activity.ts            ← 40+ activity entries
    └── mock-notifications.ts       ← 15+ notifications
```

---

## MOCK DATA (Realistic Indian Corporate)

**Company:** Nexora Technologies Pvt. Ltd.
**Size:** ~200 employees, 500+ assets, 3 offices
**Industry:** Enterprise SaaS

**Employees:**
| Name | Department | Role | Designation |
|------|-----------|------|-------------|
| Ridham Desai | Engineering | Admin | CTO |
| Priya Sharma | Engineering | Asset Manager | VP Engineering |
| Arjun Mehta | Engineering | Employee | Senior Developer |
| Neha Patel | Design | Dept Head | Design Lead |
| Vikram Singh | Marketing | Employee | Marketing Manager |
| Ananya Gupta | HR | Dept Head | HR Director |
| Rohit Joshi | Finance | Employee | Finance Analyst |
| Kavya Reddy | Engineering | Employee | Frontend Developer |
| Aditya Nair | Operations | Asset Manager | Ops Manager |
| Meera Iyer | Sales | Employee | Account Executive |
| Sanjay Kulkarni | Engineering | Employee | DevOps Engineer |
| Pooja Tiwari | Legal | Dept Head | General Counsel |

**Offices:**
- Mumbai HQ — Nexora Tower, BKC (Floor 1-5)
- Bangalore Tech Park — Whitefield, Wing A & B (Floor 1-3)
- Pune Dev Center — Hinjewadi Phase 2 (Floor 1-2)

**Asset Samples (with auto-generated Asset Tags):**
| Asset Tag | Asset | Serial | Category | Value | Status | Bookable |
|-----------|-------|--------|----------|-------|--------|----------|
| AF-0001 | MacBook Pro 14" M3 | NX-LAP-2024-0042 | IT > Laptops | ₹1,89,900 | Allocated | No |
| AF-0002 | Dell XPS 15 9530 | NX-LAP-2023-0118 | IT > Laptops | ₹1,42,000 | Available | No |
| AF-0003 | Samsung 34" Curved | NX-MON-2024-0205 | IT > Monitors | ₹52,000 | Allocated | No |
| AF-0004 | HP LaserJet Pro MFP | NX-PRN-2023-0015 | IT > Printers | ₹28,500 | Available | Yes ✓ |
| AF-0005 | Herman Miller Aeron | NX-FRN-2024-0301 | Furniture > Chairs | ₹1,15,000 | Allocated | No |
| AF-0006 | BenQ MH733 Projector | NX-PRJ-2023-0008 | Equipment > Projectors | ₹85,000 | Available | Yes ✓ |
| AF-0007 | Toyota Innova Crysta | NX-VEH-2022-0003 | Vehicles > Cars | ₹18,50,000 | Reserved | Yes ✓ |
| AF-0008 | iPad Pro 12.9" M2 | NX-TAB-2024-0067 | IT > Tablets | ₹1,12,000 | Under Maintenance | No |
| AF-0009 | Poly Studio X50 | NX-AV-2024-0012 | Equipment > AV | ₹2,45,000 | Allocated | Yes ✓ |
| AF-0010 | Logitech MX Master 3S | NX-PER-2024-0089 | IT > Peripherals | ₹8,500 | Available | No |

**Shared/Bookable Resources (appear in Resource Booking screen):**
- Meeting Room: Ganga (8 people, Floor 3, Mumbai HQ)
- Meeting Room: Kaveri (12 people, Floor 4, Mumbai HQ)
- Meeting Room: Narmada (6 people, Floor 2, Bangalore)
- Meeting Room: Godavari (20 people, Floor 5, Mumbai HQ — boardroom)
- Meeting Room: Krishna (4 people, Floor 1, Pune)
- Projector: BenQ MH733 (AF-0006, Floor 3, Mumbai HQ)
- Vehicle: Toyota Innova Crysta (AF-0007, Mumbai HQ garage)
- AV Equipment: Poly Studio X50 (AF-0009, Floor 4, Mumbai HQ)

---

## ANIMATION SYSTEM (Framer Motion)

```tsx
// lib/animations.ts — Consistent tokens

export const transitions = {
  fast: { duration: 0.15, ease: 'easeOut' },
  normal: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  spring: { type: 'spring', stiffness: 300, damping: 25 },
  springBouncy: { type: 'spring', stiffness: 400, damping: 20 },
}

export const variants = {
  // Page/section mount
  fadeUp: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
  },
  
  // Modal
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
  },
  
  // Sidebar items
  slideRight: {
    hidden: { opacity: 0, x: -8 },
    visible: { opacity: 1, x: 0 },
  },
  
  // Notification
  slideDown: {
    hidden: { opacity: 0, y: -12 },
    visible: { opacity: 1, y: 0 },
  },
  
  // Stagger children
  staggerContainer: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } },
  },
}
```

### Animation Rules:
- ✅ Mount animations: Cards, KPIs, list items (stagger)
- ✅ Modal open/close: Scale + fade (200ms)
- ✅ Sidebar collapse: Width transition (150ms)
- ✅ Hover states: Background color only (150ms CSS transition)
- ✅ Button press: Scale 0.97 (60ms)
- ✅ Number countup: KPI values animate from 0 (500ms)
- ✅ Chart draw: Lines/bars animate in on scroll intersection
- ✅ Notification bell: Brief wiggle on new notification
- ✅ Theme toggle: Sun↔Moon morph (layoutId)
- ❌ No page transitions (instant, like Linear)
- ❌ No bounce/overshoot physics
- ❌ Nothing > 300ms duration
- ❌ No layout-shift animations (no CLS)

---

## RESPONSIVE BREAKPOINTS

| Breakpoint | Width | Layout Changes |
|-----------|-------|----------------|
| Mobile | < 640px | Sidebar → bottom tab bar, tables → cards, 1-col grid, drawer modals |
| Tablet | 640-1024px | Sidebar → icon-only, 2-col grids, side panels → full-screen |
| Laptop | 1024-1280px | Full sidebar, 3-col grids, side panels 400px |
| Desktop | > 1280px | Full sidebar, 4-col grids, comfortable spacing, 2-panel layouts |

### Mobile-Specific Patterns:
- Bottom tab bar: 5 icons (Dashboard, Assets, Bookings, Maintenance, More)
- "More" → drawer with remaining nav items
- Tables become vertical card lists
- Kanban → stacked columns (horizontal scroll)
- Calendar → list view of upcoming bookings
- Slide-out panels → full-screen pages
- Floating Action Button (glass, bottom-right) for primary action per page

---

## THEME IMPLEMENTATION

```tsx
// app/layout.tsx
import { ThemeProvider } from 'next-themes'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  display: 'swap'
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <div className="relative min-h-screen">
            {/* Animated gradient mesh background */}
            <div className="gradient-mesh" aria-hidden="true" />
            <div className="gradient-blob-3" aria-hidden="true" />
            
            {/* App content */}
            <div className="relative z-10">
              {children}
            </div>
          </div>
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Theme Toggle Component:
- Animated morph between Sun and Moon icons
- Uses Framer Motion `layoutId` for smooth shape transition
- Cycles: Light → Dark → System
- System: Shows computer/monitor icon

---

## ACCESSIBILITY & KEYBOARD NAVIGATION

- All interactive elements have visible focus rings (`ring-2 ring-ring ring-offset-2`)
- Tab order follows visual layout (left→right, top→bottom)
- Command palette (⌘K) provides keyboard access to every action
- Escape closes modals, drawers, dropdowns
- Arrow keys navigate within menus and lists
- Enter/Space activates buttons and selections
- ARIA labels on all icon-only buttons
- Screen reader announcements for state changes (toast, status updates)
- Reduce motion: `prefers-reduced-motion` disables all animations
- Color is never the ONLY indicator (always paired with icon/text)

---

## BUILD ORDER (Sequential)

1. **Foundation:** Next.js 15 + Tailwind v4 + shadcn/ui init + next-themes + Inter font + Framer Motion + Zustand
2. **Globals:** CSS variables (light/dark) + glass utility classes + gradient mesh + Tailwind config
3. **shadcn Setup:** Install all needed components + customize theme tokens
4. **Layout Shell:** Glass sidebar + Glass-on-scroll topbar + Content wrapper + Mobile nav
5. **Shared Components:** GlassCard, StatusBadge, DataTable, PageHeader, EmptyState, CommandMenu, LoadingSkeleton
6. **Auth Pages:** Login + Signup with full glassmorphism showcase + 3D tilt + gradient bg
7. **Dashboard:** KPI cards + Activity feed + Charts + Quick actions
8. **Organization:** Tabs + Department cards + Category tree + Employee directory
9. **Assets:** Table/Grid views + Filters + Registration multi-step + Detail page + Timeline
10. **Allocations:** Kanban board + Drag-drop + Allocate/Transfer/Return dialogs
11. **Bookings:** Calendar (month/week/day) + Booking modal + My bookings + Heatmap
12. **Maintenance:** Pipeline stepper + Table + New request + Detail panel + SLA timer
13. **Audits:** Cycle cards + Checklist table + Verification radio + Discrepancy reports
14. **Reports:** Chart grid (4 charts) + Heatmap + Summary table + Export
15. **Activity:** Timeline feed + Notification panel + Bell dropdown
16. **Polish:** Skeletons everywhere + Empty states + Error states + Loading states
17. **Responsive:** Test all breakpoints, mobile nav, table→card transforms
18. **Final:** Dark mode audit, keyboard nav test, ARIA labels, performance check

---

## BASIC WORKFLOW (End-to-End Demo Flow — from PDF)

This is the story the demo tells to judges:

```
1. Admin sets up departments, asset categories, and promotes select employees 
   to Department Head / Asset Manager.
   → Screen 3: Organization Setup

2. Asset Manager registers a new asset, which enters the system as "Available."
   → Screen 4: Asset Registration (auto-tag AF-XXXX generated, QR created)

3. Asset is allocated to an employee/department (blocked if already allocated — 
   a transfer request is required instead) OR marked as a shared bookable resource.
   → Screen 5: Allocation (conflict rule demonstrated)

4. Employees book shared resources by time slot; overlapping requests are 
   rejected automatically.
   → Screen 6: Resource Booking (overlap validation demonstrated)

5. If an asset needs repair, the holder raises a maintenance request, which 
   must be APPROVED before work begins and before the asset flips to "Under Maintenance."
   → Screen 7: Maintenance (approval workflow demonstrated)

6. Assets are transferred or returned as needs change; overdue returns are 
   flagged automatically.
   → Screen 5: Return/Transfer flows + Dashboard KPIs

7. Periodic audit cycles assign auditors, verify assets, and auto-generate 
   discrepancy reports before closing.
   → Screen 8: Audit (close cycle → auto-update statuses)

8. All activity is tracked through notifications, logs, and reports.
   → Screen 10 + Screen 9
```

---

## WHY THIS WINS THE HACKATHON

1. **Glassmorphism creates spatial hierarchy** — Not a gimmick. The frosted glass makes floating elements feel elevated, creating clear visual layers that organize complex data.

2. **Gradient mesh background is alive** — Subtle animated blobs make the app feel living and modern, without being distracting. Glass needs something to blur against — this provides it.

3. **Every interaction has feedback** — Buttons scale on press, cards lift on hover, numbers count up on mount, modals spring in. Nothing is static.

4. **Indian corporate realism** — ₹ currency, Nexora Technologies, BKC Mumbai office, real designations. Judges will immediately feel "this could be our company."

5. **Data density without claustrophobia** — 14px base, tight table rows, but generous section padding and breathing room between components.

6. **Command palette (⌘K) shows product maturity** — It's not just CRUD screens. There's a power-user layer that says "this team thinks about workflows."

7. **Complete state coverage** — Loading skeletons (not spinners), empty states with illustrations, error handling with inline messages, success with toasts. Production-grade feel.

8. **Dark mode is a peer, not an afterthought** — Glass effects recalibrated, gradient intensities adjusted, all badges retested. It's a deliberate second design, not CSS variable swapping.

9. **Responsive doesn't break** — Sidebar → bottom tabs, tables → cards, kanban → stack, calendar → list. Mobile feels intentional, not squeezed.

10. **Consistent to a fault** — One font, one radius, one accent, one animation library, one glass system. The consistency is the design.

---

*Build this sequentially. Every screen fully functional with Zustand stores + realistic mock data. The demo should feel like a real product, not a prototype.*
