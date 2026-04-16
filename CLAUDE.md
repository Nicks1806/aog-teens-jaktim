# AOG Teens Jaktim — CG Dashboard (Absensi + Management)

## Project Overview
Single-file web app untuk tracking attendance, pelayanan, milestone, events, dan visi CG untuk AOG Teens Jakarta Timur. Dipakai oleh ~54 member, 8 CG Leaders, 2 Coach, dan 1 Team Leader secara bersamaan saat ibadah hari Minggu.

**URL Production:** https://absenibadahjaktim.vercel.app
**Coach/TL URL:** https://absenibadahjaktim.vercel.app/?role=coach

---

## Tech Stack
- **Frontend:** Vanilla JS (NO framework, NO build step, NO npm/node)
- **Backend:** Supabase (PostgreSQL + Realtime WebSocket)
- **Deployment:** GitHub → Vercel (auto-deploy on push to main)
- **Sheets Sync:** Google Apps Script (auto-sync per 1 menit dari Supabase → Google Sheets)
- **File structure:** **SINGLE FILE** — `index.html` (semua HTML/CSS/JS dalam 1 file)

## GitHub Repo
- **Repo:** https://github.com/Nicks1806/aog-teens-jaktim
- **Branch:** main
- **Vercel:** connected to main branch, auto-deploy

---

## Supabase Config
- **URL:** `https://gqppviugodokncxezdwd.supabase.co`
- **Anon Key:** di dalam `index.html` line ~427
- **RLS:** DISABLED di semua tabel (untuk kemudahan internal church app)
- **Realtime:** ENABLED via `ALTER PUBLICATION supabase_realtime ADD TABLE ...` untuk 6 tabel

### Tabel Database (11 tabel)

| Tabel | Fungsi | Key Columns |
|-------|--------|-------------|
| `members` | Data member (54 orang) | id, nama, cg, status, region, lahir, wa, sekolah, kelas, kelurahan, kecamatan, msj1-3, cgt1-3, baptis_air, baptis_roh |
| `attendance` | Data absensi per member per tanggal | member_id, date_id, status (H/I/S/A) |
| `dates` | Daftar tanggal ibadah | id, label, region, sort_order, month_code |
| `cg_info` | Info CG (leader, jadwal, lokasi) | cg, leader, hari_jam, lokasi |
| `events` | Event shared (semua CG) | id, name, date_start, date_end, cat, note, image |
| `cg_events` | Event per CG | id, cg, region, is_shared, name, date_start, date_end, cat, note, image |
| `cg_vision` | Visi & misi per CG + Coach region | id, cg, region, visi, misi |
| `cg_dev_plans` | Rencana pengembangan member | id, cg, region, member_name, current_status, target_status, deadline |
| `cg_pelayanan` | Jadwal pelayanan per minggu | cg, region, month, week_date, role_name, member_name |
| `cg_custom_roles` | Role pelayanan custom per CG | cg, region, role_name, abbr, color, bg |
| `member_notes` | Catatan CGL per member | member_id, cgl_note |
| `coach_notes` | Catatan Coach per CG | cg, region, note |

### Region
- **jaktim1:** 31 member, 4 CG (TEEN 23, TEEN 01, TEEN 09, TEEN 06)
- **jaktim2:** 23 member, 4 CG (TEEN 12, TEEN 07, TEEN 17, TEEN 20)

### Visi Coach Storage
Coach region visi disimpan di `cg_vision` dengan `cg = '__COACH_jaktim1__'` atau `'__COACH_jaktim2__'`.

---

## Arsitektur App (3 Halaman)

### 1. Landing Page (`pageL`)
- Toggle region: JAKTIM 1 / JAKTIM 2
- Custom dropdown CG Leader (panel + avatar, bukan native select)
- Tombol "Masuk Dashboard"
- Link "Coach / TL? Masuk disini →"

### 2. CGL Dashboard (`pageD`) — per CG
- **6 tab:** Absensi, Detail CG, Visi CG, Pelayanan, Milestone, Events
- Header: Rekap CG + Visi Coach (read-only) di kanan
- Stats cards: Hadir, Izin, Sakit, Alpa

### 3. Coach / TL Dashboard (`pageC`)
- Toggle: COACH / TL mode
- Region toggle: JAKTIM 1 / JAKTIM 2 (Coach only, TL lihat semua)
- **5 tab:** Overview, Absensi, Milestone, Visi, Events
- Visi Coach editable per region di Overview tab

---

## Fitur Lengkap

### Absensi
- Tabel attendance per member per tanggal (klik dot untuk cycle H→I→S→A→hapus)
- **Undo** — 3.5 detik setelah tap, bisa revert via tombol Undo di toast
- **Debounce** — double-tap guard per cell (`_DOT_SAVING`)
- **Error revert** — kalau save gagal, dot kembali ke status sebelumnya + toast error
- **Line chart SVG** — progress kehadiran per minggu (tanpa library, pure SVG)
- **Total Hadir row** — footer tabel, denominator = total member (bukan hanya ter-record)
- **Mobile month filter** — di HP (≤600px), tabel cuma tampil bulan berjalan + tombol ‹ ›
- **Sticky name column** — kolom Nama tetap di kiri saat scroll horizontal
- **Export PDF** — buka print window, CGL per CG atau Coach per region
- **Export CSV** — download file .csv, UTF-8 BOM untuk Excel compatibility

### Detail CG
- Per-member card: edit nama, WA, lahir, sekolah, kelurahan langsung di card
- Role dropdown (CGL/Sponsor/Member/Simpatisan/VIP) — klik untuk ganti
- Milestone chips (MSJ 1-3, CGT 1-3, B.Air, B.Roh) — klik toggle
- Catatan CGL per member (textarea auto-save onblur)
- **Tambah Member** — modal form, auto-refresh UI + dropdown CGL
- **Hapus Member** — tombol merah di tiap card, konfirmasi, hapus attendance + notes + member
- Member notes di-load sebagai **batch single query** (bukan N+1)

### Visi CG
- Editable textarea: Visi, Misi
- Rencana Pengembangan Member — modal pilih member (card grid), target role, deadline
- Data tersimpan di `cg_vision` dan `cg_dev_plans`

### Pelayanan
- **Multi-assignee** — setiap role bisa punya >1 member (disimpan comma-separated)
- Bulan selector + tambah bulan baru
- Week pills (tambah/edit/hapus minggu)
- Role default: Firman CG, PAW, Game, Sharing + custom roles
- Custom popover "+ Tambah" (bukan native select)
- Statistik: Distribusi Jenis, Top Pelayanan, Belum Pernah/Jarang
- Rekap Bulanan tabel (multi-assignee aware)

### Milestone
- Donut SVG charts (MSJ 1-3, CGT 1-3, B.Air, B.Roh)
- Filter chips: Semua, MSJ, CGT, Baptis — instant (no refetch)
- Per-member progress bars + follow-up indicator
- Coach/TL: per-CG breakdown accordion

### Events
- CRUD: tambah, edit, hapus event
- Date range support (tanggal mulai + selesai, keduanya opsional)
- Countdown badge ("HARI INI", "3 hari lagi", "5 hari lalu")
- Filter chips: Semua, Ibadah, CG Event, Birthday, Outreach — instant (cached)
- Auto-cleanup past events on page load
- Copy text / Broadcast WhatsApp / Edit / Delete per event card
- Birthday countdown list (hari ke berapa, ulang tahun ke berapa)

### Coach/TL Dashboard
- Overview: stats cards + Visi Coach editable + CG cards grid
- Absensi: per-CG cards dengan attendance table + line chart + Generate Sabtu + Export PDF/CSV
- Milestone: filter chips (MSJ/CGT/Baptis) + donut + per-CG accordion
- Visi: **accordion per CG** (klik expand) — Visi, Misi, Dev Plan, Catatan Coach
- Events: filter chips + CRUD + countdown + Tambah Event (with target dropdown)

### Generate Sabtu
- Tombol di Coach Absensi tab: "+ Generate Sabtu [Bulan] [Tahun]"
- Auto-detect bulan berikutnya dari tanggal terakhir
- Insert semua hari Sabtu di bulan target ke Supabase `dates`
- Duplicate-safe (normalize leading zero + case-insensitive label check)
- Coach: generate untuk region aktif. TL: generate untuk kedua region.

### Supabase Realtime
- Single WebSocket channel `app-sync`
- Subscribe ke: attendance, members, cg_pelayanan, events, cg_events, cg_vision
- Attendance: patch per-dot instant (via `data-mid`/`data-did` attributes), skip kalau `_DOT_SAVING` aktif
- Members/Pelayanan/Events/Visi: debounced re-render (500-600ms)
- Live indicator: 🟢 Live (connected) / 🔴 Offline (disconnected)

### Google Sheets Sync
- File: `google-apps-script.gs`
- Trigger: `runAutoSync` every 1 minute
- Sync: `syncAbsensi` (attendance data) + `syncDetail` (member detail + milestone)
- Sheets: JAKTIM 1, JAKTIM 2, DETAIL JAKTIM 1, DETAIL JAKTIM 2
- Milestone: pakai boolean `true/false` (bukan string 'TRUE')
- `fullRebuild`: reset sheet dari nol (run manual kalau perlu)

---

## Key Global Variables (JS)

### CGL Dashboard scope
- `CUR_CG` — nama CG aktif (e.g. "TEEN 01")
- `CUR_REGION` — region CG aktif ("jaktim1" / "jaktim2")
- `CUR_CG_INFO` — object info CG (leader, hari_jam, lokasi)
- `MEMBERS` — array member untuk CG aktif
- `DATES` — array tanggal ibadah untuk region aktif
- `ATTENDANCE` — object `{ "memberId_dateId": "H"/"I"/"S"/"A" }`

### Coach/TL Dashboard scope
- `ALL_MEMBERS` — semua member dari semua region
- `ALL_CG_INFO` — semua CG info
- `ALL_DATES` — semua tanggal dari semua region
- `ALL_ATTENDANCE` — semua attendance record
- `ALL_EVENTS` — semua shared events
- `coachRole` — "coach" / "tl"
- `coachReg` — region aktif untuk Coach ("jaktim1" / "jaktim2")

### Tab rendering
- `TAB_RENDERED` — flag per tab CGL (lazy render + prefetch)
- `COACH_TAB_RENDERED` — flag per tab Coach

---

## Deploy Workflow
```
Edit index.html locally
→ git add index.html
→ git commit -m "description"
→ git push
→ Vercel auto-deploys in ~10-30s
→ User hard refresh (Ctrl+Shift+R) untuk ambil versi baru
```

---

## ⛔ RULES — WAJIB DIIKUTI

### Struktur File
- **JANGAN split ke multiple file** — harus tetap single `index.html`
- **JANGAN tambah build step** — Vercel publish dir `.` (root), no build command
- **JANGAN pakai npm/node** — pure vanilla JS only
- **JANGAN buat file README.md atau dokumentasi** kecuali diminta

### Code Safety
- **JANGAN pakai `prompt()`** — block main thread, disconnect realtime. Pakai `asyncPrompt()` yang sudah ada
- **JANGAN hapus `_DOT_SAVING` guard** di cycleDot — mencegah double-tap + realtime race
- **JANGAN ubah `esc()` function** — sudah escape &, <, >, ", ' (penting untuk XSS prevention)
- **JANGAN hapus `data-mid`/`data-did` attributes** di dot elements — dipakai realtime handler
- **JANGAN ganti `loadCGLDropdown` ke `select('id,nama,...')`** — HARUS `select('*')` karena `ALL_MEMBERS` dipakai Coach dashboard (milestone, birthday, dll butuh semua kolom)
- **SELALU cek error** di setiap Supabase operation dan tampilkan ke user via `toast()`
- **SELALU pakai `roleRankLC()`** untuk sort member by role (case-insensitive)

### Supabase
- **RLS DISABLED** di semua tabel — jangan enable tanpa diskusi (akan break semua operasi)
- **Realtime** sudah di-setup via `ALTER PUBLICATION` — jangan hapus
- Unique constraint di `cg_pelayanan`: `(cg, week_date, role_name)`
- Unique constraint di `cg_vision`: `(cg, region)`

### Google Sheets (Apps Script)
- Sheet names: `JAKTIM 1`, `JAKTIM 2`, `DETAIL JAKTIM 1`, `DETAIL JAKTIM 2`
- `DETAIL JAKTIM 1` mungkin punya trailing space tergantung versi sheet
- REGION_CONFIG dateStartCol: jaktim1=5, jaktim2=4
- Milestone kolom pakai **boolean** (`!!m.msj1`), BUKAN string `'TRUE'`

---

## Production Notes

### Performance
- Tab rendering: eager parallel prefetch setelah tab pertama render
- Event filter chips: cached data, tidak re-fetch pada filter change
- Attendance chart: pure SVG (tidak pakai Chart.js library)
- Member notes: batch single query `.in('member_id', ids)`
- Supabase queries: column-specific select (bukan select('*')) kecuali members
- Skeleton loader: shimmer animation saat tab loading
- Resize debounce: 150ms untuk mobile/desktop switch
- Smooth transitions: fade-in 0.2s pada tab switch, fade-out/in pada pelayanan month switch

### Mobile (≤600px)
- Viewport: `maximum-scale=1, user-scalable=no` (prevent iOS zoom)
- Dot touch targets: 36px (above 44px recommended with padding)
- `touch-action: manipulation` pada dots (prevent double-tap zoom)
- Sticky name column (position:sticky left:0)
- Month filter: hanya tampil bulan berjalan + ‹ › navigation

### Security (Current State)
- Supabase anon key exposed di client JS — acceptable untuk internal church app
- Tidak ada authentication/login — siapapun dengan URL bisa akses
- **JANGAN share URL ke publik**
- Future: PIN login untuk Coach/TL dashboard (belum diimplementasi)

### Known Limitations
- Google Sheets sync hanya append + update (tidak auto-delete row saat member dihapus di web)
- Pelayanan multi-assignee disimpan comma-separated di 1 kolom (tidak normalized)
- Event auto-cleanup permanent delete (tidak ada soft-delete/archive)
- Browser back button support basic (pushState pada CG enter saja)
