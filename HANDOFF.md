# AOG Teens Jaktim — Handoff Document untuk Claude Code Baru

Dokumen ini berisi semua yang perlu diketahui untuk melanjutkan project ini di sesi Claude Code baru. Baca urut dari atas ke bawah.

---

## 1. Project Overview

**Nama:** AOG Teens Jakarta Timur — CG Dashboard (Absensi + Management)
**Tujuan:** Single-file web app untuk tracking attendance, pelayanan, milestone, events, dan visi Cell Group (CG) untuk gereja AOG Teens Jakarta Timur.

**Pengguna aktif (bersamaan saat ibadah Minggu):**
- ~54 member
- 8+ CG Leaders (CGL)
- 2 Coach (1 per region)
- 1 Team Leader (TL) — melihat semua region

**URL Production:**
- Public: `https://absenibadahjaktim.vercel.app`
- Coach/TL: `https://absenibadahjaktim.vercel.app/?role=coach`

**Struktur Region:**
- **jaktim1:** 5 CG — TEEN 01, TEEN 06, TEEN 09, TEEN 23, TEEN 25 (baru)
- **jaktim2:** 4 CG — TEEN 07, TEEN 12, TEEN 17, TEEN 20
- **ARSIP JAKTIM 1/2:** CG khusus untuk arsip member/CGL yang tidak aktif (di-filter dari dashboard)

---

## 2. Tech Stack

- **Frontend:** Vanilla JS (**NO framework**, NO build step, NO npm/node)
- **Backend:** Supabase (PostgreSQL + Realtime WebSocket)
- **Deployment:** GitHub → Vercel auto-deploy on push to `main`
- **Sheets Sync:** Google Apps Script (trigger 1 menit dari Supabase → Google Sheets)
- **PWA:** Service Worker (network-first HTML, cache-first static), manifest.json, apple-touch-icon

## 3. File Structure

Semua file di root: `C:\Penyimpanan utama\Downloads\absen ibadahh\`

```
absen ibadahh/
├── index.html                 # SINGLE FILE — semua HTML/CSS/JS (~9000+ lines)
├── manifest.json              # PWA manifest
├── service-worker.js          # PWA SW (network-first)
├── icon.jpg                   # PWA icon 2000x2000 JPG (favicon-derived)
├── google-apps-script.gs      # Apps Script untuk Google Sheets sync
├── CLAUDE.md                  # Project docs untuk Claude Code
├── HANDOFF.md                 # (this file)
└── KELAPA_GADING_SETUP.md     # Blueprint untuk cabang Kelapa Gading
```

**PENTING:** Tetap **single file** `index.html`. JANGAN split. JANGAN tambah build step.

---

## 4. Repository & Access

**GitHub:**
- Repo: `https://github.com/Nicks1806/aog-teens-jaktim`
- Branch: `main`
- Auto-deploy: Vercel (connected to `main`)
- Git user: `Nicks1806`

**Vercel:**
- Publish directory: `.` (root, no build)
- No build command
- Auto-deploy on push

**Supabase:**
- URL: `https://gqppviugodokncxezdwd.supabase.co`
- Anon key: di `index.html` (dan `google-apps-script.gs`) — acceptable karena app internal gereja
- RLS: **DISABLED** di semua tabel (jangan enable tanpa diskusi)
- Realtime: ENABLED untuk semua tabel (via `ALTER PUBLICATION supabase_realtime ADD TABLE ...`)

**Google Sheets:**
- Sheet names: `JAKTIM 1`, `JAKTIM 2`, `DETAIL JAKTIM 1 ` (trailing space!), `DETAIL JAKTIM 2 ` (trailing space!)
- Apps Script trigger: `runAutoSync` setiap 1 menit
- Manual entry point: `fullRebuild`, `fullRebuildJaktim1`, `fullRebuildJaktim2`

---

## 5. Database Schema (Supabase)

11 tabel di schema `public`:

| Tabel | Kolom Kunci | Fungsi |
|-------|------------|--------|
| `members` | id, nama, cg, status, region, wa, lahir, sekolah, kelas, kelurahan, kecamatan, msj1-3, cgt1-3, baptis_air, baptis_roh | Data member (nama, milestone, alamat, dll) |
| `attendance` | member_id, date_id, status | Data absensi per member per tanggal (H/I/S/A) |
| `dates` | id, label, region, sort_order, month_code | Daftar tanggal ibadah per region |
| `cg_info` | cg, leader, hari_jam, lokasi | Info CG (CGL, jadwal, lokasi) |
| `events` | id, name, date_start, date_end, cat, note, image | Event shared (legacy, sedang phased out) |
| `cg_events` | id, cg, region, is_shared, name, date_start, date_end, cat, note, image | Event per CG / region / global (3-level scope) |
| `cg_vision` | id, cg, region, visi, misi | Visi & misi per CG + Coach region |
| `cg_dev_plans` | id, cg, region, member_name, current_status, target_status, deadline | Rencana pengembangan member (CGL Visi tab) |
| `cg_pelayanan` | cg, region, month, week_date, role_name, member_name | Jadwal pelayanan per minggu |
| `cg_custom_roles` | cg, region, role_name, abbr, color, bg | Role pelayanan custom per CG |
| `member_notes` | member_id, cgl_note | Catatan CGL per member |
| `coach_notes` | cg, region, note | Catatan Coach per CG |

**Key patterns:**
- Attendance status: `H` (Hadir), `I` (Izin), `S` (Sakit), `A` (Alpa), atau kosong (belum diinput)
- Member status/role: `CGL`, `Sponsor`, `Member`, `Simpatisan`, `VIP`, `Alumni` (arsip)
- Region: `jaktim1`, `jaktim2`
- CG naming: `TEEN 01`, `TEEN 06`, dst — atau `ARSIP JAKTIM 1/2` untuk arsip

**Constraint penting:**
- `cg_pelayanan`: unique `(cg, week_date, role_name)`
- `cg_vision`: unique `(cg, region)`

**Storage khusus:**
- Visi Coach per region disimpan di `cg_vision` dengan `cg = '__COACH_jaktim1__'` / `'__COACH_jaktim2__'`

---

## 6. Arsitektur App (3 Halaman)

### Halaman 1: Landing (`pageL`)
- Toggle region JAKTIM 1 / JAKTIM 2
- Custom dropdown CG Leader (avatar + panel, bukan native select)
- Tombol "Masuk Dashboard"
- Link "Coach / TL? Masuk disini →" (`?role=coach`)

### Halaman 2: CGL Dashboard (`pageD`)
6 tab:
1. **Absensi** — tabel H/I/S/A per member per tanggal + line chart progress + export CSV/PDF
2. **Detail CG** — per-member card (nama, WA, sekolah, milestone chips, catatan CGL) + export CSV/PDF
3. **Visi CG** — visi + misi (click-to-edit list) + Rencana Pengembangan Member (dev plan dengan deadline)
4. **Pelayanan** — jadwal pelayanan per minggu, multi-assignee support, statistik rekap
5. **Milestone** — donut SVG per milestone + progress bar per member
6. **Events** — CRUD event per CG dengan countdown + WA broadcast

### Halaman 3: Coach/TL Dashboard (`pageC`)
5 tab:
1. **Overview** — stats cards + Visi Coach editable + CG cards grid + Export Detail CSV/PDF
2. **Absensi** — per-CG cards dengan tabel absensi (clickable dot untuk edit) + line chart + Pending CGL list + Generate Sabtu button + Absensi CSV/PDF
3. **Milestone** — filter chips + donut + per-CG breakdown
4. **Visi** — accordion per CG (expand-collapse) dengan Visi, Misi, Dev Plan, Catatan Coach
5. **Events** — filter chips + CRUD dengan target dropdown (Global / Region / Per-CG)

**Coach mode toggle:**
- `COACH` mode: lihat 1 region saja (jaktim1 / jaktim2)
- `TL` mode: lihat semua region gabungan

---

## 7. Fitur Utama & Implementasi

### 7.1 Absensi (cycleDot)
- Klik dot → cycle: kosong → H → I → S → A → kosong
- Optimistic UI + auto-save ke Supabase
- Auto-revert kalau save gagal + toast error
- `_DOT_SAVING` guard mencegah double-tap race
- Undo tersedia 3.5 detik setelah tap
- Realtime sync — perubahan CGL langsung muncul di Coach & CGL lain
- Coach juga bisa klik dot (via `cycleDotCoach` — update `ALL_ATTENDANCE`)

### 7.2 Line Chart Progress Kehadiran
- SVG pure (tanpa library)
- **Denominator akurat**: hanya count member yang sudah "aktif" pada tanggal itu (deteksi via `memberJoinIdx` — record attendance paling awal)
- Member baru tidak pull down persentase historis
- TL mode: merge tanggal duplikat dari 2 region by label

### 7.3 Realtime Sync (Supabase WebSocket)
- Single channel `app-sync`
- Subscribe ke: attendance, members, cg_pelayanan, events, cg_events, cg_vision
- Attendance: patch DOM per-dot instant via `data-mid`/`data-did` attributes
- Members/Pelayanan/Events/Visi: debounced re-render (500-600ms)
- Live indicator: 🟢 Live / 🔴 Offline

### 7.4 Coach Sync Layers (Triple Redundancy)
1. **Realtime** — instant patch via WebSocket
2. **Polling 60s** — silent refetch attendance + dates every 60 sec
3. **Tab-switch refetch** — otomatis fetch fresh saat pindah tab Absensi/Overview
4. **Visibility focus** — refetch saat window kembali aktif
5. **Manual Refresh** — tombol biru 🔄 di Coach Absensi tab

### 7.5 Attendance Pagination (`fetchAllAttendance`)
Supabase REST API punya server-side `max_rows` cap default 1000. `.limit(100000)` di client tidak override cap ini.

**Fix:** Loop `.range(from, from+999)` dengan `.order('member_id').order('date_id')` sampai habis. Max 50 pages = 50k row.

**Bounded fetch:** `fetchBoundedAttendance(memberIds, dateIds)` — auto-paginate kalau total kombinasi > 800.

### 7.6 PWA
- Manifest: icon `/icon.jpg` (2000x2000 JPG, `sizes="any"`)
- Service Worker v28+: **network-first** untuk HTML (bukan stale-while-revalidate), cache-first untuk static
- Push notifikasi: `pushNotif()` skip kalau tab visible OR SW controller belum aktif (iOS guard)
- Bell button 🔔 di header untuk toggle permission
- Version indicator "v28" di header supaya user bisa verify update

### 7.7 Export
**Absensi CSV/PDF:**
- CGL: 1 CG saja (`exportCGAttendanceCSV`, `exportCGAttendancePDF`)
- Coach/TL: per region atau all (`exportRegionAttendanceCSV`, `exportRegionAttendancePDF`)

**Detail CSV/PDF:**
- CGL: 1 CG (`exportDetailCSV('cgl')`, `exportDetailPDF('cgl')`)
- Coach: per region (`exportDetailCSV('jaktim1'/'jaktim2')`)
- TL: all (`exportDetailCSV('all')`)
- Kolom: CG, No, Nama, Status, Lahir, No HP, Sekolah, Kelas, Kelurahan, Kecamatan, MSJ 1-3, CGT 1-3, B.Air, B.Roh, Catatan CGL

### 7.8 Pending CGL Reminder
- List CG yang belum input absensi 4 tanggal ibadah terakhir
- Auto-broadcast reminder via Realtime broadcast channel (rate-limited 2 jam per CG)
- Tombol manual "🔔 Ingatkan" per CG + "Ingatkan Semua"
- CGL online terima push notif "Coach mengingatkan..."

### 7.9 Arsip Support
- CG dengan nama diawali `ARSIP` (case-insensitive) → di-filter dari landing dropdown, Coach dashboard, semua display aktif
- Data attendance, detail, milestone TETAP di DB — tinggal ganti `cg` value untuk restore
- Di Google Sheets, ARSIP CG muncul sebagai grup terpisah setelah fullRebuild

### 7.10 Google Sheets Sync (Apps Script)
- `runAutoSync()` — trigger 1 menit, incremental update
- `fullRebuild()` — clear & write ulang semua sheet (manual)
- `fullRebuildJaktim1()` / `fullRebuildJaktim2()` — 1 region saja
- `fetchAllAttendance()` di script — HTTP Range header pagination (bypass 1000 cap)
- `normDate()` handle Date object dengan `Utilities.formatDate(s, 'Asia/Jakarta', 'd-M')`
- `dedupDateColumns()` auto-remove kolom tanggal duplikat
- In-place per-CG insert untuk member baru (bukan append di bawah)

---

## 8. Key Global JS Variables

**CGL scope:**
- `CUR_CG` — nama CG aktif (e.g. "TEEN 01")
- `CUR_REGION` — region aktif
- `CUR_CG_INFO` — object info CG
- `MEMBERS` — array member CG aktif
- `DATES` — array tanggal ibadah region aktif
- `ATTENDANCE` — object `{ "memberId_dateId": "H"/"I"/"S"/"A" }`

**Coach/TL scope:**
- `ALL_MEMBERS` — semua member dari semua region
- `ALL_CG_INFO` — semua CG info
- `ALL_DATES` — semua tanggal dari semua region
- `ALL_ATTENDANCE` — semua attendance record
- `ALL_EVENTS` — semua shared events
- `coachRole` — "coach" / "tl"
- `coachReg` — region aktif Coach

**Helpers:**
- `_DOT_SAVING` — guard object supaya tidak race saat cycle dot
- `_VISI_EXPANDED` — Set track accordion state Coach Visi (preserve across re-renders)
- `_OWN_EVENT_IDS` — Set track event yg dibuat di session ini (suppress own notif)
- `_NOTIF_DEDUPE` — Set dedupe notification tags
- `_COACH_POLL_TIMER` — setInterval handle untuk polling 60s
- `TAB_RENDERED` — flag per tab CGL untuk lazy render
- `COACH_TAB_RENDERED` — flag per tab Coach

---

## 9. Deploy Workflow

```
Edit index.html (atau file lain) locally
  ↓
git add <file>
git commit -m "descriptive message"
git push
  ↓
Vercel auto-deploy dalam ~10-30 detik
  ↓
User hard refresh (Ctrl+Shift+R) atau tunggu SW network-first fetch
```

**Version bump pattern setiap push:**
1. Edit `index.html` — cari `App version">v28` → naikkan (v29, v30, dst)
2. Edit `service-worker.js` — cari `CACHE_NAME = 'aog-absensi-v28'` → naikkan sama
3. Commit + push

Ini supaya user bisa verify versi terbaru sudah aktif di browser.

---

## 10. RULES WAJIB (dari CLAUDE.md)

### Struktur File
- JANGAN split ke multiple file — tetap single `index.html`
- JANGAN tambah build step — Vercel publish dir `.` (root), no build command
- JANGAN pakai npm/node — pure vanilla JS
- JANGAN buat file README.md atau dokumentasi kecuali diminta

### Code Safety
- JANGAN pakai `prompt()` — block main thread, disconnect realtime. Pakai `asyncPrompt()` yang sudah ada
- JANGAN hapus `_DOT_SAVING` guard di `cycleDot` — mencegah double-tap + realtime race
- JANGAN ubah `esc()` function — sudah escape &, <, >, ", ' (penting untuk XSS prevention)
- JANGAN hapus `data-mid`/`data-did` attributes di dot elements — dipakai realtime handler
- JANGAN ganti `loadCGLDropdown` ke `select('id,nama,...')` — HARUS `select('*')` karena `ALL_MEMBERS` dipakai Coach dashboard
- SELALU cek error di setiap Supabase operation dan tampilkan via `toast()`
- SELALU pakai `roleCls()` / `roleLabel()` helper untuk role class (whitelist + strip legacy "Target:" prefix)

### Supabase
- RLS DISABLED di semua tabel — jangan enable tanpa diskusi
- Realtime sudah setup — jangan hapus tabel dari publication
- Semua fetch attendance yang unbounded → wajib pakai `fetchAllAttendance()`
- Bounded fetch dengan `.in()` → wajib pakai `fetchBoundedAttendance()` kalau berpotensi >800 row

### Google Apps Script
- Sheet names: `JAKTIM 1`, `JAKTIM 2`, `DETAIL JAKTIM 1 ` (trailing space), `DETAIL JAKTIM 2 ` (trailing space)
- `REGION_CONFIG.dateStartCol`: jaktim1=5, jaktim2=4
- Milestone di sheet pakai string `'TRUE'`/`'FALSE'` (bukan boolean)
- Timezone Asia/Jakarta explicit di `normDate` untuk Date object

---

## 11. Recent Session History (versi v22-v28)

### v22 — Pagination fix (kritis)
Bug: Coach tidak sync data terbaru CGL karena Supabase max_rows cap 1000. Fix: `fetchAllAttendance()` dengan `.range()` loop.

### v23 — Export Detail CG
Tambah tombol Export CSV + PDF untuk detail member di CGL & Coach.

### v24 — Label tombol export
Rename tombol jadi "Absensi CSV"/"Detail CSV" supaya user tidak bingung.

### v25 — Line chart akurat (join-date detection)
Member baru tidak pull down persentase historis. Denominator = member yang sudah aktif per tanggal.

### v26 — TL chart merge dates
Fix duplikat tanggal di TL chart (merge by label + sort_order).

### v27 — Pagination order stability + Apps Script pagination + TL sort
- `.order()` di `fetchAllAttendance` untuk konsistensi antar page
- `fetchBoundedAttendance` helper untuk CGL queries
- Apps Script HTTP Range header pagination
- TL merged dates pakai min sort_order + fallback parse label

### v28 — Archive CG support
CG dengan nama diawali `ARSIP` di-filter dari display aktif. Member historis tetap aman di DB.

---

## 12. SQL Patterns (Sering Dipakai)

### 12.1 Reassign Member ke CG Baru
```sql
BEGIN;
UPDATE members SET cg = 'TEEN 01' 
WHERE region = 'jaktim1' AND nama IN ('Nama 1', 'Nama 2');
COMMIT;
```

### 12.2 Ganti CGL
```sql
BEGIN;
-- Set CGL baru
UPDATE members SET status = 'CGL' WHERE nama = 'Nama Baru' AND cg = 'TEEN X';
-- Demote CGL lama (opsional)
UPDATE members SET status = 'Member' WHERE nama = 'Nama Lama' AND cg = 'TEEN X';
-- Update cg_info leader
UPDATE cg_info SET leader = 'Nama Baru' WHERE cg = 'TEEN X';
COMMIT;
```

### 12.3 Arsipkan Member (Soft Delete)
```sql
BEGIN;
UPDATE members 
SET cg = 'ARSIP JAKTIM 1', status = 'Alumni'
WHERE nama = 'Nama' AND region = 'jaktim1';
COMMIT;
```

### 12.4 Buat CG Baru
```sql
INSERT INTO cg_info (cg, leader, hari_jam, lokasi)
VALUES ('TEEN 25', 'Nama CGL', '', '')
ON CONFLICT (cg) DO UPDATE SET leader = 'Nama CGL';

UPDATE members SET cg = 'TEEN 25', status = 'CGL' 
WHERE nama = 'Nama CGL' AND region = 'jaktim1';
```

### 12.5 Cek Duplicate / Verifikasi
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

### 12.6 Rename CG
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

---

## 13. Known Limitations & Not-Yet-Fixed

### 13.1 Reminder Broadcast Not Persistent
Kalau CGL offline saat Coach kirim reminder → notif hilang. Broadcast Supabase tidak replay saat client reconnect.

**Fix future:** Bikin tabel `cgl_reminders` — Coach insert row → realtime postgres_changes → CGL terima walau baru online belakangan.

### 13.2 Member Dipindah CG
Attendance historis tetap ter-link via `member_id`, tapi tampilan CG lama tidak menampilkan member itu. Ini desain ambiguous, bukan bug.

### 13.3 Concurrent Edit Race
Coach + CGL edit dot bersamaan → last-write-wins (Supabase upsert). `_DOT_SAVING` mencegah race satu device.

### 13.4 iOS PWA Push Limitation
Push notif iOS hanya jalan kalau PWA di-install ke Home Screen (iOS 16.4+). Sudah ada guard + pesan info.

### 13.5 Cache CDN
Font Inter/Instrument Serif dari Google Fonts dan Supabase JS dari CDN — sekali cache, tidak update kecuali user clear cache manual. Acceptable.

### 13.6 PDF Export Skala Besar
Kalau member >500, print window Safari iOS bisa lag. Saat ini ~54 member, aman.

---

## 14. Cara Kerja dengan Codebase Ini

### Saat User Report Bug
1. **Ask** — screenshot / detail lokasi + steps to reproduce
2. **Locate** — Grep untuk function name atau string relevan
3. **Read** — pakai `Read` dengan offset/limit karena `index.html` > 25k tokens
4. **Fix** — Edit function target dengan awareness terhadap side effects
5. **Bump version** — di `index.html` + `service-worker.js`
6. **Commit + push** dengan message deskriptif
7. **Verify** — user hard refresh, cek "vXX" indicator

### Saat User Request Feature
1. Sketch approach ke user dulu — 2-3 kalimat max
2. Implement dengan minimal disruption ke existing patterns
3. Test dengan scenario yang user sebutin
4. Push + version bump

### Umum
- User berbahasa Indonesia campuran — response dalam Indonesian
- User awam SQL/DB — kasih SQL siap-copy-paste, bukan explanation panjang
- User awam git/deploy — kasih step-by-step, jangan asumsi

### Yang JANGAN Dilakukan
- Jangan pakai `Bash grep` — pakai `Grep` tool (permission-aware)
- Jangan pakai `cat`, `head`, `tail` — pakai `Read` tool
- Jangan pakai `sed`, `awk` — pakai `Edit` tool
- Jangan buat file baru untuk fitur baru — extend `index.html`
- Jangan enable RLS di Supabase tanpa diskusi user

---

## 15. Common Gotchas

### 15.1 Line Endings
Windows CRLF vs Unix LF. Git akan warn "LF will be replaced by CRLF" saat commit. Aman.

### 15.2 Trailing Space di Sheet Name
`DETAIL JAKTIM 1 ` (dengan trailing space) dan `DETAIL JAKTIM 2 ` (dengan trailing space). Ini di-hardcode di `REGION_CONFIG` Apps Script. Jangan hapus space.

### 15.3 Region Filter di Query
Semua fetch harus filter by `region` (kecuali TL). Salah region = data kosong / campur.

### 15.4 Emoji di HTML String
Beberapa emoji di source code disimpan sebagai `\uXXXX` escape (bukan literal char). Kalau Edit tool gagal match, coba dengan escape form.

### 15.5 Chain Order Supabase JS
`.select()` → `.eq()/.in()/.gt()` (filter) → `.order()/.limit()/.range()` (transform) → await. `.range()` setelah `.in()` bisa problematic — pakai `.limit()` atau pindah `.range()` ke akhir.

### 15.6 Sort_order Beda Antar Region
`jaktim1` dan `jaktim2` punya `sort_order` sequence independen. Untuk TL merged dates, ambil min sort_order + fallback parse label.

### 15.7 Cache Version Bump
Setiap kali ada perubahan ke `index.html`, WAJIB bump `CACHE_NAME` di `service-worker.js`. Kalau tidak, PWA lama tidak akan ambil versi baru.

### 15.8 Supabase max_rows Cap 1000
JANGAN pakai `.limit(100000)` untuk bypass. Server akan tetap cap ke 1000. Pakai pagination via `fetchAllAttendance()` / `fetchBoundedAttendance()`.

---

## 16. Testing Checklist Sebelum Push ke Production

Untuk perubahan yang affect data / UI:

- [ ] Version bumped di 2 tempat (index.html + service-worker.js)
- [ ] Commit message deskriptif dengan alasan
- [ ] Test di CGL view (klik dot, save nama, tambah dev plan)
- [ ] Test di Coach view (semua tab)
- [ ] Test di TL mode kalau relevan
- [ ] Test di mobile (viewport < 600px)
- [ ] Cek console error di DevTools

---

## 17. Emergency Rollback

Kalau push v29 broken parah:

```bash
cd "C:/Penyimpanan utama/Downloads/absen ibadahh"
git log --oneline -5     # cari commit hash v28 stabil
git revert HEAD          # atau: git reset --hard <commit>
git push
```

Vercel akan re-deploy versi lama.

---

## 18. Contact & References

- **User:** Nickclauss Yohanes San (nickcllauss.yohanes@orovagroup.id)
- **Role di gereja:** Coach jaktim1
- **Preferensi:**
  - Bahasa Indonesia (santai, tidak formal)
  - Response singkat + step-by-step yang bisa langsung eksekusi
  - Kasih SQL/kode langsung, bukan explanation panjang
  - User awam DB & git — jelaskan seperlunya

**Related project:**
- TWS project (`C:\Penyimpanan utama\Downloads\files (8)`) — Trade With Suli internal CRM, project terpisah
- KELAPA_GADING_SETUP.md — blueprint untuk cabang Kelapa Gading (belum di-deploy)

---

## 19. Startup Checklist untuk Claude Code Baru

Saat pertama kali bantu user:

1. **Baca `CLAUDE.md`** — project docs core
2. **Baca `HANDOFF.md`** (file ini) — konteks lengkap
3. **Baca memory di `~/.claude/projects/.../memory/MEMORY.md`** — user preferences
4. **Check git status + recent commits:**
   ```bash
   git log --oneline -10
   git status
   ```
5. **Verify Vercel deployment:** `https://absenibadahjaktim.vercel.app`
6. **Verify version terbaru:** cek "vXX" di pojok kanan atas app

---

Selamat melanjutkan project! Semua konteks + tools + best practices ada di file ini.
