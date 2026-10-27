# Prompt untuk Claude Code Baru

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


Copy salah satu prompt di bawah ke Claude Code baru (buka di folder `C:\Penyimpanan utama\Downloads\absen ibadahh`).

---

## Prompt Lengkap (disarankan)

```
Aku Nick, Coach jaktim1 AOG Teens. Aku lanjut project web absensi AOG Teens Jaktim
di folder ini (C:\Penyimpanan utama\Downloads\absen ibadahh).

Sebelum kerja apa pun:
1. Baca CLAUDE.md full — ini sumber paling baru (v37): rules, desain, riwayat v18–v37
2. Baca START_HERE.md dan ikuti checklist-nya
3. Skim MASTER_HANDOFF.md untuk latar belakang (isinya v31; bagian "Update v32 → v37"
   di atas sudah merangkum perubahan sesudahnya)
4. Jalankan: git status && git log --oneline -10

Lalu konfirmasi singkat ke aku:
- Versi sekarang (harus v37 atau lebih baru) + commit terakhir
- Tech stack + rules file (single index.html, no build step, vercel.json cuma rewrites)
- Kenapa attendance wajib lewat saveAttendance() dan fetchAllAttendance / fetchBoundedAttendance
- URL: /teen-01, /coach, /tl
- Sisa backlog: PIN Coach/TL; data yang masih perlu diisi CGL (lihat CLAUDE.md
  bagian "Pembersihan data")

Aturan kerja:
- Pakai bahasa Indonesia santai, jawab singkat pakai bullet
- JANGAN sampai ada data yang hilang atau rusak — cek ulang setiap perubahan
  yang menyentuh Supabase sebelum push
- Setiap push code: bump versi di index.html (2 tempat) + service-worker.js
- Kerja di branch `redesign` (preview) dulu, merge ke `main` (production) hanya kalau aku bilang "merge"
- Tanya dulu sebelum push, hapus/ubah data di Supabase, atau ubah schema database
- Sebelum ubah data massal: simpan cadangan JSON di folder Downloads dulu
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
| Coach / TL | https://absenibadahjaktim.vercel.app/coach · https://absenibadahjaktim.vercel.app/tl (CGL: `/teen-01` dst) |
| Repo | https://github.com/Nicks1806/aog-teens-jaktim |

### Backlog yang belum dikerjakan
1. Ganti `confirm()` / `alert()` (~17 tempat) dengan versi async — mencegah WebSocket putus saat dialog terbuka
2. Optimasi `getCGStats` — filter tanggal per region
3. UI hapus custom role pelayanan
4. Cek data lama kolom `sekolah` / `kelurahan` yang mungkin berisi teks gabungan dari bug sebelum v31 (cek via SQL dulu, cleanup manual — jangan auto-split)
5. Redesign UI (referensi: `CURRENT_DESIGN.md`)
