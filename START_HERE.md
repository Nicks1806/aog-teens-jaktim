# 🚀 START HERE — Claude Code Entry Point

> ## 🆕 Update v32 → v37 (27 Oktober 2026)
> Sumber paling akurat & lengkap: **CLAUDE.md** (versi, aturan, riwayat). Bagian lain dokumen ini sebagian masih menggambarkan v30/v31.
>
> - **Versi aktif: v37** (production = branch `main`; `redesign` = preview, selalu fast-forward ke `main`). Bump versi: `App version">v37` (2 tempat di `index.html`) + `CACHE_NAME = 'aog-absensi-v37'`.
> - **URL:** CGL `https://absenibadahjaktim.vercel.app/teen-01` (dst, refresh tetap di dashboard CG), Coach `/coach`, TL `/tl` — rewrite di `vercel.json`. `?role=coach` lama tetap jalan. Landing **tidak** punya link Coach/TL lagi.
> - **v32** Redesign UI: sidebar + bottom nav; tema/warna/font tetap v31 (Instrument Serif + Inter); landing persis v31; ikon SVG pengganti emoji.
> - **v33** HP mode rapat (≤600px); tab Detail = kartu anak + chart garis tren, klik → modal detail anak; pindah tab crossfade (`smoothSwap`); toggle Coach/TL slider; tema tahun bisa diedit Coach/TL (`cg_vision` cg=`__THEME__`); pengingat ke CGL hanya manual (auto-broadcast dimatikan); Distribusi wilayah rapi.
> - **v34** Tabel absensi desktop lebih lega; banner "Versi baru tersedia · Muat ulang".
> - **v35** Pengaman transisi tab tanpa error console; cek versi tanpa membengkakkan cache SW.
> - **v36** Ringkasan CG di tab Detail (rata-rata hadir + tren, follow-up, milestone, data belum lengkap).
> - **v37** Absensi tersimpan di HP saat sinyal jelek (`saveAttendance` + antrean `aog_att_queue_v1`); **Arsipkan** + Hapus member; **Pindah CG** untuk Coach/TL (termasuk mengembalikan dari arsip lewat pencarian member); pemilih tanggal lahir; saran kecamatan/kelurahan.
> - **Data dibersihkan 27 Okt 2026:** 21 member kolom sekolah (teks "· Kelas X" bug pra-v31), 6 member kolom kelurahan. Cadangan: `C:\Penyimpanan utama\Downloads\backup_*_2026-10-27*.json`.
> - **Belum ada:** PIN untuk Coach/TL (alamat `/coach` & `/tl` mudah ditebak).


> **Untuk Claude Code:** Kamu baru buka folder ini. Baca file ini dulu (~2 menit), lalu ikuti checklist di bawah. Setelah itu kamu punya konteks & akses penuh untuk melanjutkan project.

**Untuk User (Nick):** Kalau kamu pindah ke Claude Code baru, kasih prompt ini:
> "Baca START_HERE.md dan ikuti instruksinya."

---

## 📂 Project Ini Apa

**AOG Teens Jaktim** — Web app absensi + management CG (Cell Group) gereja AOG Teens Jakarta Timur. Dipakai ~54 member, 9 CGL, 2 Coach, 1 TL setiap Minggu.

**Production:** https://absenibadahjaktim.vercel.app
**Version:** v31 (per commit `3acca2f` atau lebih baru)
**Repo:** https://github.com/Nicks1806/aog-teens-jaktim

---

## ⚡ Instruksi untuk Claude Code Baru

### Step 1: Verify Environment (30 detik)
```bash
cd "C:/Penyimpanan utama/Downloads/absen ibadahh"
git status
git log --oneline -5
ls -la
```

Yang harus kamu lihat:
- Branch `main`, clean working tree
- Commit terbaru: dokumentasi v31 (atau lebih baru)
- File-file: `index.html`, `service-worker.js`, `google-apps-script.gs`, dan file `.md` documentation

### Step 2: Baca Dokumen Konteks (URUT!)

Baca berurutan:

1. **`MASTER_HANDOFF.md`** (10 menit) — **WAJIB.** Single source of truth. 1200 baris, 20 section, semua konteks + progress chronology (section 9: Session Narrative).
2. **`V31_CHANGELOG.md`** (3 menit) — **WAJIB.** 27 bug fix terakhir (Oktober 2026) — apa yang diubah & kenapa.
3. **`AUTO_ACCESS_SETUP.md`** (2 menit) — Cek apakah full-access CLI setup sudah dilakukan user.
4. **`CLAUDE.md`** (skim, 3 menit) — Project docs core.
5. **`HANDOFF.md`** (optional reference) — Extended docs, komplementer.
6. **`CURRENT_DESIGN.md`** (optional) — UI/UX reference kalau ada kerjaan desain.

### Step 3: Cek Full-Access Status

```bash
ls -la .env 2>/dev/null && echo "✅ Full-access setup" || echo "⚠️ Manual mode (no .env)"
which psql && echo "✅ psql installed"
which clasp && echo "✅ clasp installed"
which vercel && echo "✅ vercel installed"
```

**Kalau semua ✅** → kamu punya full-access:
- Execute SQL Supabase langsung: `psql "$SUPABASE_DB_URL" -c "SQL"`
- Deploy Apps Script: `clasp push`
- Trigger function: `clasp run FUNCTION_NAME`

**Kalau ada ⚠️** → operate di manual mode (kasih SQL ke user untuk paste). Suggest ke user follow `AUTO_ACCESS_SETUP.md`.

### Step 4: Confirm ke User

Kirim response singkat:

```
Sudah baca semua konteks project AOG Teens Jaktim.

📊 State saat ini:
- Version: v31
- Tech: single-file vanilla JS + Supabase + Vercel + Apps Script  
- Database: 12 tabel (attendance 1188+ rows — WAJIB fetchAllAttendance)
- Region: jaktim1 (5 CG) + jaktim2 (4 CG) + ARSIP support
- PWA: Service Worker network-first, push notif iOS-safe

🔧 Update terakhir:
- v29: Distribusi Wilayah (chip kecamatan + kelurahan)
- v30: Wilayah hardening (escape + reset state + count consistency)
- v31: 27 bug fix (stats inflate, sekolah/kelas split, XSS PDF, error handling, TEEN 25 color, dll)

🔑 Akses saya:
- ✅ Edit semua file di folder
- ✅ Git commit + push (auto-deploy Vercel)
- [✅/⚠️] Direct SQL execution (psql via .env)
- [✅/⚠️] Apps Script deploy (clasp)

Ready untuk lanjut. Apa yang mau dikerjakan?
```

Ganti `[✅/⚠️]` sesuai hasil Step 3.

---

## 📚 File Map (What's Where)

### Code Files (jangan edit tanpa konteks)
- `index.html` — main app (single file, ~5000+ baris)
- `service-worker.js` — PWA SW (network-first)
- `manifest.json` — PWA manifest
- `icon.jpg` — PWA icon 2000x2000
- `google-apps-script.gs` — Google Sheets sync

### Documentation Files (Claude reference)
- **`START_HERE.md`** — file ini, entrypoint
- **`PROMPT_CLAUDE_CODE.md`** — prompt siap-copy untuk buka Claude Code baru
- **`MASTER_HANDOFF.md`** — single source of truth (1200 baris)
- **`V31_CHANGELOG.md`** — detail 27 bug fix v31
- **`CURRENT_DESIGN.md`** — UI/UX design reference (CSS tokens, komponen)
- **`SQL_COOKBOOK.md`** — kumpulan SQL siap pakai
- **`AUTO_ACCESS_SETUP.md`** — setup CLI tools untuk full-access
- **`CLAUDE.md`** — project docs core (concise version)
- **`HANDOFF.md`** — extended docs (28 section, complementary to MASTER)
- **`KELAPA_GADING_SETUP.md`** — blueprint untuk clone project ke cabang lain

### Local Config (gitignored)
- `.env` — credentials (Supabase service key, DB URL)
- `.clasp.json` — link ke Google Apps Script
- `.clasprc.json` — Google OAuth token

---

## 🎯 Rules Kritis (JANGAN dilanggar)

1. **JANGAN split** `index.html` ke multiple file
2. **JANGAN pakai** `prompt()` — pakai `asyncPrompt()`
3. **JANGAN hapus** `_DOT_SAVING` guard di cycleDot
4. **SELALU pakai** `fetchAllAttendance()` / `fetchBoundedAttendance()` untuk attendance query — bukan `.limit()`
5. **SELALU bump** version di 2 tempat (`index.html` + `service-worker.js`) setiap push UI change
6. **SELALU cek** error dari Supabase operations + toast ke user

Detail rules ada di `MASTER_HANDOFF.md` section 12 (Code Patterns).

---

## 🆘 Kalau Butuh Bantuan

- Bingung fitur → `MASTER_HANDOFF.md` section 7 (Fitur Detail Per Halaman)
- Bug user report → `MASTER_HANDOFF.md` section 14 (Common Bugs & Fix)
- SQL pattern → `MASTER_HANDOFF.md` section 11 (SQL Recipe)
- Debug console → `MASTER_HANDOFF.md` section 13 (Debug Toolkit)

---

## 👤 User Profile (Nick)

- Coach jaktim1, admin gereja AOG Teens
- Awam DB & git, awam JavaScript
- Prefer bahasa Indonesia santai
- Prefer response singkat + bullet points + SQL siap-copy
- Prefer ship fast (working > perfect)
- Prefer version indicator visible ("vXX" di pojok kanan) untuk self-verify
- Sangat peduli keamanan data: "jangan sampai ada data yang hilang atau rusak" — selalu verifikasi sebelum push

Detail preferences: `MASTER_HANDOFF.md` section 17.

---

**Selamat lanjut project. Selamat bertemu Nick! 🚀**

— Signed, Claude Opus (previous instances yang sudah setup semua)
