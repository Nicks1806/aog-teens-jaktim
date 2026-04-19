# Blueprint — Absensi Dashboard Kelapa Gading

> **Dokumen ini untuk Claude Code session baru.** Paste dokumen ini di awal chat baru (atau letakkan di folder project Kelapa Gading sebagai `CLAUDE.md`). Claude akan mengerti semua yang perlu dibuat.

---

## 🎯 Goal
Buat versi app absensi identik dengan **AOG Teens Jaktim** (https://absenibadahjaktim.vercel.app), tapi untuk region **Kelapa Gading**.

## 📚 Reference App (yang sudah jadi)
- **URL:** https://absenibadahjaktim.vercel.app
- **GitHub:** https://github.com/Nicks1806/aog-teens-jaktim
- **Source code:** single file `index.html` di repo tersebut
- **Apps Script:** `google-apps-script.gs` di repo tersebut

**Langkah pertama di chat baru:** clone/download `index.html` dari repo Jaktim sebagai starting point. Jangan buat dari 0.

---

## 🏗️ Tech Stack (SAMA dengan Jaktim)
- **Frontend:** Vanilla JS (no framework, no build step, no npm)
- **Backend:** Supabase (PostgreSQL + Realtime)
- **Deploy:** GitHub → Vercel auto-deploy
- **Sheets sync:** Google Apps Script (trigger per menit)
- **Struktur:** SINGLE FILE `index.html`

## 🚫 Aturan Ketat
- **JANGAN split ke multiple file** — harus tetap 1 `index.html`
- **JANGAN tambah build step** (no npm/webpack/vite)
- **JANGAN pakai framework** (no React/Vue/Svelte)
- **JANGAN pakai `prompt()`** — pakai `asyncPrompt()` yang ada di source
- **Hardcode Supabase URL + anon key** di client — RLS akan disabled (internal church app)

---

## 🌍 Region Configuration (Kelapa Gading-specific)

Ganti SEMUA referensi region di source code:
- `jaktim1` → `gading1`
- `jaktim2` → `gading2`
- Label "Jaktim 1" → "Gading 1"
- Label "Jaktim 2" → "Gading 2"
- Landing text "AOG Teens Jaktim 2026" → "AOG Teens Kelapa Gading 2026"
- Sheet names: `JAKTIM 1` → `GADING 1`, `JAKTIM 2` → `GADING 2`, dst.

**Cari & ganti** (case-sensitive) di `index.html`:
```
jaktim1  → gading1
jaktim2  → gading2
Jaktim 1 → Gading 1
Jaktim 2 → Gading 2
JAKTIM 1 → GADING 1
JAKTIM 2 → GADING 2
Jaktim   → Gading  (hati-hati, check one-by-one)
```

---

## 🗄️ Supabase Setup (BARU — buat project terpisah)

**JANGAN pakai project Supabase Jaktim.** Buat project Supabase baru untuk Kelapa Gading.

### Setup database
Buat 11 tabel identik dengan Jaktim (schema sama persis):

```sql
-- 1. members
CREATE TABLE members (
  id BIGSERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  cg TEXT NOT NULL,
  status TEXT,
  region TEXT,
  lahir TEXT,
  wa TEXT,
  sekolah TEXT,
  kelas TEXT,
  kelurahan TEXT,
  kecamatan TEXT,
  msj1 BOOLEAN, msj2 BOOLEAN, msj3 BOOLEAN,
  cgt1 BOOLEAN, cgt2 BOOLEAN, cgt3 BOOLEAN,
  baptis_air BOOLEAN, baptis_roh BOOLEAN,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. dates
CREATE TABLE dates (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  region TEXT NOT NULL,
  sort_order INTEGER,
  month_code TEXT
);

-- 3. attendance
CREATE TABLE attendance (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
  date_id BIGINT REFERENCES dates(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('H','I','S','A')),
  UNIQUE (member_id, date_id)
);

-- 4. cg_info
CREATE TABLE cg_info (
  cg TEXT PRIMARY KEY,
  leader TEXT,
  hari_jam TEXT,
  lokasi TEXT
);

-- 5. events (shared untuk semua CG)
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  date_start DATE,
  date_end DATE,
  cat TEXT,
  note TEXT,
  image TEXT
);

-- 6. cg_events (per CG)
CREATE TABLE cg_events (
  id BIGSERIAL PRIMARY KEY,
  cg TEXT,
  region TEXT,
  is_shared BOOLEAN DEFAULT false,
  name TEXT NOT NULL,
  date_start DATE,
  date_end DATE,
  cat TEXT,
  note TEXT,
  image TEXT
);

-- 7. cg_vision
CREATE TABLE cg_vision (
  id BIGSERIAL PRIMARY KEY,
  cg TEXT,
  region TEXT,
  visi TEXT,
  misi TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cg, region)
);

-- 8. cg_dev_plans
CREATE TABLE cg_dev_plans (
  id BIGSERIAL PRIMARY KEY,
  cg TEXT,
  region TEXT,
  member_name TEXT,
  current_status TEXT,
  target_status TEXT,
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. cg_pelayanan (jadwal pelayanan per minggu)
CREATE TABLE cg_pelayanan (
  id BIGSERIAL PRIMARY KEY,
  cg TEXT,
  region TEXT,
  month TEXT,
  week_date TEXT,
  role_name TEXT,
  member_name TEXT,
  UNIQUE (cg, week_date, role_name)
);

-- 10. cg_custom_roles (role custom per CG)
CREATE TABLE cg_custom_roles (
  id BIGSERIAL PRIMARY KEY,
  cg TEXT,
  region TEXT,
  role_name TEXT,
  abbr TEXT,
  color TEXT,
  bg TEXT
);

-- 11. member_notes (catatan CGL per member)
CREATE TABLE member_notes (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  cgl_note TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. coach_notes
CREATE TABLE coach_notes (
  id BIGSERIAL PRIMARY KEY,
  cg TEXT,
  region TEXT,
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cg, region)
);
```

### Disable RLS (internal church app)
```sql
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE dates DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_vision DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_dev_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_pelayanan DISABLE ROW LEVEL SECURITY;
ALTER TABLE cg_custom_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE member_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE coach_notes DISABLE ROW LEVEL SECURITY;
```

### Enable Realtime
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_pelayanan;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_events;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_vision;
```

### Di `index.html` line ~426
Ganti:
```javascript
const SUPABASE_URL = 'https://[NEW-PROJECT].supabase.co';
const SUPABASE_KEY = '[NEW-ANON-KEY]';
```

---

## 📝 Data Awal (Kelapa Gading)

**User harus sediakan data member** dalam format CSV (seperti Jaktim):
- Nama lengkap
- CG (misal "GADING 01", "GADING 02", dll)
- Status (CGL / Sponsor / Member / Simpatisan / VIP)
- Region (gading1 atau gading2)
- Tanggal lahir, WA, sekolah, kelas, kelurahan, kecamatan

**Minta user isi template ini dulu** sebelum generate INSERT SQL.

Lalu:
1. Insert data members via SQL atau Supabase Table Editor
2. Insert `cg_info` per CG (leader, jadwal, lokasi)
3. Tanggal ibadah: bisa dibiarkan kosong, nanti coach/TL pakai fitur **Generate Sabtu** di web

---

## 🎨 UI / Fitur (COPY 100% dari Jaktim)

App punya 3 halaman utama:

### 1. Landing Page (`pageL`)
- Header: "THE YEAR OF / UNITY / & OPEN HEAVENS"
- Title besar **"Absensi Dashboard"** (Instrument Serif) — user bisa rename jadi "AOG Teens Kelapa Gading"
- Subtitle "AOG Teens Kelapa Gading 2026"
- Region toggle: **GADING 1 / GADING 2** (pill button, purple active)
- **Custom dropdown CG Leader** (bukan native select) — klik tampil panel dengan nama CGL per CG, warna soft hover
- Tombol **"Masuk Dashboard →"** (gradient purple)
- Link kecil di bawah: "Coach / TL? Masuk disini →" (ke `?role=coach`)

### 2. CGL Dashboard (`pageD`) — per CG
Header: badge CG + nama CGL + "Live" indicator (hijau = realtime connected)
Hero: "Rekap CG" + meta (anggota · hari · lokasi) + **Visi Coach region** (big serif italic di kanan)
Stats cards: Hadir / Izin / Sakit / Alpa (counts + %)

**6 Tab:**
1. **Absensi** — tabel member × tanggal, click dot untuk cycle H→I→S→A→null, chart progress per minggu (SVG), Total Hadir row, export PDF + CSV, mobile month filter (≤600px)
2. **Detail CG** — per-member card: edit field langsung, milestone chips toggle, catatan CGL, Tambah/Hapus member
3. **Visi CG** — edit Visi/Misi, Rencana Pengembangan Member (modal)
4. **Pelayanan** — jadwal per minggu per bulan, multi-assignee, custom role, statistik
5. **Milestone** — donut chart + filter chips (Semua/MSJ/CGT/Baptis) + per-member progress bars
6. **Events** — CRUD event dengan date range + image, countdown badge, auto-cleanup past events

### 3. Coach/TL Dashboard (`pageC`)
Header: Coach / TL toggle (pill switch)
Hero: "Semua CG" + meta global
Stats cards: Member / Avg Hadir / At Risk / Blm MSJ1

**5 Tab:**
1. **Overview** — region toggle (Coach only), Visi Coach per region (editable), CG cards grid
2. **Absensi** — per-CG cards dengan attendance table, chart, Generate Sabtu button, Export PDF/CSV
3. **Milestone** — filter chips, donut, **Daftar Follow-up Semua CG** (grouped by CG, collapsible), Breakdown per CG (matrix table)
4. **Visi** — accordion per CG (click expand), 4 cards: Visi, Misi, Dev Plan, Catatan Coach
5. **Events** — filter chips + CRUD + Tambah Event (target: semua CG atau CG tertentu)

---

## ✨ Fitur Penting (semua HARUS jalan)

### Absensi
- ✅ Click dot cycle status (H→I→S→A→null)
- ✅ Optimistic UI + error revert (kalau save gagal, dot balik)
- ✅ Debounce double-tap (`_DOT_SAVING` guard)
- ✅ **Undo 3.5 detik** setelah tap (toast dengan tombol Undo)
- ✅ Chart SVG progress per minggu (pure, no library)
- ✅ Total Hadir row (denominator = total member)
- ✅ Mobile month filter (≤600px, tombol ‹ ›)
- ✅ Sticky name column saat scroll horizontal
- ✅ Export PDF (open print window)
- ✅ Export CSV (UTF-8 BOM untuk Excel)

### Supabase Realtime
- ✅ WebSocket channel `app-sync` subscribe ke attendance, members, cg_pelayanan, events, cg_events, cg_vision
- ✅ Attendance: patch per-dot via `data-mid`/`data-did` attributes
- ✅ Auto-reconnect saat disconnect (5s timeout + window.online event)
- ✅ Live indicator 🟢/🔴 reflects connection status

### Pelayanan
- ✅ Multi-assignee (comma-separated di kolom `member_name`)
- ✅ Custom popover "+ Tambah" (bukan native select)
- ✅ Bulan selector + add bulan baru
- ✅ Week pills dengan edit/delete per minggu
- ✅ Default roles: Firman CG, PAW, Game, Sharing
- ✅ Custom role per CG (warna + abbr bebas)
- ✅ Statistik: Distribusi Jenis, Top Pelayanan (top 3), Belum Pernah/Jarang
- ✅ Rekap Bulanan tabel (multi-assignee aware)

### Events
- ✅ Date range (start + end, keduanya opsional)
- ✅ Image upload (base64 in DB) atau URL
- ✅ Countdown badge ("HARI INI", "3 hari lagi", "5 hari lalu")
- ✅ Filter chips (cached, instant)
- ✅ Auto-cleanup past events saat page load
- ✅ Copy text / WA broadcast / Edit / Delete per card
- ✅ Birthday countdown list dari `members.lahir`

### Generate Sabtu (Coach/TL only)
- ✅ Tombol "+ Generate Sabtu [Bulan] [Tahun]" di Coach Absensi
- ✅ Auto-detect bulan berikutnya dari tanggal terakhir
- ✅ Insert semua Sabtu di bulan target ke `dates` table
- ✅ Duplicate-safe (normalize leading zero)

### Visi Coach per Region
- ✅ Disimpan di `cg_vision` dengan `cg='__COACH_gading1__'` / `'__COACH_gading2__'`
- ✅ Coach edit di Overview tab
- ✅ Read-only banner di CGL dashboard header (kanan hero)

### Detail CG
- ✅ Inline edit (nama, WA, lahir, sekolah, kelurahan) — auto-save onblur
- ✅ Role dropdown (CGL/Sponsor/Member/Simpatisan/VIP)
- ✅ Milestone chips toggle
- ✅ Catatan CGL per member (textarea)
- ✅ Tambah Member modal
- ✅ **Hapus Member** (purge attendance + notes + member)

---

## 🎨 Styling / Color Palette

**Purple primary:** `#6C5CE7` (gradient dengan `#8B5CF6`, `#a855f7`)
**Role colors:**
- CGL: oranye `#fff3e0` bg
- Sponsor: biru `#e8eaf6`
- Member: putih
- Simpatisan: pink `#fce4ec`
- VIP: ungu muda `#f3e5f5`

**Status colors:**
- Hadir (H): hijau `#c6efce` bg / `#276221` text
- Izin (I): biru `#bdd7ee` bg / `#1f497d`
- Sakit (S): kuning `#ffeb9c` bg / `#9c6500`
- Alpa (A): merah `#ffc7ce` bg / `#9c0006`

**CG Colors (Jaktim):** TEEN 01 biru, TEEN 06 pink, TEEN 09 hijau, TEEN 23 oranye, TEEN 07 merah, TEEN 12 hijau tua, TEEN 17 biru tua, TEEN 20 pink.
→ **Ganti sesuai CG Gading.** Example: GADING 01 ungu, GADING 02 biru, dst.

Update constant `CG_COLORS`, `CG_BG`, `CG_INIT` di source code.

**Fonts:**
- Body: Inter (sans-serif)
- Heading serif: Instrument Serif (dari Google Fonts)

**Mobile responsive:**
- Viewport: `maximum-scale=1, user-scalable=no` (no iOS zoom)
- Dot touch targets 36px + `touch-action: manipulation`
- Breakpoint ≤600px untuk mobile month filter

---

## 🚀 Deploy Workflow

### GitHub
1. Create new repo (misal `aog-teens-kelapa-gading`)
2. Push `index.html` + `google-apps-script.gs` + `CLAUDE.md`

### Vercel
1. Import repo dari GitHub
2. Build settings: **Framework Preset = Other**, no build command, output dir `.`
3. Deploy → dapat URL `https://absen-kelapa-gading.vercel.app` (atau custom)

### Google Sheets Sync
1. Buat Google Sheets baru dengan tabs: `GADING 1`, `GADING 2`, `DETAIL GADING 1`, `DETAIL GADING 2`
2. Extensions → Apps Script → paste `google-apps-script.gs` (ganti `SUPABASE_URL` + `KEY` + `REGION_CONFIG`)
3. Set trigger `runAutoSync` every 1 minute
4. Run `fullRebuild` pertama kali untuk populate sheet

---

## 📂 Project Structure

```
absen-kelapa-gading/
├── index.html              (single file app — copy dari Jaktim + modifikasi)
├── google-apps-script.gs   (copy dari Jaktim + ganti sheet names + Supabase)
├── CLAUDE.md               (salinan file ini sebagai project instructions)
└── README.md               (opsional)
```

---

## 🔍 File Reference dari Jaktim yang WAJIB di-clone

Di chat baru, **download file ini dari Jaktim repo**:
1. `https://raw.githubusercontent.com/Nicks1806/aog-teens-jaktim/main/index.html`
2. `https://raw.githubusercontent.com/Nicks1806/aog-teens-jaktim/main/google-apps-script.gs`
3. `https://raw.githubusercontent.com/Nicks1806/aog-teens-jaktim/main/CLAUDE.md`

Ini starting point. Jangan tulis ulang dari 0.

---

## 📋 Checklist Migration Kelapa Gading

### Setup
- [ ] Create Supabase project baru
- [ ] Run SQL create 12 tabel
- [ ] Disable RLS di semua tabel
- [ ] Enable Realtime publication
- [ ] Create GitHub repo baru
- [ ] Clone `index.html` + `google-apps-script.gs` dari Jaktim

### Modify source code
- [ ] Ganti `SUPABASE_URL` + `SUPABASE_KEY` (line ~426-427)
- [ ] Global find-replace: `jaktim1` → `gading1`, `jaktim2` → `gading2`, `Jaktim` → `Gading`, `JAKTIM` → `GADING`
- [ ] Update `CG_COLORS`, `CG_BG`, `CG_INIT` constants untuk CG Kelapa Gading
- [ ] Update landing title "AOG Teens Jaktim 2026" → "AOG Teens Kelapa Gading 2026"
- [ ] Update title tag `<title>AOG Teens — CG Dashboard (Live)</title>` kalau perlu

### Data
- [ ] Import members (via SQL atau Supabase Table Editor)
- [ ] Insert `cg_info` (1 row per CG dengan leader, jadwal, lokasi)

### Apps Script
- [ ] Paste `google-apps-script.gs` ke Apps Script editor
- [ ] Ganti `SUPABASE_URL` + `SUPABASE_KEY`
- [ ] Ganti `REGION_CONFIG` (sheet names + dateStartCol)
- [ ] Run `fullRebuild` sekali

### Deploy
- [ ] Push ke GitHub main branch
- [ ] Connect Vercel ke repo
- [ ] Test URL production

### Verify
- [ ] Landing page load ok
- [ ] Pilih CGL → dashboard terbuka
- [ ] Click dot absensi → save ok
- [ ] Buka Coach dashboard → data muncul
- [ ] Tombol Generate Sabtu → tanggal masuk
- [ ] Google Sheets auto-sync jalan

---

## 💡 Tips

- **Start simple:** copy verbatim dari Jaktim dulu, ganti Supabase URL + region names. Pastikan semua fitur jalan di Gading sebelum customize.
- **Custom CG colors** bisa dilakukan belakangan — default purple juga OK untuk semua CG.
- **Jangan buat dari 0.** Repo Jaktim adalah hasil iterasi berkali-kali, banyak edge case sudah di-fix.

---

## 🆘 Kalau Bingung

Baca juga `CLAUDE.md` di repo Jaktim untuk detail RULES, DON'Ts, dan catatan arsitektur lebih dalam. Semua keputusan desain sudah didokumentasikan di sana.
