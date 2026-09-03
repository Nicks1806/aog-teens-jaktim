# Auto-Access Setup — Full Automation untuk Claude Code

> **Tujuan:** One-time setup supaya Claude Code baru bisa execute SQL Supabase, deploy Apps Script, dan kontrol Vercel tanpa perlu manual copy-paste dari user.

**Waktu setup:** ~15-20 menit total (sekali seumur hidup).

**Setelahnya:** Claude Code auto-execute semua operasi tanpa perlu intervention.

---

## 🎯 Yang Akan Dapat Diotomasi

| Sebelum (manual) | Sesudah (otomatis) |
|-----------------|---------------------|
| Copy SQL → paste Supabase → Run | Claude eksekusi langsung via CLI |
| Copy `.gs` → paste Apps Script → Save → Run | Claude `clasp push` langsung |
| Cek Vercel deploy manual | Claude `vercel logs` langsung |

---

## 🔐 Security First

Sebelum mulai, penting:
- Semua credentials disimpan di **file lokal `.env`** (gitignored)
- **JANGAN commit `.env` ke GitHub**
- Kalau HP/laptop di-share, hapus `.env` dulu

Cek `.gitignore` (buat kalau belum ada):
```
.env
.env.local
.pgpass
.clasprc.json
node_modules/
```

---

## 1. Supabase Direct SQL Execution

### 1.1 Ambil Service Role Key
1. Buka Supabase Dashboard → Project `gqppviugodokncxezdwd`
2. **Settings → API**
3. Scroll ke section **Project API keys**
4. Copy nilai **`service_role`** (bukan `anon` — service_role punya akses admin)
5. **JANGAN share key ini ke siapapun** — punya akses full DB

### 1.2 Ambil Connection String (untuk psql direct)
1. **Settings → Database**
2. Scroll ke **Connection string** → pilih tab **URI**
3. Copy string, formatnya: `postgresql://postgres:[PASSWORD]@db.gqppviugodokncxezdwd.supabase.co:5432/postgres`
4. Ganti `[PASSWORD]` dengan password database (dari Settings → Database → Reset password kalau lupa)

### 1.3 Buat File `.env` di Project Root
```bash
# C:\Penyimpanan utama\Downloads\absen ibadahh\.env

SUPABASE_URL=https://gqppviugodokncxezdwd.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...  # yang sudah ada di index.html (public OK)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # dari step 1.1 (RAHASIA)
SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.gqppviugodokncxezdwd.supabase.co:5432/postgres  # dari step 1.2
```

### 1.4 Install `psql` (kalau belum ada)
Windows via installer PostgreSQL: https://www.postgresql.org/download/windows/
Pilih hanya **Command Line Tools** saat install (tidak perlu full PostgreSQL server).

Verifikasi: `psql --version`

### 1.5 Test Connection
```bash
psql "postgresql://postgres:PASSWORD@db.gqppviugodokncxezdwd.supabase.co:5432/postgres" -c "SELECT count(*) FROM members;"
```

Kalau muncul angka → sukses.

---

## 2. Google Apps Script — `clasp` CLI

### 2.1 Install Node.js (kalau belum ada)
Download dari https://nodejs.org/ — pilih LTS version.

Verifikasi: `node --version` dan `npm --version`

### 2.2 Install clasp Global
```bash
npm install -g @google/clasp
```

### 2.3 Enable Apps Script API
1. Buka https://script.google.com/home/usersettings
2. Toggle **Google Apps Script API** → ON

### 2.4 Login clasp
```bash
clasp login
```
Browser akan buka → login pakai Google account yang punya akses ke Sheets → grant permission.

Token tersimpan di `~/.clasprc.json` (jangan commit).

### 2.5 Link Existing Apps Script
1. Buka Google Sheets kamu → **Extensions → Apps Script**
2. Di editor, klik ⚙️ **Project Settings** → copy **Script ID**
3. Di terminal, di folder project:
   ```bash
   cd "C:\Penyimpanan utama\Downloads\absen ibadahh"
   clasp clone SCRIPT_ID_HERE
   ```
4. Ini akan buat file `.clasp.json` (link ke script) dan download source ke folder

### 2.6 Kalau `.gs` File Sudah Ada di Folder
File `google-apps-script.gs` sudah ada. `clasp clone` akan mungkin conflict. Solusi:
```bash
# Backup file existing
cp google-apps-script.gs google-apps-script.gs.backup
# Clone
clasp clone SCRIPT_ID_HERE
# Verify content sama dengan backup, kalau beda merge manual
diff google-apps-script.gs google-apps-script.gs.backup
```

### 2.7 Test Push
Edit sedikit di `.gs` file → jalankan:
```bash
clasp push
```

Buka Apps Script editor di browser → cek file sudah update.

### 2.8 Test Run Function
```bash
clasp run runAutoSync
```

### 2.9 File `.claspignore` (opsional)
Buat file `.claspignore` supaya file lain di folder tidak ke-push:
```
# .claspignore
**/**
!google-apps-script.gs
!appsscript.json
```

---

## 3. Vercel CLI

### 3.1 Install
```bash
npm install -g vercel
```

### 3.2 Login
```bash
vercel login
```
Browser buka → login pakai GitHub account.

### 3.3 Link Project
```bash
cd "C:\Penyimpanan utama\Downloads\absen ibadahh"
vercel link
```
Pilih project `aog-teens-jaktim` dari list.

### 3.4 Fitur yang Bisa Dipakai
```bash
vercel logs         # lihat log deployment terakhir
vercel deploy       # manual deploy (biasa auto via git push)
vercel domains ls   # list domain
vercel env ls       # list env vars
```

---

## 4. Update `.gitignore`

Pastikan file sensitif tidak ter-commit:

<a id="gitignore-content"></a>
```gitignore
# .gitignore
.env
.env.local
.env.production
.pgpass
.clasprc.json
.clasp.json
node_modules/
.vercel/
*.backup
```

---

## 5. Helper Scripts (Optional — Speedup)

Buat file `run-sql.sh` (atau `.bat` di Windows):

### `run-sql.sh` (Git Bash)
```bash
#!/bin/bash
# Usage: ./run-sql.sh "SELECT * FROM members LIMIT 5;"
source .env
psql "$SUPABASE_DB_URL" -c "$1"
```

### `run-sql.bat` (Windows CMD)
```bat
@echo off
:: Usage: run-sql.bat "SELECT * FROM members LIMIT 5;"
for /f "tokens=1,2 delims==" %%a in (.env) do set %%a=%%b
psql "%SUPABASE_DB_URL%" -c %1
```

Setelah setup ini, Claude Code bisa:
```bash
./run-sql.sh "UPDATE members SET cg='TEEN 25' WHERE nama='Valerie...'"
clasp push
git push
```

Semua **satu perintah**, no manual copy-paste.

---

## 6. Update MASTER_HANDOFF.md untuk Claude Code Baru

Kasih tau di prompt startup:

```
Aku sudah setup full-access untuk kamu. Baca AUTO_ACCESS_SETUP.md
untuk detail tools yang tersedia:
- psql direct SQL execution (via SUPABASE_DB_URL di .env)
- clasp untuk Google Apps Script deploy
- vercel CLI untuk deploy monitoring

Kamu bisa langsung eksekusi SQL, push Apps Script, tanpa perlu 
kasih instruksi manual ke aku.
```

---

## 7. Contoh Alur Kerja Setelah Setup

### Sebelum (manual):
```
Nick: "ganti CGL TEEN 17 jadi Lauvin"
Claude: "run SQL ini di Supabase: BEGIN; UPDATE ..."
Nick: [buka Supabase → paste → Run → screenshot hasil]
Nick: [update Apps Script manual]
Nick: [refresh app]
```

### Sesudah (auto):
```
Nick: "ganti CGL TEEN 17 jadi Lauvin"
Claude: [run psql -c "BEGIN; UPDATE...; COMMIT;"]
Claude: [edit google-apps-script.gs kalau perlu]
Claude: [clasp push]
Claude: [clasp run fullRebuildJaktim2]
Claude: "Selesai. Refresh app-mu."
Nick: [refresh]
```

**~90% waktu save.**

---

## 8. Troubleshooting

### psql: could not connect
- Cek password benar (Supabase → Settings → Database → Reset password)
- Cek IP kamu tidak di-block (Supabase → Settings → Database → Network Restrictions → allow all)

### clasp: Login failed
- Cek Apps Script API enabled (step 2.3)
- Cek Google account yang login punya akses ke Sheets target

### clasp push: rejected
- Kemungkinan file di Apps Script editor lebih baru dari lokal → `clasp pull` dulu

### vercel: project not found
- `vercel link` ulang, pastikan pilih project yang benar

---

## 9. Security Reminder

**Yang HARUS aman:**
- `.env` — service role key + DB URL
- `.clasprc.json` — Google OAuth token
- `~/.pgpass` — Postgres password

**Yang public OK:**
- `SUPABASE_ANON_KEY` — sudah di index.html
- Script ID Apps Script (di `.clasp.json`)
- Vercel project ID

**Kalau laptop hilang / dicuri:**
1. Supabase Dashboard → Settings → Database → **Reset password**
2. Google Account → Security → **Revoke third-party access** → clasp
3. Vercel → Settings → Access → **Revoke tokens**

---

## 10. TL;DR — Setup Checklist

Setup one-time (skip yang sudah ada):

- [ ] Install PostgreSQL Command Line Tools (`psql`)
- [ ] Install Node.js (LTS)
- [ ] `npm install -g @google/clasp vercel`
- [ ] Ambil Supabase service_role key & DB URL dari dashboard
- [ ] Buat `.env` di project root dengan credentials
- [ ] Update `.gitignore` (add `.env`, `.clasprc.json`, dll)
- [ ] Enable Apps Script API di Google settings
- [ ] `clasp login` → grant permission
- [ ] `clasp clone SCRIPT_ID` → link Apps Script
- [ ] `vercel login` → `vercel link` → link project
- [ ] Test: `psql $SUPABASE_DB_URL -c "SELECT count(*) FROM members;"`
- [ ] Test: `clasp push` setelah edit `.gs`

Total: ~15-20 menit setup, save 90% manual copy-paste ke depannya.

---

## 11. Untuk Claude Code Baru

Setelah user setup selesai, prompt untuk Claude Code baru:

```
Aku sudah setup full-access di folder ini (baca AUTO_ACCESS_SETUP.md).

Kamu bisa langsung:
1. Execute SQL: `psql "$SUPABASE_DB_URL" -c "SQL_HERE"` 
   atau load dari file: `psql "$SUPABASE_DB_URL" -f query.sql`
2. Deploy Apps Script: `clasp push` (setelah edit .gs file)
3. Run Apps Script function: `clasp run FUNCTION_NAME`
4. Vercel logs: `vercel logs`

Selalu load env dulu: `source .env` sebelum command yang butuh var.

Untuk operasi yang risky (DELETE, DROP), konfirmasi ke aku dulu.
```

Claude Code baru akan auto-use CLI tools tanpa perlu kamu paste-paste.
