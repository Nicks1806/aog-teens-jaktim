# AOG Teens Jaktim — CG Dashboard (Absensi + Management)

**Current version:** v32 (redesign UI) · **Last updated:** October 2026

## Project Overview
Single-file web app untuk tracking attendance, pelayanan, milestone, events, visi, dan distribusi wilayah CG untuk AOG Teens Jakarta Timur. Dipakai oleh ~54 member, 9 CG Leaders, 2 Coach, dan 1 Team Leader secara bersamaan saat ibadah hari Minggu.

**URL Production:** https://absenibadahjaktim.vercel.app
**Coach/TL URL:** https://absenibadahjaktim.vercel.app/?role=coach

Untuk konteks handoff lengkap ke Claude Code baru, baca `HANDOFF.md`.

---

## Tech Stack
- **Frontend:** Vanilla JS (NO framework, NO build step, NO npm/node)
- **Backend:** Supabase (PostgreSQL + Realtime WebSocket)
- **Deployment:** GitHub → Vercel (auto-deploy on push to main)
- **Sheets Sync:** Google Apps Script (auto-sync per 1 menit dari Supabase → Google Sheets)
- **PWA:** Service Worker network-first + manifest + `/icon.jpg`
- **File structure:** **SINGLE FILE** — `index.html` (semua HTML/CSS/JS dalam 1 file, ~5000+ baris)

## GitHub Repo
- **Repo:** https://github.com/Nicks1806/aog-teens-jaktim
- **Branch:** main
- **Vercel:** connected to main branch, auto-deploy on push
- **Git user:** Nicks1806

---

## Supabase Config
- **URL:** `https://gqppviugodokncxezdwd.supabase.co`
- **Anon Key:** hardcoded di `index.html` (dan `google-apps-script.gs`) — acceptable karena app internal gereja
- **RLS:** DISABLED di semua tabel
- **Realtime:** ENABLED via `ALTER PUBLICATION supabase_realtime ADD TABLE ...` untuk 10 tabel (attendance, members, dates, cg_info, events, cg_events, cg_vision, cg_dev_plans, cg_pelayanan, member_notes, coach_notes)

### Tabel Database (12 tabel)

| Tabel | Fungsi | Key Columns |
|-------|--------|-------------|
| `members` | Data member (~54) | id, nama, cg, status, region, lahir, wa, sekolah, kelas, kelurahan, kecamatan, msj1-3, cgt1-3, baptis_air, baptis_roh |
| `attendance` | Data absensi per member per tanggal | member_id, date_id, status (H/I/S/A) |
| `dates` | Daftar tanggal ibadah | id, label, region, sort_order, month_code |
| `cg_info` | Info CG (leader, jadwal, lokasi) | cg, leader, hari_jam, lokasi |
| `events` | Event shared legacy (phased out) | id, name, date_start, date_end, cat, note, image |
| `cg_events` | Event 3-level scope (global/region/per-CG) | id, cg, region, is_shared, name, date_start, date_end, cat, note, image |
| `cg_vision` | Visi & misi per CG + Coach region | id, cg, region, visi, misi |
| `cg_dev_plans` | Rencana pengembangan member | id, cg, region, member_name, current_status, target_status, deadline |
| `cg_pelayanan` | Jadwal pelayanan per minggu | cg, region, month, week_date, role_name, member_name |
| `cg_custom_roles` | Role pelayanan custom per CG | cg, region, role_name, abbr, color, bg |
| `member_notes` | Catatan CGL per member | member_id, cgl_note |
| `coach_notes` | Catatan Coach per CG | cg, region, note |

### Region & CG (Current State)
- **jaktim1:** 5 CG — TEEN 01, TEEN 06, TEEN 09, TEEN 23, TEEN 25 (baru per v28+)
- **jaktim2:** 4 CG — TEEN 07, TEEN 12, TEEN 17, TEEN 20
- **ARSIP JAKTIM 1 / ARSIP JAKTIM 2:** CG khusus untuk arsip member/CGL yang tidak aktif (di-filter dari display aktif)

### Storage Khusus
- Coach region visi disimpan di `cg_vision` dengan `cg = '__COACH_jaktim1__'` atau `'__COACH_jaktim2__'`
- CG dengan nama diawali `ARSIP` di-filter dari display aktif (function `isArchivedCg`)

### Unique Constraints
- `cg_pelayanan`: `(cg, week_date, role_name)`
- `cg_vision`: `(cg, region)`

---

## Arsitektur App (3 Halaman)

### 1. Landing Page (`pageL`)
- Toggle region: JAKTIM 1 / JAKTIM 2
- Custom dropdown CG Leader (panel + avatar, bukan native select)
- Skip archived CG dari dropdown otomatis
- Tombol "Masuk Dashboard"
- Link "Coach / TL? Masuk disini →"

### 2. CGL Dashboard (`pageD`) — per CG
6 tab:
1. **Absensi** — H/I/S/A tabel + line chart + Export Absensi CSV/PDF
2. **Detail CG** — per-member card (nama, WA, sekolah, alamat, milestone) + Export Detail CSV/PDF
3. **Visi CG** — visi + misi (click-to-edit numbered list) + Rencana Pengembangan Member (dev plan dengan deadline)
4. **Pelayanan** — jadwal per minggu, multi-assignee support, statistik
5. **Milestone** — donut SVG + progress bars + follow-up
6. **Events** — CRUD event 3-level scope + countdown + WA broadcast

Header: Rekap CG + Visi Coach (read-only) di kanan. Stats cards: Hadir, Izin, Sakit, Alpa.

### 3. Coach / TL Dashboard (`pageC`)
5 tab:
1. **Overview** — stats + Visi Coach editable + CG cards + Bar chart + **Distribusi Wilayah** (v29+) + Export Detail
2. **Absensi** — per-CG cards (dot clickable via `cycleDotCoach`) + line chart + Pending CGL list + auto-broadcast reminder + Generate Sabtu + Export Absensi
3. **Milestone** — filter chips (Semua/MSJ/CGT/Baptis) + donut + per-CG accordion + Daftar Follow-up (progression-aware)
4. **Visi** — accordion per CG (preserve expand state across realtime re-render) — Visi, Misi, Dev Plan (with deadline countdown), Catatan Coach
5. **Events** — filter chips + CRUD + countdown + target dropdown (Global / Region / Per-CG)

**Toggle:**
- COACH mode: 1 region (jaktim1 / jaktim2)
- TL mode: gabungan semua region

---

## Fitur Lengkap

### Absensi
- Klik dot → cycle: kosong → H → I → S → A → kosong
- **Coach dot juga clickable** (`cycleDotCoach`, v18+) — update `ALL_ATTENDANCE`
- Optimistic UI + auto-save + revert kalau save gagal + toast
- `_DOT_SAVING` guard mencegah double-tap race
- **Undo** — 3.5 detik setelah tap ada tombol Undo di toast
- **Line chart SVG accurate** (v25) — denominator hanya count member yang sudah aktif per tanggal (auto-detect via `memberJoinIdx`)
- **TL chart merge duplicate dates** (v26) — 1 kolom per tanggal (gabungan jaktim1 + jaktim2)
- Mobile month filter (≤600px)
- Sticky name column
- Export **Absensi CSV** (UTF-8 BOM) + **Absensi PDF** (print window)

### Detail CG
- Per-member card edit: nama, WA, lahir, sekolah, kelurahan, kecamatan
- Role dropdown dengan **error check + revert** kalau save gagal (v27+)
- Milestone chips (MSJ 1-3, CGT 1-3, B.Air, B.Roh) — toggle instant
- Catatan CGL per member (auto-save on blur)
- **Tambah Member** modal + **Hapus Member** dengan per-step error check (attendance → notes → member)
- Member notes: batch single query (`.in('member_id', ids)`)
- Export **Detail CSV** (CGL/Coach/TL semua bisa) + **Detail PDF** (v23+)

### Visi CG
- Visi textarea (autosave dengan **read-modify-write** — mencegah overwrite field lain saat concurrent edit, v27+)
- **Misi click-to-edit numbered list** (v25) — parse per baris, display sebagai numbered bullets dengan badge kuning + separator dashed, click untuk edit textarea
- Rencana Pengembangan Member (modal pilih member + target role + deadline)
- Data di `cg_vision` dan `cg_dev_plans`

### Pelayanan
- Multi-assignee per role
- Bulan selector + tambah bulan baru
- Week pills
- Default roles: Firman CG, PAW, Game, Sharing + custom roles
- Statistik: Distribusi Jenis, Top Pelayanan, Belum Pernah/Jarang
- Rekap Bulanan multi-assignee aware

### Milestone
- Donut SVG (MSJ 1-3, CGT 1-3, B.Air, B.Roh)
- Filter chips instant (cached data)
- Coach/TL: per-CG breakdown accordion + Daftar Follow-up progression-aware (CGT 2 hanya tampil yang sudah CGT 1)

### Events (3-level scope)
- **Global** (`is_shared=true, region='all'`) — event untuk semua CG semua region
- **Region-scoped** (`is_shared=true, region='jaktim1'|'jaktim2'`) — event 1 region
- **Per-CG** (`is_shared=false, cg=X, region=Y`) — event 1 CG saja
- CRUD full
- Date range (start + optional end)
- Countdown badge ("HARI INI", "3 hari lagi", "5 hari lalu")
- Filter chips: Semua, Ibadah, CG Event, Birthday, Outreach
- Auto-cleanup past events (7 hari grace, skip `is_shared=true`)
- Copy text / Broadcast WhatsApp / Edit / Delete

### Distribusi Wilayah (v29+) — Coach/TL Overview
Section paling bawah Overview tab:
- Chip filter 2 tingkat: **Kecamatan** (purple) + **Kelurahan** (violet) — auto-refilter
- Counter per chip: `Pulogadung (5)`, `Cempaka Putih (3)`, dll
- Info total member punya alamat vs belum diisi
- List member sesuai filter: nama + CG badge + status + alamat + No HP
- Export **Wilayah CSV** (7 kolom: CG, Nama, Status, No HP, Kelurahan, Kecamatan, Region)
- Auto-update via realtime `handleMembersChange` saat CGL edit alamat
- Filter state auto-reset saat toggle region atau role (v30)
- Skip archived CG

### Coach/TL Dashboard Extras
- **Pending CGL list** — CG yang belum input absensi 4 tanggal ibadah terakhir
- **Auto-broadcast reminder** via Realtime channel (rate-limited 2 jam per CG)
- Tombol manual "🔔 Ingatkan" per CG + "Ingatkan Semua"
- **Bar chart comparison** antar CG (persentase kehadiran)

### Generate Sabtu
- Tombol di Coach Absensi tab: "+ Generate Sabtu [Bulan] [Tahun]"
- Auto-detect bulan berikutnya dari tanggal terakhir
- Insert semua hari Sabtu di bulan target ke Supabase `dates`
- Duplicate-safe (normalize leading zero + case-insensitive label check)
- Coach: 1 region. TL: kedua region.

### Supabase Realtime (Multi-Layer Sync)
- Single WebSocket channel `app-sync`
- Subscribe ke: attendance, members, cg_pelayanan, cg_events, events, cg_vision (+ broadcast `cgl_reminder`)
- **Attendance:** patch per-dot instant via `data-mid`/`data-did` selector, skip kalau `_DOT_SAVING` aktif
- **Members/Pelayanan/Events/Visi:** debounced re-render (500-800ms)
- **Coach dashboard triple sync** (v20+):
  1. Realtime WebSocket instant
  2. Polling 60 detik silent (bandingkan hash → re-render kalau berubah)
  3. Tab-switch refetch (attendance + dates fresh)
  4. Visibility focus refetch (window kembali aktif)
  5. Manual tombol 🔄 Refresh
- Live indicator: 🟢 Live / 🔴 Offline
- Auto-reconnect saat disconnect + `online` event

### Pagination (v22+, v27+)
Supabase REST API cap default 1000 row per query. `.limit(100000)` di client TIDAK bypass ini.

**Fix:**
- `fetchAllAttendance()` — HTTP Range loop dengan `.order('member_id').order('date_id')` untuk konsistensi
- `fetchBoundedAttendance(memberIds, dateIds)` — auto-paginate kalau kombinasi > 800
- **Apps Script** juga pakai HTTP Range header pagination (v27)
- Max 50 page × 1000 = 50k row

### PWA
- Manifest: icon `/icon.jpg` (2000x2000 JPG, `sizes="any"`)
- **Service Worker network-first** untuk HTML (v18+) — bukan stale-while-revalidate, jadi 1x refresh = versi terbaru
- Push notifikasi dengan bell button 🔔 di header
- **iOS PWA guard** — skip push kalau SW controller belum aktif (mencegah `Illegal constructor` error)
- **Own-write suppression** — `_OWN_EVENT_IDS` Set skip notif untuk event yang dibuat sendiri (15 detik window)
- **Version indicator "vXX"** di pojok kanan atas header — user bisa verify versi terbaru

### Archive CG (v28+)
- CG dengan nama diawali `ARSIP` (case-insensitive) → **di-filter dari display aktif**
- Landing dropdown, Coach dashboard, semua getCGsForRegion() → skip archived
- Attendance history, detail, milestone tetap **aman di DB**
- Restore: tinggal UPDATE `cg` value kembali ke CG aktif
- Di Google Sheets, ARSIP CG muncul sebagai grup terpisah setelah `fullRebuild`

### Google Sheets Sync (Apps Script)
- File: `google-apps-script.gs`
- Trigger: `runAutoSync` every 1 minute
- Sync: `syncAbsensi` (attendance) + `syncDetail` (member detail + milestone)
- Sheets: `JAKTIM 1`, `JAKTIM 2`, `DETAIL JAKTIM 1 ` (trailing space!), `DETAIL JAKTIM 2 ` (trailing space!)
- `fullRebuild()` — reset total (manual)
- `fullRebuildJaktim1()` / `fullRebuildJaktim2()` — 1 region
- Milestone kolom pakai string `'TRUE'`/`'FALSE'`
- Timezone `Asia/Jakarta` explicit di `normDate`
- Smart insert per-CG (member baru masuk grup CG-nya, bukan append di bawah)
- Dedup date columns otomatis
- **Attendance fetch pagination via HTTP Range** (v27) — bypass 1000 cap

---

## Key Global Variables (JS)

### CGL Dashboard scope
- `CUR_CG` — nama CG aktif
- `CUR_REGION` — region CG aktif
- `CUR_CG_INFO` — object info CG
- `MEMBERS` — array member CG aktif
- `DATES` — array tanggal ibadah region aktif
- `ATTENDANCE` — object `{ "memberId_dateId": "H"/"I"/"S"/"A" }`

### Coach/TL Dashboard scope
- `ALL_MEMBERS` — semua member dari semua region
- `ALL_CG_INFO` — semua CG info
- `ALL_DATES` — semua tanggal dari semua region
- `ALL_ATTENDANCE` — semua attendance record (paginated)
- `ALL_EVENTS` — semua shared events
- `coachRole` — "coach" / "tl"
- `coachReg` — region aktif Coach

### State helpers
- `_DOT_SAVING` — guard object cycle dot race
- `_VISI_EXPANDED` — Set track accordion state Coach Visi (preserve across realtime re-render)
- `_OWN_EVENT_IDS` — Set track event yang dibuat di session ini (suppress own notif, 15s window)
- `_NOTIF_DEDUPE` — Set dedupe notification tags
- `_COACH_POLL_TIMER` — setInterval handle polling 60s
- `_CACHED_CG_EVENTS`, `_CACHED_ALL_CG_EVENTS` — event cache
- `window.__WILAYAH_KEC`, `window.__WILAYAH_KEL` — filter wilayah aktif (default 'all')
- `window.__pendingCGLs` — cache pending list untuk tombol reminder
- `TAB_RENDERED` — flag per tab CGL (lazy render + prefetch)
- `COACH_TAB_RENDERED` — flag per tab Coach

---

## Deploy Workflow
```
Edit index.html locally (+ file lain kalau perlu)
→ Bump "vXX" di 2 tempat: index.html header + service-worker.js CACHE_NAME
→ git add <files>
→ git commit -m "vXX: description"
→ git push
→ Vercel auto-deploys ~10-30s
→ User refresh (network-first SW → langsung dapat versi baru)
→ Verify: cek "vXX" di pojok kanan atas app
```

**Version bump pattern setiap push code:**
1. `index.html` — cari `App version">v32` → naikkan (ada **2** tempat: sidebar CGL + sidebar Coach)
2. `service-worker.js` — cari `CACHE_NAME = 'aog-absensi-v32'` → naikkan sama

---

## ⛔ RULES — WAJIB DIIKUTI

### Struktur File
- **JANGAN split ke multiple file** — harus tetap single `index.html`
- **JANGAN tambah build step** — Vercel publish dir `.` (root), no build command
- **JANGAN pakai npm/node** — pure vanilla JS
- **JANGAN buat file README.md atau dokumentasi baru** kecuali diminta

### Desain (v32 — redesign)
- **Tata letak baru (sidebar + bottom nav), tema/warna/font tetap seperti v31 live.** Token warna di `:root` (`--bg`, `--card`, `--line`, `--ink`, `--muted`, `--accent` #6C5CE7, `--grad` ungu, `--H/--I/--S/--A/--X` + `b`/`br`) memakai palet v31. Override tema ada di blok CSS `TEMA v31 (live)`
- **Landing page (`#pageL`) = persis v31** — HTML, CSS `/* Landing */`, dan JS `selReg`…sebelum `enterDash` disalin dari v31. Alias lama (`--purple`, `--g1`…) hanya di-scope ke `#pageL`; jangan diubah tanpa diminta
- Font: **Instrument Serif** (`var(--display)`, judul besar/angka, weight 400) + **Inter** (teks, judul kartu). Minimal 11px
- Ikon: pakai `icon(name, size)` (SVG inline, daftar di `ICON_PATHS`). **Jangan pakai emoji di UI**; emoji boleh hanya di isi pesan WA/broadcast/notifikasi push. `toast()` otomatis mengubah awalan ❌/✓/🔔/⚠ jadi ikon
- Komponen: `.card`, `.chead`, `.btn` (`.primary/.sm/.big/.ghost/.danger`), `.iconbtn`, `.seg`, `.chip` (`.on` = filter aktif), `.pill`, `.kpi`(`.hero`), `.lrow`, `.prog`, `.empty`, `.acc`(`.acc-h`/`.acc-b`), `.evcard` (pakai `evCardHTML()`), `.mcard`, `.visi-box`
- Semua yang bisa diklik = `<button type="button">` / `<a>`; tombol ikon wajib `aria-label`
- Tab CGL/Coach: item nav punya class `.app-tab` + `data-tab`; `sTab()`/`sCoachTab()` menandai lewat `data-tab` (sidebar & bottom nav sinkron) — jangan pakai index
- Kotak absensi = `<button class="dot H|I|S|A|X" data-mid data-did>` (class & atribut tetap wajib)
- Accordion Absensi Coach: tabel tetap dirender saat tertutup (pakai `hidden`), supaya patch realtime per-dot jalan. State buka: `_CABS_OPEN`, Visi: `_VISI_EXPANDED`
- Toggle region Coach ada di header (`#cRegSeg` → `coachSetRegion()`), bukan per tab
- KPI + banner visi CGL (`#dTop`) hanya tampil di tab Absensi; KPI Coach (`#cTop`) hanya di Overview

### Code Safety
- **JANGAN pakai `prompt()`** — block main thread. Pakai `asyncPrompt()`
- **JANGAN hapus `_DOT_SAVING` guard** di `cycleDot` / `cycleDotCoach` — mencegah double-tap + realtime race
- **JANGAN ubah `esc()` function** — sudah escape &, <, >, ", ' (XSS prevention)
- **JANGAN hapus `data-mid`/`data-did` attributes** di dot elements — dipakai realtime handler
- **JANGAN ganti `loadCGLDropdown` ke `select('id,nama,...')`** — HARUS `select('*')` karena `ALL_MEMBERS` dipakai Coach dashboard (milestone, birthday, dll butuh semua kolom)
- **SELALU cek error** di setiap Supabase operation dan tampilkan via `toast()`
- **SELALU pakai `roleCls()` / `roleLabel()`** helper untuk role class (whitelist + strip legacy "Target:" prefix)
- **SELALU pakai `fetchAllAttendance()` / `fetchBoundedAttendance()`** untuk attendance query — jangan pakai `.limit(100000)` yang di-cap oleh server

### Supabase
- **RLS DISABLED** — jangan enable tanpa diskusi
- **Realtime publication** sudah aktif — jangan hapus tabel
- Server `max_rows` cap default 1000 → wajib pagination untuk unbounded queries

### Google Sheets (Apps Script)
- Sheet names: `JAKTIM 1`, `JAKTIM 2`, `DETAIL JAKTIM 1 ` (trailing space), `DETAIL JAKTIM 2 ` (trailing space)
- `REGION_CONFIG.dateStartCol`: jaktim1=5, jaktim2=4
- Milestone di sheet: string `'TRUE'`/`'FALSE'`
- Timezone `Asia/Jakarta` explicit
- Pakai `fetchAllAttendance()` di Apps Script (HTTP Range pagination)

### PWA / Service Worker
- HTML network-first (bukan stale-while-revalidate) — supaya update langsung kelihatan 1x refresh
- Bump `CACHE_NAME` setiap perubahan index.html → force SW re-install
- Version "vXX" di header — user bisa verify update aktif

---

## Production Notes

### Performance
- Tab rendering: eager parallel prefetch setelah tab pertama render
- Event filter chips: cached data (`_CACHED_CG_EVENTS`, `_CACHED_ALL_CG_EVENTS`)
- Attendance chart: pure SVG (tidak pakai Chart.js library)
- Member notes: batch single query
- Skeleton loader: shimmer saat tab loading
- Resize debounce: 150ms mobile/desktop switch
- Smooth transitions: fade-in 0.2s pada tab switch

### Mobile (≤880px layout HP, ≤600px filter bulan)
- Viewport: zoom diizinkan (v32). Input dipaksa 16px di HP supaya iOS tidak auto-zoom
- Sidebar disembunyikan → top bar ungu + bottom nav (`.mtop`, `.mnav`)
- Dot touch targets: 44px, `touch-action: manipulation`
- Sticky name column (avatar disembunyikan ≤600px)
- Month filter: hanya bulan berjalan + tombol panah (≤600px)

### Security (Current State)
- Supabase anon key exposed di client JS — acceptable internal church app
- No authentication/login — siapapun dengan URL bisa akses
- **JANGAN share URL ke publik**
- Future: PIN login untuk Coach/TL (belum diimplementasi)

### Known Limitations
- Google Sheets sync 1-arah (Supabase → Sheets)
- Pelayanan multi-assignee: comma-separated di 1 kolom (tidak normalized)
- Event auto-cleanup permanent delete (tidak ada soft-delete)
- Browser back button basic (pushState pada CG enter)
- Reminder broadcast tidak persistent — kalau CGL offline saat dikirim, notif hilang. Future: pakai tabel `cgl_reminders` untuk persistence.
- Member pindah CG: attendance history tetap ke-link via `member_id`, tapi tampilan CG lama tidak menampilkan member itu (desain ambiguous)
- iOS PWA push notif: hanya jalan kalau install ke Home Screen + iOS 16.4+

---

## Session Version History

| Ver | Feature / Fix |
|-----|---------------|
| v18-v20 | Service Worker network-first, loadCoachData Promise.allSettled, Coach dot clickable |
| v21 | Refetch dates di Coach + silent polling |
| v22 | **fetchAllAttendance pagination** (bypass 1000 cap) — CRITICAL |
| v23 | Export Detail CG (CSV + PDF) untuk CGL/Coach/TL |
| v24 | Label tombol export jelas (Absensi vs Detail) |
| v25 | Line chart accurate — join-date detection |
| v26 | TL chart merge tanggal duplikat |
| v27 | Order stability + Apps Script pagination + TL sort fix |
| v28 | Archive CG support (nama prefix `ARSIP`) |
| v29 | **Distribusi Wilayah** — filter kecamatan + kelurahan di Coach/TL Overview |
| v30 | Wilayah filter hardening (escape + reset state + count consistency) |
| v31 | **27 bug fixes** — attendance stats inflate, data corruption (sekolah/kelas split), XSS (PDF export), error handling (21 Supabase ops), TEEN 25 color map, reconnect race guard, undo sync, milestone prereq, visi TOCTOU fix |
| v32 | **Redesign UI** (branch `redesign`) — sidebar + bottom nav, tema & warna tetap v31 (Instrument Serif + Inter), landing page persis v31, ikon SVG pengganti emoji, kartu KPI, accordion Coach, heatmap milestone, modal berlabel. Logika data/Supabase tidak diubah. Fix: tombol Undo toast bisa diklik |

Detail changelog per version ada di git log (`git log --oneline`).
Detail v31 ada di `V31_CHANGELOG.md`.

---

## Related Files
- `HANDOFF.md` — comprehensive handoff untuk Claude Code baru (28 section, semua konteks)
- `V31_CHANGELOG.md` — detail 27 bug fixes di v31 (Oktober 2026)
- `CURRENT_DESIGN.md` — referensi desain **lama (v31)**, sebelum redesign v32
- Paket redesign v32: `C:\Penyimpanan utama\Downloads\aog-redesign-handoff.zip` (spec, migration map, QA checklist, prototype) — sengaja **tidak** disalin ke repo karena Vercel mem-publish root
- `KELAPA_GADING_SETUP.md` — blueprint untuk cabang Kelapa Gading (belum di-deploy)
- `google-apps-script.gs` — Apps Script Google Sheets sync
- `service-worker.js` — PWA SW network-first
- `manifest.json` — PWA manifest
- `icon.jpg` — PWA icon 2000x2000 JPG
