# v31 Changelog — 27 Bug Fixes

**Date:** Oktober 2026
**Commit:** `3acca2f`
**Files changed:** `index.html` (133 insertions, 69 deletions), `service-worker.js` (version bump)

> Nomor baris = perkiraan per commit `3acca2f`, bisa bergeser. Cari pakai nama function. Lihat diff lengkap: `git show 3acca2f`

**Catatan:** Satu fix sempat dicoba lalu di-revert sebelum commit — `addPelWeek` pakai placeholder `__init__`. Ternyata `renderPelayanan` memfilter week yang hanya berisi `__init__`, jadi minggu baru tidak muncul di pills. Behavior lama (pakai role pertama) sudah benar.

---

## Kategori A: Attendance & Data Integrity (5 fix)

### 1. handleAttendanceChange filter CUR_CG
- **Problem:** Realtime attendance dari CG lain masuk ke `ATTENDANCE` object CGL dashboard → stats inflate (Hadir/Izin/Sakit/Alpa count salah)
- **Fix:** Tambah guard `MEMBERS.some(m => m.id === r.member_id)` — hanya patch `ATTENDANCE` kalau member milik CG aktif. `ALL_ATTENDANCE` (Coach) tetap di-patch tanpa filter
- **Lines:** 628-633

### 2. Detail CG sekolah/kelas/kelurahan/kecamatan split input
- **Problem:** Sekolah+kelas digabung jadi 1 input (`"SMA 1 · Kelas 12"`), disimpan balik ke kolom `sekolah` saja → kolom `kelas` tidak terupdate, data korup
- **Fix:** Split jadi 4 input terpisah dengan `data-field` masing-masing: `sekolah`, `kelas`, `kelurahan`, `kecamatan`
- **Lines:** 1838-1839
- **Note:** Data lama di DB tidak diubah, user bisa cleanup manual

### 3. undoLastDot error destructure
- **Problem:** Supabase JS client TIDAK throw error — return `{error}`. Kode lama pakai try-catch tanpa destructure → undo bisa silent-fail, DB tidak revert tapi toast "Undo berhasil"
- **Fix:** Destructure `{error}` dari `.delete()` dan `.upsert()`, throw kalau ada error
- **Lines:** 1739-1750

### 4. undoLastDot sync ALL_ATTENDANCE
- **Problem:** Undo hanya revert `ATTENDANCE` (CGL), tidak revert `ALL_ATTENDANCE` (Coach) → Coach dashboard melihat data stale
- **Fix:** Tambah `ALL_ATTENDANCE[key]` patch di undo flow
- **Lines:** 1727-1729

### 5. Visi saveVisionField per-kolom (TOCTOU fix)
- **Problem:** `saveVisiCG` baca seluruh row → modify 1 field → write seluruh row. Kalau Coach edit visi bareng CGL edit misi, salah satu overwrite yang lain
- **Fix:** Buat `saveVisionField()` yang update per-kolom via `.update({[field]: value})`. Tidak baca dulu, langsung update 1 kolom
- **Lines:** 953-969, 2141-2153

---

## Kategori B: Error Handling (11 fix)

### 6. fetchBoundedAttendance single-query error check
- **Lines:** 3261-3266

### 7. fetchAllAttendance toast warning on mid-pagination error
- **Lines:** 3248

### 8. Event edit error check + early return
- **Problem:** Edit event selalu toast "Event diupdate" bahkan kalau Supabase gagal
- **Lines:** 2965-2975

### 9. Event delete error handling
- **Lines:** 2912-2920

### 10. enterCG parallel query error toast
- **Problem:** 3 query parallel (cg_info, members, dates) tanpa error check → dashboard kosong tanpa feedback
- **Lines:** 1356-1360

### 11. genSabtu existing dates error check
- **Problem:** Kalau query existing dates gagal, dedup logic di-skip → bisa insert tanggal duplikat
- **Lines:** 3794-3795

### 12. editPelWeek fetch + delete error check
- **Lines:** 2569, 2578

### 13. editPelWeek atomic safety
- **Problem:** Rename week (insert new → delete old) non-atomic. Kalau insert partial fail, delete tetap jalan → data hilang
- **Fix:** Track `insertOk` flag, skip delete kalau ada insert yang gagal
- **Lines:** 2574-2584

### 14. removePelAssignee delete error check
- **Lines:** 2635-2636

### 15. loadCGLDropdown error toast
- **Lines:** 1203

### 16. renderEvents legacy events error check
- **Lines:** 2786

---

## Kategori C: Security / XSS (4 fix)

### 17. PDF export escape member names/dates
- **Problem:** `buildAttendanceTable` inject `m.nama`, `m.status`, `d.label` tanpa `esc()` ke print window HTML
- **Fix:** `esc()` di semua user data di PDF: nama, status, dates, CG name, leader, lokasi, jam
- **Lines:** 3828, 3834, 3793, 3918

### 18. Coach card onclick jsEsc
- **Problem:** `enterFromCoach('TEEN 01')` — kalau CG name punya apostrof atau backslash, JS error
- **Fix:** `jsEsc(c.cg)` di onclick handler
- **Lines:** 3509

### 19. Coach visi accordion jsEsc
- **Problem:** Accordion onclick hanya escape apostrof, tidak escape backslash
- **Fix:** Ganti `cg.replace(/'/g,"\\'")` dengan `jsEsc(cg)`
- **Lines:** 4564

### 20. saveNewMember alert → toast
- **Problem:** Raw Supabase error message ditampilkan via `alert()` — expose DB schema detail + block main thread
- **Fix:** Pakai `toast()` dengan truncated message
- **Lines:** 2014, 2024

---

## Kategori D: UX Fixes (5 fix)

### 21. TEEN 25 added to CG maps
- **Problem:** TEEN 25 (CG baru di jaktim1 sejak v28) tidak ada di `CG_COLORS`, `CG_BG`, `CG_INIT` → warna sama dengan TEEN 23
- **Fix:** Tambah entry: color `#4f46e5`, bg `#eef2ff`, init `T25`
- **Lines:** 1165, 1170, 1175

### 22. Coach visi textarea duplicate onblur
- **Problem:** `<textarea onblur="save()" ... onblur="resetBorder();save()">` — HTML parser pakai yang pertama, border tidak reset
- **Fix:** Hapus `onblur` pertama, gabungkan di `onblur` kedua (yang include style reset + save)
- **Lines:** 3543, 3546

### 23. CGL milestone filter progression-aware
- **Problem:** Filter milestone CGL tampilkan semua member yang belum X, tanpa cek prereq (CGT 2 tampil walau belum CGT 1). Coach sudah benar
- **Fix:** Tambah prereq map: `{msj2:'msj1', msj3:'msj2', cgt2:'cgt1', cgt3:'cgt2', baptis_roh:'baptis_air'}`
- **Lines:** 2717-2719

### 24. Event countdown multi-day aware
- **Problem:** Multi-day event (punya `date_end`) tetap pakai `date_start` saja → event yang masih berlangsung tampil "X hari lalu"
- **Fix:** Kalau `date_start` sudah lewat tapi `date_end` masih hari ini/depan → tampil "HARI INI"
- **Lines:** 1111-1130

### 25. saveCoachEvent return check
- **Problem:** Kalau `addCGEvent` gagal (return null), form tetap re-render → input yang diketik Coach hilang
- **Fix:** `if (!result) return;` sebelum re-render
- **Lines:** 4917-4928

---

## Kategori E: Resource Leaks & Race Conditions (2 fix)

### 26. _COACH_POLL_TIMER clear on goBackCoach
- **Problem:** 60-detik polling timer tidak di-clear saat keluar Coach dashboard → terus fetch attendance di background
- **Fix:** `clearInterval(_COACH_POLL_TIMER)` di awal `goBackCoach()`
- **Lines:** 3220

### 27. Reconnect race guard
- **Problem:** Offline→online trigger `setupRealtime()` dari 2 sumber: subscribe callback (5s delay) + window `online` event (1s delay) → WebSocket channel dibuat 2x
- **Fix:** Single `_rtReconnectTimer` guard. Kalau timer sudah pending, skip. Timer clear diri sendiri sebelum jalankan `setupRealtime()`
- **Lines:** 469-491

---

## Bonus: switchRole stale flags
- `COACH_TAB_RENDERED = {}` di `switchRole()` — prevent stale cached render saat switch Coach↔TL
- **Lines:** 4952

## Bonus: Export notes error logging
- `getDetailExportData` notes fetch — tambah `console.warn` kalau query gagal
- **Lines:** 4018
