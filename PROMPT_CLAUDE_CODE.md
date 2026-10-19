# Prompt untuk Claude Code Baru

Copy salah satu prompt di bawah ke Claude Code baru (buka di folder `C:\Penyimpanan utama\Downloads\absen ibadahh`).

---

## Prompt Lengkap (disarankan)

```
Aku Nick, Coach jaktim1 AOG Teens. Aku lanjut project web absensi AOG Teens Jaktim
di folder ini (C:\Penyimpanan utama\Downloads\absen ibadahh).

Sebelum kerja apa pun:
1. Baca START_HERE.md dan ikuti checklist-nya
2. Baca MASTER_HANDOFF.md full (single source of truth)
3. Baca V31_CHANGELOG.md (27 bug fix terakhir, Oktober 2026)
4. Skim CLAUDE.md untuk rules
5. Jalankan: git status && git log --oneline -5

Lalu konfirmasi singkat ke aku:
- Versi sekarang + commit terakhir
- Tech stack + rules file (single index.html, no build step)
- Kenapa attendance wajib pakai fetchAllAttendance / fetchBoundedAttendance
- Apa saja yang diubah di v31
- Sisa backlog yang belum dikerjakan (ada di MASTER_HANDOFF.md bagian Final Notes)

Aturan kerja:
- Pakai bahasa Indonesia santai, jawab singkat pakai bullet
- JANGAN sampai ada data yang hilang atau rusak — cek ulang setiap perubahan
  yang menyentuh Supabase sebelum push
- Setiap push code: bump versi di index.html + service-worker.js
- Tanya dulu sebelum push, hapus data, atau ubah schema database
```

---

## Prompt Singkat

```
Baca START_HERE.md dan ikuti instruksinya. Lalu baca V31_CHANGELOG.md.
Jangan sampai ada data yang hilang atau rusak.
```

---

## Status Saat Handoff

| | |
|---|---|
| Versi production | **v31** |
| Commit kode terakhir | `3acca2f` — v31: 27 bug fixes |
| URL | https://absenibadahjaktim.vercel.app |
| Coach/TL | https://absenibadahjaktim.vercel.app/?role=coach |
| Repo | https://github.com/Nicks1806/aog-teens-jaktim |

### Backlog yang belum dikerjakan
1. Ganti `confirm()` / `alert()` (~17 tempat) dengan versi async — mencegah WebSocket putus saat dialog terbuka
2. Optimasi `getCGStats` — filter tanggal per region
3. UI hapus custom role pelayanan
4. Cek data lama kolom `sekolah` / `kelurahan` yang mungkin berisi teks gabungan dari bug sebelum v31 (cek via SQL dulu, cleanup manual — jangan auto-split)
5. Redesign UI (referensi: `CURRENT_DESIGN.md`)
