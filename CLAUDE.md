# AOG Teens Jaktim — CG Dashboard (Absensi + Management)

**Current version:** v53 · **Last updated:** 27 Oktober 2026

## Project Overview
Single-file web app untuk tracking attendance, pelayanan, milestone, events, visi, dan distribusi wilayah CG untuk AOG Teens Jakarta Timur. Dipakai oleh ~54 member, 9 CG Leaders, 2 Coach, dan 1 Team Leader secara bersamaan saat ibadah hari Minggu.

**URL Production:** https://absenibadahjaktim.vercel.app
**CGL URL:** https://absenibadahjaktim.vercel.app/teen-01 (slug `cgSlug()`, refresh tetap di dashboard CG) · **Coach URL:** https://absenibadahjaktim.vercel.app/coach · **TL URL:** https://absenibadahjaktim.vercel.app/tl (rewrite di `vercel.json`; `?role=coach` lama tetap jalan)

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
- **Tema tahun** ("THE YEAR OF / UNITY / & OPEN HEAVENS" di landing + sidebar) disimpan di `cg_vision` dengan `cg = '__THEME__'`, `region = 'all'`, `visi` = JSON `{kicker,title,sub}`. Diedit Coach/TL lewat klik blok tema di sidebar (`openThemeEdit`/`saveTheme`), realtime via `handleVisionChange`

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
- **Tidak ada link ke Coach/TL** (v32) — Coach/TL buka lewat alamat `/coach` atau `/tl`

### 2. CGL Dashboard (`pageD`) — per CG
6 tab:
1. **Absensi** — H/I/S/A tabel + line chart + Export Absensi CSV/PDF
2. **Detail CG** — kartu ringkas per anak (nama, role, % hadir, strip 8 absensi terakhir, milestone). Klik kartu → modal `cglMemberModal` (`openCGLMember`): % kehadiran, H/I/S/A, chart garis % hadir per bulan, absensi terakhir, edit data diri, milestone, catatan, hapus. Export Detail CSV/PDF
3. **Visi CG** — visi + misi (click-to-edit numbered list) + Rencana Pengembangan Member (dev plan dengan deadline)
4. **Pelayanan** — jadwal per minggu, multi-assignee support, statistik
5. **Milestone** — donut SVG + progress bars + follow-up
6. **Events** — CRUD event 3-level scope + countdown + WA broadcast

Header: Rekap CG + Visi Coach (read-only) di kanan. Stats cards: Hadir, Izin, Sakit, Alpa.

### 3. Coach / TL Dashboard (`pageC`)
5 tab:
1. **Overview** — stats + Visi Coach editable + CG cards + Bar chart + **Distribusi Wilayah** (v29+) + Export Detail
2. **Absensi** — per-CG cards (dot clickable via `cycleDotCoach`) + line chart + Pending CGL list + tombol pengingat manual + Generate Sabtu + Export Absensi
3. **Milestone** — filter chips (Semua/MSJ/CGT/Baptis) + donut + per-CG accordion + Daftar Follow-up (progression-aware)
4. **Visi** — accordion per CG (preserve expand state across realtime re-render) — Visi, Misi, Dev Plan (with deadline countdown), Catatan Coach
5. **Events** — filter chips + CRUD + countdown + target dropdown (Global / Region / Per-CG)
6. **Tanya AI** (v38) — chat Gemini untuk Coach/TL (`renderCoachAI`, `aiAsk`, `buildAIContext`). Tiap pertanyaan: refetch absensi + tanggal + event → kirim ringkasan JSON (nama, CG, status, string absensi per tanggal, %, milestone, event) ke `/api/ai`. **Tidak** dikirim: WA, alamat, tgl lahir, sekolah, catatan. Form kode akses hanya muncul kalau server membalas 401 (AI_PIN diisi); kode disimpan di `localStorage aog_ai_pin`

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
- **Pengingat ke CGL hanya manual** (v32) — auto-broadcast saat render dimatikan karena terpicu tiap buka dashboard di tiap device. `autoBroadcastPendingReminders()` masih ada tapi tidak dipanggil. `broadcastReminder()` cek status `send() === 'ok'`
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
1. `index.html` — cari `App version">v53` → naikkan (ada **2** tempat: sidebar CGL + sidebar Coach)
2. `service-worker.js` — cari `CACHE_NAME = 'aog-absensi-v53'` → naikkan sama

---

## ⛔ RULES — WAJIB DIIKUTI

### Struktur File
- **JANGAN split ke multiple file** — harus tetap single `index.html`
- **JANGAN tambah build step** — Vercel publish dir `.` (root), no build command
- **JANGAN pakai npm/node** — pure vanilla JS
- **JANGAN buat file README.md atau dokumentasi baru** kecuali diminta
- `vercel.json` hanya berisi `rewrites` untuk `/coach`, `/tl`, dan `/teen-NN` — jangan tambah build setting
- **Pengecualian single-file:** `api/ai.js` = Vercel Serverless Function (CommonJS, tanpa npm) proxy AI. **Claude utama** (`ANTHROPIC_API_KEY`, `CLAUDE_MODEL` opsional default `claude-sonnet-5-5`; Messages API via `fetch` karena proyek tanpa npm, `anthropic-version: 2026-10-21`, `output_config.effort: 'low'`, prompt caching system + data, Absen dari foto pakai `output_config.format` json_schema `ABSEN_SCHEMA`) → kalau key kosong / error / timeout 25 dtk (foto 35) / refusal → otomatis **Gemini cadangan** (respons berisi `note`). Pilihan Nick 27 Okt 2026: Claude utama + Gemini cadangan, Sonnet 5.5. Env var Gemini: `GEMINI_API_KEY`, `AI_PIN` (opsional — kosong = tanpa kode akses; Nick memilih tanpa kode, 27 Okt 2026), `GEMINI_MODEL` (opsional, default `gemini-3.5-flash`; cadangan otomatis `gemini-flash-latest` → `gemini-3.8-flash` → `gemini-flash-lite-latest` kalau sibuk/dipensiunkan/timeout 20 dtk; `gemini-2.5-flash` sudah tidak tersedia untuk user baru). Diagnosa: POST `/api/ai` `{"action":"models"}` → daftar model untuk key itu. **JANGAN** taruh API key di `index.html`/repo. System prompt ada di server (`SYSTEM_PROMPT`), rate limit 15/menit per IP
- Pindah tab pakai `smoothSwap()` (View Transitions + `skipTransition()` pengaman 450ms) — jangan hapus pengamannya
- HP ≤600px: blok CSS "mode rapat" di akhir `<style>`; input Android 14px, iOS tetap 16px (anti auto-zoom)

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

### Absensi offline (v37)
- SEMUA simpan absensi lewat `saveAttendance(memberId, dateId, status)` — jangan panggil `supa.from('attendance')` langsung dari UI
- Gagal karena jaringan → antrean di HP + kotak `.dot.pend`; error database tetap di-throw (bukan diantrekan)
- `handleAttendanceChange` skip key yang masih di `_ATT_Q`; render pakai `attShown()`

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
- Viewport: zoom diizinkan (v32). Input 16px di iOS (anti auto-zoom), 14px di Android (v33)
- Sidebar disembunyikan → top bar putih + bottom nav (`.mtop`, `.mnav`); logo kotak "A" disembunyikan (v33)
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
- Browser back button: pushState `/teen-NN` saat masuk CG; `goBack()` kembali ke alamat sebelumnya (`_URL_BEFORE_CG`)
- **Tidak ada login** — `/coach` & `/tl` mudah ditebak; siapa pun yang tahu alamatnya bisa edit data semua CG. Rencana: PIN Coach/TL
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
| v53 | **Daftar lagu PAW** di jawaban AI: blok ```lagu {judul, lagu:[{judul, artis, tipe P/W/S}]}``` → kartu (`aiLaguHTML`) dengan tombol **Lirik** (link pencarian YouTube "judul artis lyrics") & **Spotify** (pencarian) — sengaja link pencarian, bukan URL video (tidak rusak / tidak dikarang AI); lirik tidak ditulis (hak cipta). Salin/WA ikut link lirik (`aiLaguText`) |
| v52 | Saran pertanyaan CGL "Ide sharing & game" → "Ide game & ice breaking" (aturan Training AI: materi sharing/SM → cek CGSM di aplikasi GMS) |
| v51 | **Ubah data anak lewat chat** (Coach/TL & CGL): AI menulis ```ubah {perubahan:[{id,nama,data:{…}}]}``` → kartu → modal `aiUbahModal` (centang per kolom, bisa diedit) → `ubSave()`: hanya kolom `AI_UBAH_FIELDS` (milestone true/null, status CGL/Sponsor/Member/Simpatisan/VIP, sekolah, kelas, kelurahan/kecamatan via `canonWilayah`, wa, lahir YYYY-MM-DD); baca ulang dari DB dulu → kolom yang sudah diubah orang lain dilewati; nama tidak bisa diubah; peringatan urutan milestone (`UB_PREREQ`). **Ulang tahun terdekat** (30 hari, `upcomingBirthdays`/`birthdaySectionHTML`) di Overview Coach/TL & tab Detail CG + **Ucapan WA** buatan AI (`aiBday`, modal `aiBdayModal`) |
| v50 | Tombol **Training AI** (dulu "Pengetahuan AI", label tetap tampil di HP) + kolom cepat "Ajarkan hal baru" (`aiTeachAdd` → poin baru di akhir, tersimpan setelah Simpan). HP: baris tombol atas chat turun ke baris kedua; teks tips isi absensi tidak terpecah |
| v49 | **Bagan struktur** di jawaban AI: blok ```struktur {judul, node:{nama, peran, anak:[…]}}``` → pohon kartu (`aiStrukturHTML`, warna per tingkat, maks 80 kotak), "Simpan gambar" (`aiOrgCanvas`), Salin/WA jadi daftar teks (`aiStrukturText`). Nama yang tidak diketahui ditulis "(belum diisi)" |
| v48 | **Isi absensi lewat chat / suara** (Coach/TL & CGL): AI menulis blok ```absen {cg,tanggal,hasil:[{id,nama,status}],tidak_cocok}``` → kartu `aiAbsenCardHTML` → "Cek & simpan" (`aiAbsenFromChat`) → layar cek `aiAbsenModal` (sumber `chat`, tanggal bisa diganti `abSetDateKeep`) → `abSave()`; tidak ada yang tersimpan otomatis; CGL hanya CG-nya. Konteks anggota + `id`. `_AB` mendukung dashboard CGL (`_AB.cgl` → MEMBERS/DATES/ATTENDANCE; simpan perbarui ATTENDANCE & ALL_ATTENDANCE + computeStats). **Absen dari foto di tab Absensi CGL** (`openAbsenFoto(CUR_CG, true)`) |
| v47 | **Tanya AI untuk CGL** (tab `ai` di dashboard CG, `renderCGLAI` → `aiMountChat('cgl')`; konteks `buildCGLAIContext` dari `MEMBERS/DATES/ATTENDANCE` — hanya CG itu; layar chat 1 di DOM, `_AI.mode/_AI.scope`). **Pengetahuan AI ("training")**: Coach/TL isi teks di modal `aiNotesModal` → `cg_vision` `cg='__AI_NOTES__'`, `region='all'` (maks 20.000 karakter) → dikirim sebagai `notes` → masuk system prompt. **Data pribadi anak** (no HP, tgl lahir, sekolah, kelas, kelurahan/kecamatan, catatan CGL) dikirim sebagai `private` → server HANYA meneruskan ke Claude, tidak ke Gemini (keputusan Nick 27 Okt 2026). **Pilihan AI** Auto/Claude/Gemini (`localStorage aog_ai_provider`, body `provider`), label "dijawab Claude/Gemini". Tombol Absen dari foto dihapus dari tab Tanya AI (tetap di tab Absensi) |
| v46 | **Tanya AI mengalir (streaming)**: `aiAsk` kirim `stream: true` → server balas NDJSON (`{"t"}`… `{"done"}` / `{"error"}`) dari Claude SSE atau Gemini `streamGenerateContent?alt=sse`; fallback ke Gemini hanya kalau Claude gagal **sebelum** ada teks. Client `aiReadStream`/`aiPaintLive` (timer 60 ms, bukan rAF), grafik ditahan sampai blok ```chart lengkap. Absen dari foto & ringkasan anak tetap non-stream. Fix: kutipan `>` dirender sebagai kotak (`.ai-quote`) |
| v45+ | `api/ai.js`: **Claude Sonnet 5.5 utama, Gemini cadangan otomatis** (aktif setelah `ANTHROPIC_API_KEY` diisi di Vercel; tanpa key tetap Gemini). Diagnosa `{"action":"models"}` menampilkan `claude.aktif` |
| v45 | "Perlu perhatian" & AI: **hanya Alpa yang dihitung** (aturan Nick: Sakit = Izin = berhalangan dengan kabar, dilewati). Kriteria: 3x berturut Alpa (I/S dilewati, tidak memutus), atau % Hadir dari H+A turun ≥40 poin dari ≥60%. Field konteks AI jadi `alpa_beruntun` |
| v44 | **Absen dari foto** Coach/TL (`openAbsenFoto`, modal `aiAbsenModal`; tombol di tab Absensi Coach & Tanya AI): pilih CG + tanggal → foto → AI (mode `json: true` → Gemini `responseMimeType` JSON) mengusulkan H/I/S/A per `id` anggota → layar cek & koreksi → `abSave()` lewat `saveAttendance()` + `_DOT_SAVING`; tidak ada yang tersimpan sebelum Simpan, "Sisanya → Alpa" hanya manual. **Perlu perhatian** di Overview (`computeDriftAlerts`/`buildDriftSection`: 3+ ibadah berturut tanpa H, atau turun ≥40 poin dari ≥60%; tanpa AI) + "Saran & WA" (`driftFollowUp`). **AI paham cara pakai web**: `APP_GUIDE` di `api/ai.js` (update kalau fitur/menu berubah). Konteks AI + `tidak_hadir_beruntun`; baca foto timeout 35 dtk |
| v43 | Tanya AI: **simpan grafik/tabel jadi PNG** (`aiSaveImage` → canvas; HP = menu bagikan/WA, laptop = unduh), **grafik batang** (`"tipe":"batang"` di blok chart), **kirim foto ke AI** (`aiPickImage`/`aiResizeImage` maks 1400px JPEG, dikirim sebagai `image` → Gemini `inlineData`; server cek mime jpeg/png/webp + maks ~3.5MB; foto tidak disimpan di riwayat, hanya tanda "foto") |
| v42 | Tanya AI: data + pelayanan 4 bulan, rencana pengembangan, visi/misi, milestone berikutnya (`aiData`); **Ringkasan AI per anak** + draft WA (`aiSummarizeMember`, di modal detail anak Coach & pencarian member; nomor WA hanya dipakai lokal); **grafik garis** dari blok ```chart JSON``` (`aiChartHTML`); riwayat chat per cakupan (`localStorage aog_ai_chat_v1`); input suara (`aiMic`); cache data 90 dtk + prefetch; server `thinkingLevel: low` (fallback tanpa); tulisan "Gemini" dihapus dari UI |
| v41 | Tanya AI: konteks berisi angka siap pakai (persen per bulan per CG & anak, 3 ibadah terakhir, terakhir hadir, bulan_ini) supaya AI tidak salah periode/hitung |
| v40 | Tanya AI: jawaban ringkas default + petunjuk kalau terpotong (`finish: MAX_TOKENS`), formatter (nomor asli, sub-poin, garis, miring), sapaan/cakupan ikut ganti Coach↔TL & region (`aiScopeChanged`) |
| v39 | Tanya AI lebar penuh; `api/ai.js` timeout per panggilan + model cadangan + diagnosa model |
| v38 | **Tab Tanya AI** (Coach/TL) via Gemini: `api/ai.js` (key & kode akses di Vercel env), data terbaru dikirim tiap pertanyaan tanpa data pribadi, saran pertanyaan, salin / kirim WA, render tabel & daftar |
| v37 | **Absensi offline** (antrean `aog_att_queue_v1` di localStorage via `saveAttendance()`/`flushAttQueue()`), **Arsipkan** member (`archiveMember` → ARSIP JAKTIM 1/2) + Hapus member tetap ada, **Pindah CG** Coach/TL (`moveMemberCG`, juga di pencarian member → restore dari arsip), tgl lahir pakai date picker (`parseLahir`, data lama tak lengkap tidak terhapus), saran kecamatan/kelurahan (`WILAYAH_MAP`, `canonWilayah`), field tidak disimpan kalau tidak berubah (`data-orig`) |
| v36 | Detail CG: ringkasan CG (rata-rata hadir + tren, follow-up, milestone, data belum lengkap) + info sekolah di kartu anak |
| v35 | Pengaman transisi tab tanpa error console; cek versi pakai `fetch('/')` (cegah cache SW membengkak) |
| v34 | Tabel absensi desktop lebih lega; banner "Versi baru tersedia · Muat ulang" (`checkNewVersion`) |
| v33 | HP mode rapat (≤600px), chart garis di kartu anak, URL `/teen-NN`, pindah tab crossfade (`smoothSwap`), toggle Coach/TL slider, konten lebar penuh, Distribusi wilayah rapi + normalisasi chip, Detail kartu anak + modal, `/coach` & `/tl`, tema tahun bisa diedit, pengingat CGL manual saja |
| v32 | **Redesign UI** (branch `redesign`) — sidebar + bottom nav, tema & warna tetap v31 (Instrument Serif + Inter), landing page persis v31, ikon SVG pengganti emoji, kartu KPI, accordion Coach, heatmap milestone, modal berlabel. Logika data/Supabase tidak diubah. Fix: tombol Undo toast bisa diklik |

Detail changelog per version ada di git log (`git log --oneline`).

### Pengetahuan AI (27 Okt 2026)
- Baris `cg_vision` id 55 (`__AI_NOTES__`/`all`) diisi riset GMS (situs resmi gms.church, berita; medsos tidak terbaca tanpa login) + info pemimpin (TL Bro Justin Seravian, Gembala Lokal Ko Mike Budiman, Gembala Lokal AOG KG Ko Amos, Gembala Regional Ko Fuji Harsono, Gembala Sinode Ko Philip, Coach Jaktim 1 Nickcllauss, Coach Jaktim 2 Maritza) atas permintaan Nick. Cadangan sebelum diubah: `C:\Penyimpanan utama\Downloads\backup_ai_notes_2026-10-27.json` `..._tahap2.json`, `..._tahap3.json`, `..._tahap4.json`, `..._tahap5.json`, `..._tahap6.json`. Aturan jawaban: pertanyaan sharing/SM → arahkan ke CGSM di aplikasi GMS Church (tidak mengarang materi). Juga berisi **ide game CG** (ice breaker, onsite/online/hybrid, rohani, tips) dan **lagu PAW** (~85 judul GMS Live / Indonesia / internasional + tempo + tema, 5 contoh susunan, tips; tanpa lirik — hak cipta). Total ±12.200 dari 20.000 karakter. Edit selanjutnya lewat tombol "Training AI" di tab Tanya AI Coach/TL

### Pembersihan data (27 Okt 2026, langsung di Supabase, cadangan di `C:\Penyimpanan utama\Downloads\backup_*_2026-10-27*.json`)
- 21 member: teks "· Kelas X" (bug input gabungan pra-v31) dihapus dari kolom `sekolah`; kelas diisi/dinaikkan ke angka tertinggi (aturan dari Nick)
- 6 member: kolom `kelurahan` berisi "Kelurahan, Kecamatan" dipisah ke kolomnya (Jonathan → Cakung Timur/Cakung, Glenn → Cipinang Muara/Jatinegara)
- Masih perlu diisi CGL: alamat jalan di kolom kelurahan (Aiko TEEN 25, Carissa TEEN 17), tgl lahir tanpa tahun (Aiko, Justin & Grace TEEN 17)
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
