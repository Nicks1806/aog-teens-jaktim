# AOG Teens Jaktim — MASTER HANDOFF (v31)

> **📢 Untuk Claude Code baru:** Ini adalah master document tunggal berisi SEMUA yang perlu kamu tahu untuk bantu user melanjutkan project ini. Baca berurutan dari atas sampai bawah. Setelah selesai baca, kamu akan punya konteks setara dengan Claude yang sebelumnya kerja di project ini.
>
> **🔑 Akses:** Working directory `C:\Penyimpanan utama\Downloads\absen ibadahh\` dengan full edit permission. Git remote sudah connected (`Nicks1806/aog-teens-jaktim`). Vercel auto-deploy on push ke `main`.
>
> **👤 User:** Nickclauss Yohanes San (Coach jaktim1, admin gereja AOG Teens Jakarta Timur). Prefer bahasa Indonesia santai, response singkat + step-by-step. Awam DB & git.

---

# TABLE OF CONTENTS

1. [Quick Start (Baca Ini Dulu)](#1-quick-start)
2. [Project Overview](#2-project-overview)
3. [Tech Stack & All Access](#3-tech-stack--all-access)
4. [File Structure](#4-file-structure)
5. [Database Schema Lengkap](#5-database-schema-lengkap)
6. [Arsitektur Aplikasi](#6-arsitektur-aplikasi)
7. [Fitur Detail Per Halaman](#7-fitur-detail-per-halaman)
8. [Global JavaScript Variables](#8-global-javascript-variables)
9. [Session Narrative — Apa Yang Sudah Dikerjakan](#9-session-narrative)
10. [Version History v18-v30](#10-version-history)
11. [SQL Recipe Cookbook](#11-sql-recipe-cookbook)
12. [Code Patterns — DO & DON'T](#12-code-patterns)
13. [Debug Toolkit](#13-debug-toolkit)
14. [Common Bugs & How Kami Fix](#14-common-bugs--how-kami-fix)
15. [Deploy Workflow](#15-deploy-workflow)
16. [Emergency Rollback](#16-emergency-rollback)
17. [User Preferences (Cara Kerja dengan Nick)](#17-user-preferences)
18. [Related Projects](#18-related-projects)
19. [Known Limitations](#19-known-limitations)
20. [Startup Checklist Claude Code Baru](#20-startup-checklist)

---

## 1. Quick Start

### Baca Prompt Ini Dari User:
> "aku mau pindah claude code, kasih setiap code, flow dan akses ke setiap project"

### Yang Harus Kamu Lakukan:
1. Baca file ini (MASTER_HANDOFF.md) full — jangan skip
2. Baca `CLAUDE.md` untuk cross-reference
3. Optional: baca `HANDOFF.md` untuk konteks lebih dalam
4. Verify project state:
   ```bash
   cd "C:/Penyimpanan utama/Downloads/absen ibadahh"
   git log --oneline -10
   git status
   ```
5. Verify production live: `https://absenibadahjaktim.vercel.app` — harus tampil "v31" (atau lebih baru) di pojok kanan atas
6. Baca `V31_CHANGELOG.md` — 27 bug fix terakhir

### Prompt Startup yang Bagus:
```
Aku lanjut project AOG Teens Jaktim. Baca MASTER_HANDOFF.md di 
C:\Penyimpanan utama\Downloads\absen ibadahh\ untuk konteks penuh. 
Setelah baca, konfirmasi kamu paham dengan menyebut:
1. Tech stack + rules struktur file
2. Berapa tabel di database + tabel paling sering di-update
3. Cara kerja fetchAllAttendance dan kenapa penting
4. Fitur v29, v30, dan v31 tentang apa
```

---

## 2. Project Overview

**Nama:** AOG Teens Jakarta Timur — CG Dashboard (Absensi + Management)

**Fungsi:** Single-file web app untuk tracking attendance, pelayanan, milestone, events, visi, dan distribusi wilayah Cell Group (CG) gereja Assemblies of God Teens Jakarta Timur.

**Pengguna:**
- ~54 member remaja
- 9 CG Leaders (CGL) — 5 jaktim1 + 4 jaktim2
- 2 Coach (1 per region)
- 1 Team Leader (TL) — supervise semua

**Peak usage:** Setiap **Minggu jam ibadah** — semua CGL online bersamaan input absensi lewat HP mereka.

**URL:**
- Public (CGL): `https://absenibadahjaktim.vercel.app`
- Coach/TL: `https://absenibadahjaktim.vercel.app/?role=coach`

**Konteks bisnis:**
- Church attendance tracking — untuk pastoral care (identify at-risk members)
- Growth tracking via milestone (MSJ 1-3, CGT 1-3, Baptis Air, Baptis Roh)
- Pelayanan scheduling
- Event coordination
- Visi & rencana pengembangan member per CG

---

## 3. Tech Stack & All Access

### Frontend
- **Vanilla JavaScript** — NO framework (no React/Vue/Svelte)
- **NO build step** — pure HTML file served as-is
- **NO npm/node** — dependencies via CDN (Supabase JS v2)
- **Single file:** `index.html` ~9000+ baris (HTML + CSS + JS combined)

### Backend
- **Supabase** (PostgreSQL + Realtime WebSocket)
- URL: `https://gqppviugodokncxezdwd.supabase.co`
- Anon key: hardcoded di `index.html` (acceptable — app internal gereja)
- RLS: **DISABLED** di semua tabel
- Realtime: ENABLED via `ALTER PUBLICATION supabase_realtime`

### Deployment
- **GitHub:** `https://github.com/Nicks1806/aog-teens-jaktim`
- Branch: `main` (single branch, no feature branches)
- Git user: `Nicks1806`
- **Vercel:** connected to `main`, auto-deploy on push
- Publish directory: `.` (root)
- Build command: kosong
- Environment vars: TIDAK ADA

### Google Sheets Sync
- File: `google-apps-script.gs`
- Trigger: `runAutoSync` setiap 1 menit
- Sheet names: `JAKTIM 1`, `JAKTIM 2`, `DETAIL JAKTIM 1 ` (trailing space!), `DETAIL JAKTIM 2 ` (trailing space!)

### PWA
- Manifest: `/manifest.json`
- Icon: `/icon.jpg` (2000x2000 JPG)
- Service Worker: `/service-worker.js` (network-first strategy)
- Support push notification (bell button 🔔 di header)

---

## 4. File Structure

```
C:\Penyimpanan utama\Downloads\absen ibadahh\
├── index.html                 (~407KB, main app — single file)
├── service-worker.js          (~3.2KB, PWA SW network-first)
├── manifest.json              (~625B, PWA manifest)
├── icon.jpg                   (~91KB, PWA icon 2000x2000)
├── google-apps-script.gs      (~34KB, Sheets sync)
├── CLAUDE.md                  (~11KB, project docs core)
├── HANDOFF.md                 (~29KB, comprehensive handoff)
├── MASTER_HANDOFF.md          (this file, single source of truth)
├── KELAPA_GADING_SETUP.md     (~16KB, blueprint cabang baru)
└── .git/, .claude/            (git metadata + Claude config)
```

**Rules FILE:**
- JANGAN split `index.html` ke multiple file
- JANGAN buat file baru untuk fitur baru
- JANGAN buat README.md kecuali user minta
- Kalau update logic, edit file yang sudah ada

---

## 5. Database Schema Lengkap

12 tabel di schema `public`:

### 5.1 members (54 rows saat ini)
```
id              int8      PK
nama            text
cg              text      e.g. "TEEN 01", atau "ARSIP JAKTIM 1"
status          text      "CGL" | "Sponsor" | "Member" | "Simpatisan" | "VIP" | "Alumni"
region          text      "jaktim1" | "jaktim2"
lahir           text      "YYYY-MM-DD" (ISO date)
wa              text      no HP tanpa +62
sekolah         text
kelas           text
kelurahan       text
kecamatan       text
msj1, msj2, msj3        bool  (milestone MSJ)
cgt1, cgt2, cgt3        bool  (milestone CGT)
baptis_air, baptis_roh  bool
created_at      timestamp (default)
```

### 5.2 attendance (1188+ rows, TERUS BERTAMBAH)
```
member_id   int8   FK members
date_id     int8   FK dates
status      text   "H" | "I" | "S" | "A"
```
**PENTING:** Tabel ini > 1000 row → wajib pakai pagination `fetchAllAttendance()` untuk fetch semua. Supabase REST API cap default 1000/query.

### 5.3 dates
```
id           int8      PK
label        text      e.g. "16 Mei 2026" atau "3-1-26"
region       text      "jaktim1" | "jaktim2"
sort_order   int4      untuk urutan chart
month_code   text      e.g. "MEI"
```
**Catatan:** Tanggal sama untuk jaktim1 & jaktim2 = **2 row berbeda** (id berbeda per region).

### 5.4 cg_info
```
cg          text  PK    e.g. "TEEN 01"
leader      text        nama CGL
hari_jam    text        e.g. "Senin/Kamis - 17.00"
lokasi      text        e.g. "JGC (Rumah Stefi)"
```

### 5.5 cg_vision
```
id       int8  PK
cg       text        atau "__COACH_jaktim1__" untuk visi coach region
region   text
visi     text
misi     text
UNIQUE (cg, region)
```

### 5.6 cg_dev_plans
```
id                int8 PK
cg                text
region            text
member_name       text
current_status    text
target_status     text        "CGL" | "Sponsor" | "Member"
deadline          date        opsional
created_at        timestamp
```

### 5.7 cg_pelayanan
```
cg              text
region          text
month           text        e.g. "2026-05"
week_date       text        e.g. "2026-05-03"
role_name       text        "Firman CG" | "PAW" | custom
member_name     text        bisa comma-separated (multi-assignee)
UNIQUE (cg, week_date, role_name)
```

### 5.8 cg_custom_roles
```
cg           text
region       text
role_name    text
abbr         text
color        text
bg           text
```

### 5.9 events (LEGACY — sedang phased out)
```
id           int8 PK
name         text
date_start   date
date_end     date (nullable)
cat          text        "Ibadah" | "CG Event" | "Birthday" | "Outreach"
note         text
image        text (base64 atau URL)
```

### 5.10 cg_events (event dengan 3-level scope)
```
id           int8 PK
cg           text
region       text
is_shared    bool        true = shared, false = per-CG
name         text
date_start   date
date_end     date (nullable)
cat          text
note         text
image        text
```

**Scope combinations:**
- Global: `is_shared=true, region='all'`
- Per region: `is_shared=true, region='jaktim1'|'jaktim2'`
- Per CG: `is_shared=false, cg=X, region=Y`

### 5.11 member_notes
```
member_id    int8 FK PK
cgl_note     text
```

### 5.12 coach_notes
```
cg       text
region   text
note     text
```

### Region & CG Layout Saat Ini
- **jaktim1** (5 CG): `TEEN 01`, `TEEN 06`, `TEEN 09`, `TEEN 23`, `TEEN 25`
- **jaktim2** (4 CG): `TEEN 07`, `TEEN 12`, `TEEN 17`, `TEEN 20`
- **Arsip:** `ARSIP JAKTIM 1`, `ARSIP JAKTIM 2` — di-filter dari display aktif

### CGL Saat Ini
**jaktim1:**
- TEEN 01: Olivia Isabel Pramono
- TEEN 06: Keizha Ananta
- TEEN 09: Jessica Anastasia
- TEEN 23: Tofanny Zerafim Alexandra
- TEEN 25: Valerie Alea Darmawan

**jaktim2:**
- TEEN 07: (varies)
- TEEN 12: (varies)
- TEEN 17: Lauvin (baru — sebelumnya Samantha, Samantha di-arsipkan)
- TEEN 20: (varies)

**Coach:**
- jaktim1: Nickclauss Yohanes San (juga user utama)
- jaktim2: (nama lain)

---

## 6. Arsitektur Aplikasi

### 3 Halaman Utama

#### Halaman 1: Landing (`pageL`)
- Toggle region JAKTIM 1 / JAKTIM 2
- Custom dropdown CG Leader (bukan native `<select>`, tapi div panel dengan avatar)
- Skip CG dengan nama prefix `ARSIP`
- Tombol "Masuk Dashboard"
- Link "Coach / TL? Masuk disini →" (`?role=coach`)

#### Halaman 2: CGL Dashboard (`pageD`) — per CG
**6 tab:**
1. **Absensi** — tabel H/I/S/A + line chart + Export Absensi CSV/PDF
2. **Detail CG** — per-member card + Export Detail CSV/PDF
3. **Visi CG** — Visi textarea + Misi click-to-edit list + Rencana Pengembangan Member (dev plan)
4. **Pelayanan** — jadwal per minggu multi-assignee + statistik
5. **Milestone** — donut SVG per milestone + progress bar per member
6. **Events** — CRUD event per CG + countdown + WA broadcast

Header: Rekap CG + Visi Coach read-only. Stats cards: Hadir, Izin, Sakit, Alpa.

#### Halaman 3: Coach/TL Dashboard (`pageC`)
**Toggle mode:**
- `COACH`: 1 region (jaktim1 atau jaktim2)
- `TL`: gabungan semua region

**5 tab:**
1. **Overview** — stats + Visi Coach editable + CG cards grid + Bar chart + **Distribusi Wilayah** + Export Detail
2. **Absensi** — per-CG cards clickable dot + line chart + Pending CGL list + Generate Sabtu + Absensi CSV/PDF
3. **Milestone** — filter chips + donut + per-CG accordion + Daftar Follow-up
4. **Visi** — accordion per CG (preserve state) — Visi, Misi, Dev Plan, Catatan Coach
5. **Events** — filter chips + CRUD + countdown + target dropdown (Global/Region/Per-CG)

---

## 7. Fitur Detail Per Halaman

### 7.1 CGL — Absensi Tab
- **Click dot** cycle: kosong → H → I → S → A → kosong
- **Optimistic UI** — update instant, save Supabase async
- **Auto-revert** kalau save gagal + toast error
- **`_DOT_SAVING` guard** — cegah double-tap race saat realtime echo
- **Undo tombol** 3.5 detik di toast setelah tap
- **Line chart SVG** — join-date detection accurate
- **Total Hadir footer** — denominator = member yang sudah aktif per tanggal
- **Mobile month filter** — ≤600px tampil bulan berjalan + tombol ‹ ›
- **Sticky Nama column** kiri
- **Export tombol** kanan atas: "📊 Absensi CSV" + "📄 Absensi PDF"

### 7.2 CGL — Detail CG Tab
- Per-member card (dcard):
  - Edit inline: nama, WA, tgl lahir, sekolah, kelas, kelurahan, kecamatan
  - Role dropdown: CGL/Sponsor/Member/Simpatisan/VIP — error revert kalau save gagal
  - Milestone chips (8 total: MSJ 1-3, CGT 1-3, B.Air, B.Roh) — toggle klik
  - Catatan CGL textarea (auto-save on blur)
  - Tombol Hapus Member (merah, kanan bawah)
- Tombol tambah: "+ Tambah Member" modal
- Export: "📊 Detail CSV" + "📄 Detail PDF" (kanan atas)
- **Member notes:** batch single query `.in('member_id', ids)`

### 7.3 CGL — Visi CG Tab
- **Visi textarea** — autosave dengan read-modify-write (mencegah overwrite field lain saat concurrent edit)
- **Misi click-to-edit** (v25+):
  - Display mode: numbered list dengan badge kuning + separator dashed
  - Click area → textarea muncul → edit
  - Blur → auto-save + revert ke view formatted
- **Rencana Pengembangan Member** section:
  - Modal pilih member (card grid) + target role + deadline (opsional)
  - Save ke `cg_dev_plans` table

### 7.4 CGL — Pelayanan Tab
- Multi-assignee per role (comma-separated di 1 kolom)
- Bulan selector + tambah bulan
- Week pills (add/edit/delete)
- Default roles: Firman CG, PAW, Game, Sharing
- Custom roles via `cg_custom_roles` table
- Statistik: Distribusi Jenis, Top Pelayanan, Belum Pernah/Jarang
- Rekap Bulanan multi-assignee aware

### 7.5 CGL — Milestone Tab
- Donut SVG per milestone (8 chart)
- Filter chips instant (data cached, no refetch)
- Progress bar per member
- Follow-up indicator (progression-aware: CGT 2 hanya kalau sudah CGT 1)

### 7.6 CGL — Events Tab
- CRUD event per CG (dari `cg_events` where `cg=X, is_shared=false`)
- Juga tampil shared events (`is_shared=true`)
- Date range: start + optional end
- Countdown: "HARI INI 🔥", "3 hari lagi ⏰", "5 hari lalu ⚠"
- Filter chips: Semua, Ibadah, CG Event, Birthday, Outreach
- Auto-cleanup event lewat 7 hari (skip `is_shared=true`)
- Actions per card: Copy text, Broadcast WhatsApp, Edit, Delete

### 7.7 Coach — Overview Tab
- 4 stats cards top: Member, Avg Hadir %, At Risk, BLM MSJ1
- Region toggle Jaktim 1 / Jaktim 2 (Coach only, TL skip)
- Export Detail Coach/TL tombol
- Visi Coach editable card per region (untuk TL: 2 card)
- **CG cards grid** — click enter CG dashboard
- **Bar chart comparison** antar CG
- **Distribusi Wilayah** (v29+):
  - Chip Kecamatan (purple) + chip Kelurahan (violet)
  - Auto-refilter kelurahan sesuai kecamatan aktif
  - List member: nama + CG badge + status + alamat + No HP
  - Export Wilayah CSV
  - Info total member punya alamat vs belum

### 7.8 Coach — Absensi Tab
- Region toggle + Refresh button + Absensi CSV/PDF + Generate Sabtu
- Per-CG cards dengan:
  - Nama CG + avg hadir % header
  - Tabel absensi dengan dot **CLICKABLE** (v18+, `cycleDotCoach`)
  - Line chart per CG (opsional)
- **Line chart global region** (setelah semua CG)
- **Pending CGL list** — CG yang belum input 4 tanggal ibadah terakhir
- **Ingatkan tombol** per CG + Ingatkan Semua
- Auto-broadcast reminder (rate-limited 2 jam per CG)
- Generate Sabtu tombol — auto-detect bulan berikutnya

### 7.9 Coach — Milestone Tab
- Filter chips: Semua, MSJ, CGT, Baptis
- Donut chart
- Per-CG breakdown accordion
- Daftar Follow-up progression-aware

### 7.10 Coach — Visi Tab
- Accordion per CG (click header expand)
- **Preserve expand state** across realtime re-render (via `_VISI_EXPANDED` Set)
- Card 1: Visi (read-only display of CGL's visi)
- Card 2: Misi (numbered list display)
- Card 3: **Rencana Pengembangan** — sort by deadline, color-coded countdown badge (overdue red, today yellow, ≤7d orange, ≤30d blue, >30d green)
- Card 4: Catatan Coach (textarea Coach edit — save ke `coach_notes`)

### 7.11 Coach — Events Tab
- Filter chips
- CRUD event
- **Target dropdown** saat tambah/edit:
  - Global (`is_shared=true, region='all'`)
  - Per Region (`is_shared=true, region='jaktim1'|'jaktim2'`)
  - Per CG (`is_shared=false, cg=X, region=Y`)

---

## 8. Global JavaScript Variables

### CGL Scope
```javascript
CUR_CG          // "TEEN 01"
CUR_REGION      // "jaktim1"
CUR_CG_INFO     // {cg, leader, hari_jam, lokasi}
MEMBERS         // Array<Member> for CUR_CG only
DATES           // Array<Date> for CUR_REGION only
ATTENDANCE      // { "memberId_dateId": "H"/"I"/"S"/"A" }
```

### Coach/TL Scope
```javascript
ALL_MEMBERS     // Array<Member> ALL regions
ALL_CG_INFO     // Array<CGInfo> semua CG
ALL_DATES       // Array<Date> ALL regions (jaktim1 + jaktim2)
ALL_ATTENDANCE  // { "memberId_dateId": "..." } — PAGINATED via fetchAllAttendance
ALL_EVENTS      // Array<Event> shared events legacy
coachRole       // "coach" | "tl"
coachReg        // "jaktim1" | "jaktim2"
```

### State Helpers
```javascript
_DOT_SAVING           // { "memberId_dateId": true } — guard cycle dot race
_VISI_EXPANDED        // Set<cgName> — accordion state Coach Visi
_OWN_EVENT_IDS        // Set<eventId> — suppress own event notif (15s)
_NOTIF_DEDUPE         // Set<tag> — dedupe push notifications
_COACH_POLL_TIMER     // setInterval handle 60s polling
_CACHED_CG_EVENTS     // event cache untuk CGL
_CACHED_ALL_CG_EVENTS // event cache untuk Coach
_UNDO_DATA            // { memberId, dateId, prev, dotEl } untuk undo cycle
NOTIF_KEY             // "aog_notif_enabled" localStorage key

window.__WILAYAH_KEC      // 'all' | kecamatan name
window.__WILAYAH_KEL      // 'all' | kelurahan name
window.__pendingCGLs      // cache pending list
window.__COACH_MS_FILTER  // filter milestone Coach
window.__editingEventId   // saat edit event
window.__coachEventCtx    // context event coach modal
window.__eventCache       // cache event by id
window.__SELECTED_DEV_MEMBER  // saat pilih member di dev plan modal

TAB_RENDERED             // { tabId: bool } — CGL lazy render flags
COACH_TAB_RENDERED       // { tabId: bool } — Coach lazy render flags
MOBILE_MONTH_OFFSET      // offset untuk mobile month nav
```

---

## 9. Session Narrative

Berikut adalah rangkuman kronologis apa yang sudah dikerjakan bersama Nick di sesi ini:

### Awal Session
User awal punya webapp yang basic — bug dan issues bertumpuk. Kita mulai fix satu per satu.

### Sesi Debug & Feature Milestone-Milestone

**PWA Icon + Push Notification:**
- Nick request logo PWA proper (bukan default "A")
- Extract logo dari existing favicon → jadi `/icon.jpg`
- Setup manifest sizes="any" untuk JPG 2000x2000
- Bell button 🔔 toggle Notification API permission
- iOS PWA guard: skip `pushNotif` kalau SW controller belum aktif (mencegah `Illegal constructor` error di iOS)
- Own-write suppression via `_OWN_EVENT_IDS` — CGL yang bikin event sendiri tidak dapat notif dari eventnya
- Notif dedupe tag stable (bukan `Date.now()`)

**Google Sheets Sync Issue:**
- User laporan member baru masuk di paling bawah sheet, bukan di grup CG mereka
- Fix: `google-apps-script.gs` syncAbsensi + syncDetail — smart insert per-CG group (bukan append)
- Kolom tanggal duplikat: fix `dedupDateColumns()` di Apps Script
- Timezone: `Utilities.formatDate(s, 'Asia/Jakarta', 'd-M')` explicit di `normDate`

**Coach Sync Tidak Match CGL:**
- Bug utama session — CGL update tapi Coach tidak lihat update terbaru
- Investigated deeply: Supabase REST API punya server-side max_rows cap 1000
- `.limit(100000)` di client TIDAK bypass cap ini
- Attendance sudah > 1000 row (54 × 22 dates = 1188+) → tanggal terbaru terpotong
- **Fix v22:** `fetchAllAttendance()` — loop `.range(from, from+999)` sampai habis
- **Fix v27:** tambah `.order('member_id').order('date_id')` untuk konsistensi pagination
- **Fix v27:** `fetchBoundedAttendance` untuk CGL queries
- **Fix v27:** Apps Script juga pakai HTTP Range header pagination

**Coach Triple Sync Safety Net:**
- User tetap laporan sync lambat kadang-kadang
- Setup 5-layer sync:
  1. Realtime instant (WebSocket)
  2. Polling 60s silent (compare hash)
  3. Tab-switch refetch (Overview ↔ Absensi)
  4. Visibility focus refetch (window kembali)
  5. Manual tombol 🔄 Refresh

**Service Worker Cache Bug:**
- User complain "sudah refresh tapi masih versi lama"
- SW pakai stale-while-revalidate → user perlu refresh 2x
- **Fix v18/v24+:** SW network-first untuk HTML — 1x refresh = versi terbaru
- Version indicator "v30" di header supaya user verify sendiri

**Coach Dot Clickable:**
- User: Coach juga mau bisa edit absensi
- Fix: bikin `cycleDotCoach()` — sama seperti `cycleDot` tapi update `ALL_ATTENDANCE`
- Tambah data-mid/data-did attributes untuk realtime patch

**Line Chart Accurate (v25):**
- User laporan: kalau tambah member baru minggu ini, % minggu lalu turun (padahal member itu belum ada minggu lalu)
- Fix: deteksi "tanggal join" tiap member = record attendance paling awal mereka
- Untuk tiap tanggal D, denominator = member yang sudah aktif sampai D
- Member baru tidak pull down history

**TL Chart Merge Dates (v26):**
- User laporan chart TL muncul duplikat tanggal (16 Mei, 16 Mei, 23 Mei, 23 Mei...)
- Root cause: `ALL_DATES` punya 2 row untuk tiap tanggal (jaktim1 + jaktim2)
- Fix: merge by label untuk TL view, `getStatus(m, d)` cek semua `d.ids`

**Export Detail CG (v23):**
- User: "aku mau export data alamat + no HP semua CGL jaktim 1"
- Fix: `exportDetailCSV/PDF` untuk 3 role (CGL/Coach/TL)
- Kolom: CG, No, Nama, Status, Lahir, No HP, Sekolah, Kelas, Kelurahan, Kecamatan, MSJ 1-3, CGT 1-3, B.Air, B.Roh, Catatan CGL
- Label tombol jelas (v24): "Absensi CSV" vs "Detail CSV"

**Archive CG (v28):**
- User: "hapus Samantha dari TEEN 17, masukin archive"
- Fix: CG dengan prefix `ARSIP` di-filter dari display aktif
- Data attendance historis tetap aman di DB
- Member archive muncul di sheet arsip setelah `fullRebuild`

**Rebalance Jaktim 1 (4 CG → 5 CG):**
- User kasih table baru arrangement
- Buat CG baru: `TEEN 25` untuk Valerie Alea Darmawan
- Reassign members via SQL UPDATE
- Rename `__TEEN_NEW__` → `TEEN 25` setelah confirm

**Distribusi Wilayah (v29):**
- User: "buat filter alamat berdasarkan kecamatan/kelurahan"
- Design: chip 2-tingkat mirip milestone MSJ 1/2/3
- Fix v30: escape apostrophe + reset filter state saat toggle region/role + totalWithAddr consistency

**Documentation:**
- User: "aku mau pindah claude code, kasih semua konteks"
- Kita bikin `HANDOFF.md` 28 section, `CLAUDE.md` refresh ke v30, `KELAPA_GADING_SETUP.md` update
- Final: file ini (`MASTER_HANDOFF.md`) sebagai single source of truth

### Insight Penting dari Session
1. Supabase max_rows cap = **root cause paling sering** untuk "sync tidak jalan"
2. Apostrophe di data user (nama kelurahan misalnya) bisa break inline JS — selalu escape
3. Filter state global (window.__*) perlu reset saat context berubah (region/role toggle)
4. Realtime channel + polling redundancy penting — 1 layer saja tidak cukup
5. Service Worker network-first > stale-while-revalidate untuk UX (1x refresh = versi baru)
6. Version indicator visible = user bisa self-verify (kurangi bolak-balik debug)

---

## 10. Version History

Detail per version — read git log untuk changelog per commit:

| Ver | Feature / Fix | Impact |
|-----|--------------|--------|
| v18 | Service Worker network-first, iOS push guard | UX + iOS PWA fix |
| v19 | (skipped) | |
| v20 | Promise.allSettled di loadCoachData | Prevent "stuck loading" |
| v21 | Refetch dates di Coach + silent polling | Sync stability |
| v22 | **fetchAllAttendance pagination** | **CRITICAL — bypass 1000 cap** |
| v23 | Export Detail CG (CSV + PDF) | User request |
| v24 | Label tombol export jelas | UX clarity |
| v25 | **Line chart join-date detection** | Accurate historical stats |
| v26 | TL chart merge duplicate dates | Fix TL view |
| v27 | **`.order()` di fetchAllAttendance + fetchBoundedAttendance + Apps Script pagination + TL sort fallback** | **CRITICAL — data consistency** |
| v28 | Archive CG support | User feature |
| v29 | **Distribusi Wilayah** | User feature (major) |
| v30 | Wilayah hardening (escape + reset state + count consistency) | Post-audit fix |
| v31 | **27 bug fixes** — stats inflate, sekolah/kelas split, XSS PDF, 21 Supabase error checks, TEEN 25 color, reconnect guard, undo sync, milestone prereq, visi per-field save | Full audit (4 agent paralel) — detail di `V31_CHANGELOG.md` |

**Cache version di service-worker.js selalu match dengan header version di index.html.**

---

## 11. SQL Recipe Cookbook

### 11.1 Rebalance CG (Reassign Members)
```sql
BEGIN;
UPDATE members SET cg = 'TEEN 01' 
WHERE region = 'jaktim1' AND nama IN ('Nama 1', 'Nama 2', 'Nama 3');
COMMIT;
```

### 11.2 Ganti CGL
```sql
BEGIN;
UPDATE members SET status = 'CGL' WHERE nama = 'CGL Baru' AND cg = 'TEEN 17';
UPDATE members SET status = 'Member' WHERE nama = 'CGL Lama' AND cg = 'TEEN 17';
UPDATE cg_info SET leader = 'CGL Baru' WHERE cg = 'TEEN 17';
COMMIT;
```

### 11.3 Archive Member (Soft Delete)
```sql
BEGIN;
UPDATE members 
SET cg = 'ARSIP JAKTIM 2', status = 'Alumni'
WHERE nama = 'Nama' AND region = 'jaktim2';
COMMIT;
```

### 11.4 Buat CG Baru
```sql
INSERT INTO cg_info (cg, leader, hari_jam, lokasi)
VALUES ('TEEN 25', 'Nama CGL', '', '')
ON CONFLICT (cg) DO UPDATE SET leader = 'Nama CGL';

UPDATE members SET cg = 'TEEN 25', status = 'CGL' 
WHERE nama = 'Nama CGL' AND region = 'jaktim1';
```

### 11.5 Rename CG
```sql
BEGIN;
UPDATE members SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_info SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_events SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_vision SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_pelayanan SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_dev_plans SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE cg_custom_roles SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
UPDATE coach_notes SET cg = 'TEEN 25' WHERE cg = '__TEEN_NEW__';
COMMIT;
```

### 11.6 Verifikasi Layout
```sql
SELECT cg, status, nama 
FROM members 
WHERE region = 'jaktim1' AND cg NOT LIKE 'ARSIP%'
ORDER BY cg, 
  CASE LOWER(status) 
    WHEN 'cgl' THEN 0 WHEN 'sponsor' THEN 1 WHEN 'member' THEN 2 
    WHEN 'simpatisan' THEN 3 WHEN 'vip' THEN 4 ELSE 5 
  END, nama;
```

### 11.7 Hard Delete Member (rare — data hilang permanen)
```sql
DELETE FROM attendance WHERE member_id IN (
  SELECT id FROM members WHERE region='jaktim1' AND cg='TEEN 01' AND nama IN ('Nama')
);
DELETE FROM member_notes WHERE member_id IN (
  SELECT id FROM members WHERE region='jaktim1' AND cg='TEEN 01' AND nama IN ('Nama')
);
DELETE FROM members WHERE region='jaktim1' AND cg='TEEN 01' AND nama IN ('Nama');
```

### 11.8 Enable Realtime Publication (setup baru)
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE dates;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_info;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_pelayanan;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_events;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_vision;
ALTER PUBLICATION supabase_realtime ADD TABLE cg_dev_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE member_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE coach_notes;
```

### 11.9 Disable RLS (setup baru)
```sql
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
-- (dan semua 12 tabel)
```

### 11.10 Cek Tabel Realtime Aktif
```sql
SELECT tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' ORDER BY tablename;
```

---

## 12. Code Patterns

### 12.1 DO — Fetch Attendance (WAJIB pakai pagination)
```javascript
// ✅ CORRECT untuk unbounded fetch:
const attData = await fetchAllAttendance();
attData.forEach(a => { ALL_ATTENDANCE[a.member_id+'_'+a.date_id] = a.status; });

// ✅ CORRECT untuk bounded fetch (CGL scope):
const att = await fetchBoundedAttendance(memberIds, dateIds);
att.forEach(a => { ATTENDANCE[a.member_id + '_' + a.date_id] = a.status; });
```

### 12.2 DON'T — Fetch Attendance
```javascript
// ❌ WRONG — server cap 1000 tetap kena, data terpotong silent
await supa.from('attendance').select('*').limit(100000);

// ❌ WRONG — chain order salah, .range() setelah .in() bermasalah
await supa.from('attendance').select('...').range(0, 99999).in(...);
```

### 12.3 DO — Cycle Dot with Guard
```javascript
async function cycleDot(dotEl, memberId, dateId) {
  const key = memberId + '_' + dateId;
  if (_DOT_SAVING[key]) return;  // guard
  _DOT_SAVING[key] = true;
  const prev = ATTENDANCE[key] || null;
  const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(prev) + 1) % STATUS_CYCLE.length];
  // Optimistic UI
  if (next === null) delete ATTENDANCE[key]; else ATTENDANCE[key] = next;
  dotEl.className = 'dot ' + (next || 'X');
  dotEl.textContent = next || '-';
  try {
    const { error } = await supa.from('attendance')...;
    if (error) throw error;
    _UNDO_DATA = { memberId, dateId, prev, dotEl };
    showUndoToast();
  } catch(e) {
    // Revert
    if (prev) ATTENDANCE[key] = prev; else delete ATTENDANCE[key];
    dotEl.className = 'dot ' + (prev || 'X');
    dotEl.textContent = prev || '-';
    toast('❌ Gagal simpan');
  } finally {
    delete _DOT_SAVING[key];  // release guard
  }
}
```

### 12.4 DO — Role Class Whitelist
```javascript
// Selalu pakai helper roleCls() / roleLabel(), jangan .toLowerCase() langsung
const cls = roleCls(m.status);  // whitelist: cgl/sponsor/member/simpatisan/vip
const label = roleLabel(m.status);  // strip legacy "Target: " prefix
html += '<span class="role-btn '+cls+'">' + esc(label) + '</span>';
```

### 12.5 DO — Escape XSS
```javascript
// Semua string yang di-inject ke HTML, wajib esc()
html += '<div>' + esc(m.nama) + '</div>';  // ✅

// Untuk onclick attribute inline, escape backslash+apostrophe:
const safeName = cg.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
html += '<button onclick="doSomething(\''+safeName+'\')">...</button>';
```

### 12.6 DO — Realtime Handler with Debounce
```javascript
function handleXChange(payload) {
  rtDebounce('x', async () => {
    try {
      // Refetch + re-render
    } catch(e) { console.warn('[handleXChange]', e); }
  }, 500);
}
```

### 12.7 DON'T — Block Main Thread
```javascript
// ❌ WRONG — prompt() block main thread, disconnect realtime
const val = prompt('Enter name:');

// ✅ CORRECT — pakai asyncPrompt() yang sudah ada di source
const val = await asyncPrompt('Enter name:', 'default value');
```

### 12.8 DO — Version Bump Setiap Push UI Change
```javascript
// index.html — cari & ganti:
App version">v31  →  App version">v32

// service-worker.js:
const CACHE_NAME = 'aog-absensi-v31' → 'aog-absensi-v32'
```

---

## 13. Debug Toolkit

Di browser DevTools Console (F12):

### 13.1 Cek State Global
```javascript
// CGL scope
MEMBERS.length;
Object.keys(ATTENDANCE).length;
CUR_CG; CUR_REGION;

// Coach scope
ALL_MEMBERS.length;
ALL_DATES.length;
Object.keys(ALL_ATTENDANCE).length;
coachRole; coachReg;

// Filter state
window.__WILAYAH_KEC; window.__WILAYAH_KEL;
```

### 13.2 Realtime Debug
```javascript
realtimeChannel?.state;  // "joined" | "closed" | null
// Manual test broadcast
realtimeChannel?.send({
  type: 'broadcast',
  event: 'cgl_reminder',
  payload: { cg: 'TEEN 01', dates: ['16 Mei'] }
});
```

### 13.3 Force Refetch
```javascript
// Fresh attendance
fetchAllAttendance().then(d => console.log('Total rows:', d.length));

// Manual Coach refresh
refreshCoachAttendance();
```

### 13.4 Notification Check
```javascript
Notification.permission;       // 'granted' | 'denied' | 'default'
notifEnabled();                 // true kalau bell aktif
navigator.serviceWorker.controller;  // null kalau SW belum aktif
```

### 13.5 Service Worker
```javascript
caches.keys().then(k => console.log(k));  // check cache versions
navigator.serviceWorker.getRegistrations().then(r => console.log(r));
```

### 13.6 Query DB Langsung
```javascript
// Cek member spesifik
await supa.from('members').select('*').eq('nama', 'Olivia Isabel Pramono');

// Count attendance
await supa.from('attendance').select('*', { count: 'exact', head: true });
```

---

## 14. Common Bugs & How Kami Fix

### 14.1 "Data Tidak Sync"
**Root cause biasanya:** Supabase max_rows cap 1000, cache SW stale, atau realtime disconnect.

**Diagnosa:**
1. Cek "vXX" di pojok kanan atas — apakah versi terbaru?
2. Cek Live indicator hijau atau merah?
3. Console: `realtimeChannel?.state` — harus "joined"
4. Console: `Object.keys(ALL_ATTENDANCE).length` — bandingkan dengan `SELECT count(*) FROM attendance`

**Fix:**
- Hard refresh (Ctrl+Shift+R)
- Klik tombol 🔄 Refresh manual
- Kalau tetap tidak sinkron → cek pagination `fetchAllAttendance` dipakai atau tidak

### 14.2 "Chip Filter Break Setelah Klik"
**Root cause:** Data mengandung `'` atau `\` yang di-inject ke onclick inline attribute.

**Fix pattern:**
```javascript
const safe = str.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
```

### 14.3 "Coach Lihat Data Berbeda dari CGL"
**Root cause:** ALL_ATTENDANCE stale karena Coach tidak refetch, atau pagination missing.

**Fix:** Pakai `fetchAllAttendance()` (v22+) + triple sync (v20+).

### 14.4 "Line Chart Persentase Menurun Padahal Tambah Member"
**Root cause:** Denominator = total member (bukan yang sudah aktif di tanggal itu).

**Fix v25:** `memberJoinIdx` detection — hanya count member yang punya record di tanggal ≤ D.

### 14.5 "TL Chart Muncul Tanggal Duplikat"
**Root cause:** `ALL_DATES` punya 2 row per tanggal (jaktim1 + jaktim2).

**Fix v26:** Merge by label untuk `region='all'`.

### 14.6 "PWA Push Notif Tidak Muncul di iOS"
**Root cause:** iOS Safari `new Notification()` throw `Illegal constructor`.

**Fix v18+:** Skip `pushNotif` kalau `!navigator.serviceWorker.controller`.

### 14.7 "Filter Wilayah Kosong Setelah Pindah Region"
**Root cause:** `window.__WILAYAH_KEC` state stale (pilihan lama dari region sebelumnya).

**Fix v30:** Reset ke `'all'` saat toggle region + toggle role.

### 14.8 "Google Sheets Missing Data Row Terbaru"
**Root cause:** Apps Script fetch attendance tanpa pagination — kena 1000 cap.

**Fix v27:** `fetchAllAttendance()` di Apps Script pakai HTTP Range header.

### 14.9 "Coach Dot Klik Tidak Save"
**Root cause:** Coach view tidak punya `cycleDot` handler.

**Fix v18+:** Buat `cycleDotCoach()` — update `ALL_ATTENDANCE`.

### 14.10 "Refresh 2x Masih Versi Lama"
**Root cause:** SW stale-while-revalidate → cache dulu, background update.

**Fix v18+:** SW network-first untuk HTML.

---

## 15. Deploy Workflow

### Alur Push ke Production
```bash
# 1. Edit file(s)
cd "C:/Penyimpanan utama/Downloads/absen ibadahh"
# ... edit index.html, dll

# 2. Bump version DI 2 TEMPAT:
# - index.html: App version">v31  →  v32
# - service-worker.js: 'aog-absensi-v31' → 'aog-absensi-v32'

# 3. Commit
git add index.html service-worker.js
git commit -m "vXX: descriptive message"

# 4. Push
git push

# 5. Vercel auto-deploy ~10-30 detik
# 6. User hard refresh (network-first SW → langsung dapat versi baru)
# 7. Verify: cek "vXX" di pojok kanan atas app production
```

### Verifikasi Vercel Deploy
Buka: `https://absenibadahjaktim.vercel.app/service-worker.js`
Cari `CACHE_NAME` — harus match dengan yang di-push.

### Google Apps Script Update (kalau `.gs` berubah)
File `.gs` **TIDAK** ter-deploy via Vercel/GitHub. User harus:
1. Buka Google Sheets → Extensions → Apps Script
2. Ctrl+A → Delete → paste versi baru
3. Save → run `fullRebuildJaktim1` atau `fullRebuildJaktim2` sekali kalau perlu re-structure

---

## 16. Emergency Rollback

Kalau versi baru broken parah di production:

```bash
cd "C:/Penyimpanan utama/Downloads/absen ibadahh"
git log --oneline -10   # cari commit hash versi stabil terakhir
git revert HEAD          # revert commit terakhir
git push                 # push revert → Vercel re-deploy versi lama
```

Atau untuk rollback lebih dari 1 commit:
```bash
git reset --hard <hash-stabil>
git push --force        # ⚠️ FORCE PUSH — hati-hati, hanya kalau yakin
```

**Prevention:**
- Test di CGL view + Coach view + TL mode sebelum push
- Cek DevTools console untuk error
- Cek Live indicator hijau
- Pastikan pagination masih pakai `fetchAllAttendance`

---

## 17. User Preferences

### Nick's Style
- **Bahasa:** Indonesia santai, campuran (jaktim, kelapa gading, dst)
- **Response length:** Singkat + bullet points > paragraph panjang
- **Format:** Kasih SQL/kode langsung siap-copy-paste
- **Awam:** DB, git, JS — jelaskan seperlunya, jangan asumsi
- **Fokus:** Yang penting jalan di production, bukan best practice academic

### Yang Nick Suka
- ✅ Emoji 🔴🟡🟢 untuk status/priority
- ✅ Table markdown untuk comparison
- ✅ Step-by-step numbered list
- ✅ SQL dengan `BEGIN; ... COMMIT;` wrapper
- ✅ Version indicator visible ("v30" di pojok)
- ✅ Direct answer, no fluff intro
- ✅ Explain "why" hanya kalau non-obvious

### Yang Nick Tidak Suka
- ❌ Response panjang tanpa struktur
- ❌ Asumsi user paham teknis
- ❌ Suggest "practice" tanpa give SQL langsung
- ❌ Confirmation loop yang berlebihan ("Yakin?", "Sudah check?")
- ❌ Multiple `AskUserQuestion` untuk hal kecil

### Prompt Style Nick
Contoh prompt Nick yang sering:
- "cek apakah ada bug yang bisa di fix"
- "kalau begini bisa?"
- "bisa buat agar [fitur]"
- "hapus X, ubah Y jadi Z"
- "sudah full tidak ada yg ke miss?"

Respond langsung dengan action + SQL/kode, jangan tanya balik kecuali benar-benar perlu.

---

## 18. Related Projects

### 18.1 TWS Project (Terpisah)
- Nama: Trade With Suli — internal CRM/sales tool
- Path: `C:\Penyimpanan utama\Downloads\files (8)`
- Tech: Similar (single-file JS + Supabase + Vercel)
- Status: Sedang berkembang, terpisah dari AOG
- Jangan campur konteks — tapi Nick mungkin sebut kalau minta bantuan project lain

### 18.2 Kelapa Gading (Blueprint, belum di-deploy)
- File: `KELAPA_GADING_SETUP.md`
- Blueprint untuk clone AOG Teens ke cabang gereja Kelapa Gading
- Sudah include update log ke v30
- Kalau Nick mau start Kelapa Gading, baca file itu step-by-step

---

## 19. Known Limitations

### 19.1 Reminder Broadcast Tidak Persistent
- Kalau CGL offline saat Coach kirim reminder → notif hilang
- Broadcast Supabase tidak replay saat client reconnect
- **Future fix:** Bikin tabel `cgl_reminders` — insert row → realtime postgres_changes → CGL terima kapan pun online

### 19.2 Member Dipindah CG — Attendance History Ambiguous
- Attendance ke-link via `member_id` (tetap aman)
- Tapi tampilan CG lama tidak show member (karena filter by cg)
- Design decision, bukan bug — biarkan aja

### 19.3 iOS PWA Push Limitation
- Push notif iOS hanya jalan kalau install ke Home Screen + iOS 16.4+
- Ada guard + info toast kalau belum standalone

### 19.4 Concurrent Edit Race
- Coach + CGL edit dot bersamaan → last-write-wins (upsert)
- `_DOT_SAVING` mencegah race di satu device
- Cross-device race sangat rare (biasanya CGL sendiri yang edit)

### 19.5 Google Sheets Sync 1-Arah
- Supabase → Sheets (auto per menit)
- Sheets → Supabase (TIDAK ADA)
- Edit di Sheets tidak sync balik ke web app

### 19.6 PDF Export Skala Besar
- >500 member print window Safari iOS bisa lag
- Saat ini 54 member, aman

### 19.7 CDN Cache
- Font Google + Supabase JS via CDN — sekali cache tidak update
- User harus clear cache manual kalau perlu upgrade

### 19.8 No Authentication
- Anon key exposed di client JS
- Siapapun dengan URL bisa akses
- **JANGAN share URL ke publik**
- Future: PIN login untuk Coach/TL

---

## 20. Startup Checklist

Saat pertama kali kamu (Claude Code baru) bantu Nick:

### Baca (Urutan)
- [ ] `MASTER_HANDOFF.md` (file ini) — full
- [ ] `CLAUDE.md` — cross-reference untuk detail spesifik
- [ ] `HANDOFF.md` (optional) — 28 section extended
- [ ] `~/.claude/projects/C--Penyimpanan-utama-Downloads-absen-ibadahh/memory/MEMORY.md` — user profile dari session lalu

### Verify
- [ ] `git status` — pastikan clean, di branch `main`
- [ ] `git log --oneline -5` — cek commit terbaru = `3acca2f` (v31) atau lebih baru
- [ ] Buka `https://absenibadahjaktim.vercel.app` di browser — cek "v31" (atau versi lebih baru) di pojok kanan atas

### Setelah Ready, Confirm ke Nick
Kirim response singkat:
> "Sudah baca semua konteks. Project AOG Teens Jaktim di v31, tech stack single-file vanilla JS + Supabase + Vercel + Apps Script. Database 12 tabel, fetchAllAttendance wajib untuk unbounded query, service worker network-first. Ready untuk lanjut apa?"

### Cek Full-Access Setup
Kalau ada file `.env` di folder + `AUTO_ACCESS_SETUP.md` sudah di-follow oleh Nick, kamu punya **direct execution access**:
- ✅ `psql "$SUPABASE_DB_URL" -c "SQL"` — eksekusi SQL langsung
- ✅ `clasp push` — deploy Apps Script tanpa manual paste
- ✅ `clasp run FUNCTION_NAME` — trigger Apps Script function
- ✅ `vercel logs` / `vercel deploy` — Vercel control

Kalau `.env` belum ada, kamu operate di mode manual (kasih SQL ke Nick untuk paste). Baca `AUTO_ACCESS_SETUP.md` untuk detail setup.

### Yang Boleh Kamu Kerjakan
- ✅ Edit file di working directory (index.html, .gs, .json, .js, .md)
- ✅ Git commit + push (dengan message deskriptif)
- ✅ Buat commit yang bumping version
- ✅ Suggest SQL untuk Nick jalankan di Supabase
- ✅ Suggest Apps Script step-by-step

### Yang Perlu Konfirmasi Nick
- ⚠️ Struktur file besar (split, rename, delete file)
- ⚠️ Change database schema (add column, drop table)
- ⚠️ Force push atau rewrite git history
- ⚠️ Enable RLS di Supabase
- ⚠️ Delete member/data permanent

### Yang JANGAN Dilakukan
- ❌ Bikin file baru untuk fitur (extend index.html aja)
- ❌ Split index.html jadi multi-file
- ❌ Tambah build step / npm / node
- ❌ Pakai `prompt()` langsung
- ❌ Hapus `_DOT_SAVING` guard
- ❌ Skip pagination untuk attendance query
- ❌ Push tanpa bump version

---

## 🎯 Final Notes

**Kondisi saat handoff (session sebelumnya berakhir):**
- Version production: **v31** (commit `3acca2f`, Oktober 2026)
- Full audit v31: 27 bug fix (detail `V31_CHANGELOG.md`)
- Documentation lengkap (CLAUDE.md, HANDOFF.md, MASTER_HANDOFF.md, V31_CHANGELOG.md, CURRENT_DESIGN.md, KELAPA_GADING_SETUP.md)
- Fitur besar terakhir: Distribusi Wilayah (v29) + hardening (v30) + bug-fix sweep (v31)

**Sisa backlog (belum dikerjakan, sengaja di-skip di v31):**
- `confirm()`/`alert()` masih dipakai ~17 tempat — block main thread, bisa bikin WebSocket timeout. Perlu `asyncConfirm()` mirip `asyncPrompt()`
- `getCGStats` loop `ALL_DATES` semua region per member — boros, bisa filter per region
- Custom pelayanan role tidak bisa dihapus dari UI
- Data lama: kolom `sekolah` / `kelurahan` mungkin masih berisi string gabungan (`"SMA 1 · Kelas 12"`, `"Cakung, Pulogadung"`) dari bug sebelum v31 — cek via SQL sebelum cleanup, jangan auto-split
- Redesign UI (Nick sedang eksplor di Claude Design — referensi `CURRENT_DESIGN.md`)

**Nick's typical next steps yang mungkin:**
1. Fitur baru (integrations, dll)
2. Bug report dari user (setelah ibadah Minggu)
3. Rebalance CG (member reassignment)
4. Setup Kelapa Gading dari blueprint
5. Improvement PWA/notif

**Filosofi kerja dengan Nick:**
- Ship fast, iterate. Nick prefer working code > perfect code
- Test in production (small user base, gereja internal)
- Documentation as we go, jangan tumpuk di akhir
- Version bump = kontrak dengan user (verifiable)

---

**Selamat melanjutkan project. Nick adalah user yang friendly dan responsif — enjoy the collaboration!**

— Signed, Claude Opus 4.7 (previous instance) · updated v31 oleh Claude Opus (Oktober 2026)
