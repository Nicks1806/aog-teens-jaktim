# 🚀 START HERE — Claude Code Entry Point

> **Untuk Claude Code:** Kamu baru buka folder ini. Baca file ini dulu (~2 menit), lalu ikuti checklist di bawah. Setelah itu kamu punya konteks & akses penuh untuk melanjutkan project.

**Untuk User (Nick):** Kalau kamu pindah ke Claude Code baru, kasih prompt ini:
> "Baca START_HERE.md dan ikuti instruksinya."

---

## 📂 Project Ini Apa

**AOG Teens Jaktim** — Web app absensi + management CG (Cell Group) gereja AOG Teens Jakarta Timur. Dipakai ~54 member, 9 CGL, 2 Coach, 1 TL setiap Minggu.

**Production:** https://absenibadahjaktim.vercel.app
**Version:** v30 (per commit `19d31a6` atau lebih baru)
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
- Commit terbaru: dokumentasi + versi v30
- File-file: `index.html`, `service-worker.js`, `google-apps-script.gs`, dan file `.md` documentation

### Step 2: Baca Dokumen Konteks (URUT!)

Baca berurutan:

1. **`MASTER_HANDOFF.md`** (10 menit) — **WAJIB.** Single source of truth. 1200 baris, 20 section, semua konteks + progress chronology (section 9: Session Narrative).
2. **`AUTO_ACCESS_SETUP.md`** (2 menit) — Cek apakah full-access CLI setup sudah dilakukan user.
3. **`CLAUDE.md`** (skim, 3 menit) — Project docs core.
4. **`HANDOFF.md`** (optional reference) — Extended docs, komplementer.

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
- Version: v30
- Tech: single-file vanilla JS + Supabase + Vercel + Apps Script  
- Database: 12 tabel (attendance 1188+ rows — WAJIB fetchAllAttendance)
- Region: jaktim1 (5 CG) + jaktim2 (4 CG) + ARSIP support
- PWA: Service Worker network-first, push notif iOS-safe

🔧 Fitur terakhir:
- v29: Distribusi Wilayah (chip kecamatan + kelurahan)
- v30: Wilayah hardening (escape + reset state + count consistency)

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
- `index.html` — main app (single file, ~9000+ baris)
- `service-worker.js` — PWA SW (network-first)
- `manifest.json` — PWA manifest
- `icon.jpg` — PWA icon 2000x2000
- `google-apps-script.gs` — Google Sheets sync

### Documentation Files (Claude reference)
- **`START_HERE.md`** — file ini, entrypoint
- **`PROGRESS_LOG.md`** — chronology session
- **`MASTER_HANDOFF.md`** — single source of truth (1200 baris)
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
- Prefer version indicator visible ("v30" di pojok kanan) untuk self-verify

Detail preferences: `MASTER_HANDOFF.md` section 17.

---

**Selamat lanjut project. Selamat bertemu Nick! 🚀**

— Signed, Claude Opus (previous instances yang sudah setup semua)
