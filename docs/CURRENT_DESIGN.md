# AOG Teens Jaktim — Current UI/UX Design Reference (v31)

> ⚠️ **Desain LAMA (v31).** Desain aktif sejak v32 = tata letak baru (sidebar + bottom nav) dengan warna & font v31 — lihat **CLAUDE.md → Desain (v32 — redesign)**. Link "Coach / TL? Masuk disini" di landing sudah dihapus (v32); Coach/TL buka lewat `/coach` atau `/tl`.


> **Tujuan file ini:** Referensi lengkap desain visual + struktur UI saat ini, untuk dipakai sebagai base redesign di Claude Design.

---

## 1. Design System — Tokens & Variables

### Color Palette (CSS Custom Properties)

```css
:root {
  /* Brand */
  --purple: #6C5CE7;         /* Primary — buttons, accents, active states */
  
  /* Semantic */
  --green:  #16a34a;         /* Success, Hadir (H) */
  --blue:   #2563eb;         /* Info, Izin (I) */
  --orange: #d97706;         /* Warning, Sakit (S) */
  --red:    #dc2626;         /* Error, Alpa (A) */
  
  /* Grays (6-step scale) */
  --g1: #1c1c1c;             /* Text primary */
  --g2: #555;                /* Text secondary */
  --g3: #888;                /* Text tertiary / placeholder */
  --g4: #bbb;                /* Disabled / muted */
  --g5: #ddd;                /* Borders */
  --g6: #f0f0ed;             /* Background subtle */
  --white: #fff;
  
  /* Attendance Status — each has 3 tokens: color, background, border */
  --H:  #16a34a;  --Hb: #f0fdf4;  --Hbr: #bbf7d0;   /* Hadir */
  --I:  #2563eb;  --Ib: #eff6ff;  --Ibr: #bfdbfe;   /* Izin */
  --S:  #d97706;  --Sb: #fffbeb;  --Sbr: #fde68a;   /* Sakit */
  --A:  #dc2626;  --Ab: #fef2f2;  --Abr: #fecaca;   /* Alpa */
}
```

### Typography

| Usage | Font | Size | Weight | Notes |
|-------|------|------|--------|-------|
| Body text | `'Inter', sans-serif` | 12-13px | 400-500 | Google Fonts CDN |
| Headings (hero) | `'Instrument Serif', serif` | 26-44px | 400 | Italic for emphasis (`<em>`) |
| Labels/tags | Inter | 9-10px | 500-600 | `letter-spacing: 1-2px`, `text-transform: uppercase` |
| Stats numbers | Instrument Serif | 24px | 400 | Used in stat cards |
| Version badge | Inter | 9px | 600 | `letter-spacing: .3px` |

### Spacing & Layout

- **Max content width:** 900px (`max-width: 900px; margin: 0 auto`)
- **Body padding:** 16px horizontal
- **Section padding:** 16px
- **Card padding:** 14-18px
- **Gap between cards:** 12-14px
- **Border radius:** 8-16px (small=8, medium=12, large=16)

### Shadows

```css
/* Light elevation */
box-shadow: 0 4px 14px rgba(108,92,231,.06);   /* Cards */
box-shadow: 0 6px 20px rgba(108,92,231,.12);   /* Cards hover */
box-shadow: 0 12px 36px rgba(108,92,231,.18);  /* Dropdowns/Modals */
box-shadow: 0 8px 30px rgba(0,0,0,.12);        /* Role menu */
```

### Border Styles

- Default: `1px solid var(--g5)` (#ddd)
- Active/focus: `border-color: var(--purple)`
- Purple accent: `2px solid #e4dcff` → hover `#c4b5fd`
- Event card left: `border-left: 4px solid var(--purple)`

---

## 2. Landing Page (`pageL`)

### Layout
- Centered flex column, full viewport height
- Background: `radial-gradient(ellipse at top, #faf5ff, #f8f8f5 60%)` — subtle purple radial

### Components (top to bottom)

#### 2.1 Church Theme Banner
```
THE YEAR OF           ← 13px, uppercase, letter-spacing:3px, color:--g3
UNITY                 ← 44px, Inter bold 900, letter-spacing:-2px
& OPEN HEAVENS        ← 22px, Inter bold 800
```

#### 2.2 Title
```
Absensi Dashboard     ← Instrument Serif, 44px
AOG TEENS JAKTIM 2026 ← 13px, uppercase, letter-spacing:1.5px
```

#### 2.3 Region Toggle (Pill Switcher)
- Container: `backdrop-filter: blur(10px)`, rounded 24px, subtle shadow
- Inactive: transparent bg, gray text
- Active: `linear-gradient(135deg, #6C5CE7, #8B5CF6)`, white text, purple shadow glow
- Transition: `cubic-bezier(.4,0,.2,1)` 0.3s
- Padding: 10px 32px per button

#### 2.4 CG Leader Dropdown (Custom)
- NOT a native `<select>` — custom div panel with avatar-like items
- Trigger: white bg, purple border `#e4dcff`, rounded 14px, shadow
- Panel: absolute, white bg, purple border, shadow `0 12px 36px`, max-height 340px scroll
- Chevron SVG animates rotation on open
- Width: 100%, max-width 420px

#### 2.5 Enter Button
- Full width (max 420px), 16px padding, rounded 16px
- Gradient: `linear-gradient(135deg, #6C5CE7, #8B5CF6)`
- Shadow: `0 6px 20px rgba(108,92,231,.35)`
- Hover: translateY(-2px), increased shadow
- Disabled: gray bg (#e5e5e5), gray text, no shadow
- Arrow `→` after text, slides right on hover

#### 2.6 Coach/TL Link
- Pill-shaped, frosted glass effect: `backdrop-filter: blur(10px)`, light purple border
- Text: "Coach / TL? Masuk disini →" with purple link

---

## 3. CGL Dashboard (`pageD`)

### 3.1 Navigation Bar (Sticky)
- Sticky top:0, z-index:100
- White bg, bottom border
- Left: ← Back arrow + CG badge (colored pill) + CGL name
- Right: 🔔 bell + Live indicator (green pulsing dot + "Live" text) + version "v31"

### 3.2 Hero Section
- Flex row (desktop), wraps on mobile
- Left side:
  - Tag: "Januari — April 2026" (9px uppercase)
  - Title: "Rekap\nCG." (Instrument Serif, 26-42px responsive via clamp)
  - Meta: "X anggota · jadwal · lokasi"
- Right side: Coach region visi (Instrument Serif italic, 22-34px, muted)

### 3.3 Stats Bar (4 columns)
- Grid: `repeat(4, 1fr)`, full width
- Each stat: label (9px uppercase) + number (Instrument Serif 24px) + percentage (10px)
- Colors: Hadir=green, Izin=blue, Sakit=orange, Alpa=red
- Mobile: 2×2 grid

### 3.4 Tab Bar (6 tabs)
- Sticky below nav (top:49px, z-index:99)
- Horizontal scroll, hidden scrollbar
- Active tab: bottom border 2px purple, dark text
- Inactive: gray text, transparent border
- Tabs: Absensi | Detail CG | Visi CG | Pelayanan | Milestone | Events

### 3.5 Tab: Absensi
- Full-width table with:
  - Sticky first column (Nama) — white bg, z-index:2
  - Date columns as headers
  - **Dot cells** — 36×36px rounded squares, color-coded per status
  - Footer row: "Total Hadir" with counts
- Below table: Line chart (pure SVG, not Chart.js)
- Export buttons: "📊 Absensi CSV" + "📄 Absensi PDF" (top right)
- Mobile: month filter with ‹ › navigation

#### Dot Component
```css
.dot {
  width: 36px; height: 36px;
  border-radius: 8px;
  font-size: 11px; font-weight: 700;
  touch-action: manipulation;
}
/* 4 states + empty */
.dot.H { bg: #f0fdf4, color: #16a34a, border: #bbf7d0 }
.dot.I { bg: #eff6ff, color: #2563eb, border: #bfdbfe }
.dot.S { bg: #fffbeb, color: #d97706, border: #fde68a }
.dot.A { bg: #fef2f2, color: #dc2626, border: #fecaca }
.dot.X { bg: #f0f0ed, color: #bbb, border: #ddd }      /* empty */
```

### 3.6 Tab: Detail CG
- Cards (`dcard`) per member:
  - Top: name (14px bold) + role badge (colored pill)
  - Grid: 2-col info (WA, Lahir, Sekolah, Kelas, Kelurahan, Kecamatan)
  - v31: Sekolah + Kelas = 2 input inline terpisah; Kelurahan + Kecamatan = 2 input inline terpisah (dulu digabung 1 input). Placeholder text muncul kalau kosong
  - Milestone chips: 8 small pills (MSJ 1-3, CGT 1-3, B.Air, B.Roh) — green=done, gray=pending
  - CGL notes textarea
  - Delete button (red, bottom right)
- "+ Tambah Member" button

#### Role Badge Colors
| Role | Background | Text | Border |
|------|-----------|------|--------|
| CGL | #f0fdf4 | #16a34a | #bbf7d0 |
| Sponsor | #eff6ff | #2563eb | #bfdbfe |
| Member | #faf5ff | #7c3aed | #c4b5fd |
| Simpatisan | #fff7ed | #d97706 | #fdba74 |
| VIP | #fef2f2 | #dc2626 | #fecaca |

#### Role Button (Dropdown Trigger) Colors
| Role | Background | Text |
|------|-----------|------|
| CGL | #dcfce7 | #15803d |
| Sponsor | #dbeafe | #1d4ed8 |
| Member | #ede9fe | #6d28d9 |
| Simpatisan | #ffedd5 | #c2410c |
| VIP | #ffe4e6 | #be123c |

**Warna per-CG (`CG_COLORS` / `CG_BG`):**

| CG | Color | BG |
|----|-------|-----|
| TEEN 01 | #1d4ed8 | #eff6ff |
| TEEN 06 | #be185d | #fdf2f8 |
| TEEN 07 | #b45309 | #fffbeb |
| TEEN 09 | #c2410c | #fff7ed |
| TEEN 12 | #0f766e | #f0fdfa |
| TEEN 17 | #0e7490 | #ecfeff |
| TEEN 20 | #be123c | #fff1f2 |
| TEEN 23 | #7c3aed | #faf5ff |
| TEEN 25 (baru v31) | #4f46e5 | #eef2ff |

### 3.7 Tab: Visi CG
- Visi card: `bg: var(--g6)`, rounded 10px
  - Label: 10px uppercase, letter-spacing 1.5px
  - Textarea: dashed border, white bg, focus=purple
- Misi: numbered list with yellow badge, dashed separators — click to edit
- Dev Plan section: cards with deadline countdown badges (color-coded)

### 3.8 Tab: Pelayanan
- Month selector + week pills
- Table with role columns, multi-assignee support
- Custom selects with Inter font
- Statistik section below

### 3.9 Tab: Milestone
- Donut charts: pure SVG, 8 donuts for MSJ 1-3, CGT 1-3, B.Air, B.Roh
- Filter chips: "Semua" | "MSJ" | "CGT" | "Baptis"
- Progress bars per member: 4px track, gradient fill

### 3.10 Tab: Events
- Event cards:
  - Left border 4px purple
  - Date (10px, purple, uppercase)
  - Name (14px bold)
  - Note (12px, gray)
  - Category chip (9px, colored)
  - Countdown badge
  - Action buttons: Copy, WhatsApp, Edit, Delete (30×30px icon buttons)

#### Event Action Button Styles
| Button | Border | Text | BG | Hover BG |
|--------|--------|------|----|----------|
| Copy | #e5e7eb | #6b7280 | #fff | #f9fafb |
| WhatsApp | #86efac | #16a34a | #f0fdf4 | #dcfce7 |
| Edit | #c4b5fd | #7c3aed | #f5f3ff | #ede9fe |
| Delete | #fecaca | #dc2626 | #fef2f2 | #fee2e2 |

---

## 4. Coach/TL Dashboard (`pageC`)

### 4.1 Navigation Bar
- Same sticky pattern as CGL
- Left: ← Back + "Coach" label + Role toggle (COACH/TL pill switcher)
- Right: Search bar (expands on focus) + version + bell + Live indicator
- Search: purple border `#e4dcff`, magnifying glass SVG icon, rounded 20px
- Mobile: search collapses to icon-only (36px wide), expands on focus

### 4.2 Hero Section
- Same pattern as CGL but shows region info
- Title: "Semua\nCG." or "Jaktim 1\nCG."

### 4.3 Stats Bar (4 stats)
- Member count | Avg Hadir % | At Risk (<50%) | Blm MSJ1
- Same grid as CGL

### 4.4 Tab Bar (5 tabs)
- Overview | Absensi | Milestone | Visi | Events

### 4.5 Tab: Overview
- Region toggle (Coach only): JAKTIM 1 / JAKTIM 2 pills
- Visi Coach: editable card
- CG Cards grid: `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))`
  - Each card: white, border, rounded 14px, 18px padding
  - Hover: purple border, shadow, translateY(-2px)
  - Click → enters CG dashboard
- Bar chart comparison (SVG)
- **Distribusi Wilayah** section:
  - Chip filters 2-level: Kecamatan (purple) + Kelurahan (violet)
  - Each chip shows count: e.g. "Pulogadung (5)"
  - Member list below filters
  - Export Wilayah CSV button

### 4.6 Tab: Absensi
- Per-CG expandable cards with dot tables (dots clickable by Coach too)
- Line chart per CG + global region chart
- Pending CGL list with "Ingatkan" buttons
- Generate Sabtu button

### 4.7 Tab: Milestone
- Same as CGL but with per-CG accordion breakdown
- Daftar Follow-up (progression-aware)

### 4.8 Tab: Visi
- Accordion per CG (click header to expand)
- Inside each: Visi, Misi, Dev Plan, Catatan Coach
- Preserve expand state across realtime re-renders

### 4.9 Tab: Events
- Same as CGL events but with Target dropdown (Global / Region / Per-CG)

---

## 5. Shared Components

### 5.1 Toast
```css
.toast {
  position: fixed; bottom: 20px; left: 50%;
  transform: translateX(-50%) translateY(80px);  /* hidden */
  background: #1c1c1c; color: #fff;
  padding: 10px 20px; border-radius: 10px;
  font-size: 12px; font-weight: 600;
  z-index: 9999;
  max-width: 90vw;
}
.toast.show { transform: translateX(-50%) translateY(0); }
```

### 5.2 Modal
- Overlay: `rgba(0,0,0,.4)`, fixed inset, z-index:200
- Box: white, rounded 16px, 24px padding, max-width 420px, max-height 80vh scroll
- Title: 15px bold
- Inputs: 1px border, rounded 8px, focus=purple
- Buttons: purple (primary) + dashed outline (secondary)

### 5.3 Section Card
```css
.section {
  background: var(--white);
  border: 1px solid var(--g5);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
}
```

### 5.4 Filter Chips
```css
.chip {
  font-size: 10px; padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid var(--g5);
}
.chip.on { background: var(--g1); color: #fff; border-color: var(--g1); }
```

### 5.5 Skeleton Loader
- Pulse animation: `opacity .55 → .95` over 1.4s
- Gradient bg: `#f3f4f6 → #fafafa → #f3f4f6` shimmer

### 5.6 Live Indicator
- Green dot: 6px, pulsing animation (opacity 1→0.4→1, 2s loop)
- Label: "Live" (10px, green, bold)
- Offline: red dot, "Offline" label

### 5.7 Percentage Bar
```css
.pbar { display: flex; align-items: center; gap: 6px; }
.pbar-track { height: 3px; background: var(--g5); border-radius: 3px; }
.pbar-fill { height: 100%; border-radius: 3px; }  /* color set inline */
.pbar-val { font-family: Instrument Serif; font-size: 15px; }
```

---

## 6. Animations & Transitions

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Region button | all | 0.3s | `cubic-bezier(.4,0,.2,1)` |
| Enter button hover | transform, shadow | 0.25s | `cubic-bezier(.4,0,.2,1)` |
| Tab switch | opacity, translateY | 0.2s | ease |
| Dot hover | transform (scale 1.15) | 0.15s | - |
| Card hover | border, shadow, translateY(-2px) | 0.2s | - |
| Toast show | transform translateY | 0.3s | ease |
| Fade in | opacity 0→1, translateY -4→0 | 0.15s | ease |
| Skeleton pulse | opacity .55→.95 | 1.4s | ease-in-out infinite |
| Live dot pulse | opacity 1→.4 | 2s | infinite |

---

## 7. Responsive Breakpoints

### ≤640px
- Stats grid: 2×2 (instead of 1×4)
- Detail info grid: 1 column
- Region toggle buttons: smaller padding (8px 24px)
- Dev plan rows: column direction
- Visi cards container: 1 column

### ≤600px
- Coach search: collapses to 36px icon, expands on focus to full width
- Coach nav: flex-wrap
- Absensi table: month filter (current month only + ‹ › navigation)

### General Mobile
- Viewport: `maximum-scale=1, user-scalable=no` (prevent iOS zoom)
- Touch targets: 36px minimum (dots)
- `touch-action: manipulation` on interactive elements

---

## 8. External Dependencies (CDN)

| Library | Version | CDN | Purpose |
|---------|---------|-----|---------|
| Supabase JS | v2 | cdn.jsdelivr.net | Database client + Realtime |
| Inter | - | Google Fonts | Body font |
| Instrument Serif | - | Google Fonts | Display/heading font |

**No other JS/CSS libraries.** Charts are pure SVG. No Chart.js, no D3, no Tailwind.

---

## 9. Icon System

Tidak pakai icon library — semua icon adalah:
- **Emoji** (🔔 📊 📄 📷 📎 📈 💾 🌏 ⛪ 🎂 🏕️ 📖 👥 📌 🔔 🔥 ⏰ ⚠)
- **Inline SVG** (chevron dropdown, search magnifying glass, chart elements)
- **CSS-only** (dots, role indicators, chevron via border-trick)

---

## 10. Print/Export Styles

Separate `<style>` block used in new print window:
- Font: Inter + Instrument Serif (fallback: Arial, Georgia)
- Body padding: 24px
- Table: full width, collapse borders, small font (10px)
- Status cells: colored backgrounds matching dot colors
- CG header: purple left border 4px, light purple bg `#faf5ff`
- Footer: centered, border-top, gray text 9px
- `@media print`: no body padding, page breaks

---

## 11. Key Design Characteristics (Summary)

### Identity
- **Warm neutral** base (#f8f8f5) — not pure white, not gray
- **Purple (#6C5CE7)** as single accent color — used for all interactive elements
- **Serif + Sans-serif pairing** — Instrument Serif for display, Inter for body
- **No dark mode** currently

### Style Direction
- Clean, minimal, slightly editorial feel (serif headings)
- Soft shadows and subtle borders
- Rounded corners (8-16px radius)
- Status-coded color system (green/blue/orange/red) consistent throughout
- Frosted glass effects on landing (backdrop-filter blur)
- Purple gradient for primary actions (buttons, active toggle)

### Interaction
- Click-to-cycle dots (H→I→S→A→empty)
- Optimistic UI with revert on error
- Toast notifications (bottom center, dark bg)
- Custom dropdowns (not native select)
- Accordion expand/collapse with state preservation
- Sticky nav + tab bar on scroll

### Overall Feel
- **Professional but approachable** — church youth ministry context
- **Data-dense but organized** — tabs keep complexity manageable
- **Mobile-first interactions** — touch-friendly dots, collapsible search
- **Real-time collaborative** — live indicator, instant sync visual
