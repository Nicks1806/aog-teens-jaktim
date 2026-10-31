// Vercel Serverless Function — proxy "Tanya AI" (Gemini) untuk tab Coach/TL.
// Tanpa npm / build step: Node 18+ sudah punya fetch.
// Environment variables (Vercel → Settings → Environment Variables):
//   GEMINI_API_KEY  (wajib)  — key Gemini, JANGAN ditaruh di index.html / repo
//   AI_PIN          (opsional) — kalau diisi, Coach/TL wajib memasukkan kode akses; kosong = tanpa kode
//   GEMINI_MODEL    (opsional, default 'gemini-3.5-flash' — paling stabil saat dicek 27 Okt 2026)
//   GROQ_API_KEY    (opsional) — Groq = cadangan gratis untuk pertanyaan UMUM saja (data pribadi tidak pernah dikirim)
//   GROQ_MODEL      (opsional) — model Groq utama; GROQ_PRICE_IN / GROQ_PRICE_OUT (USD/MTok) kalau pakai paket berbayar
// Kalau Google menolak model dan menyarankan model lain ("use models/xxx"), otomatis dicoba ulang sekali.

const SYSTEM_PROMPT = [
  'Kamu adalah asisten data untuk Coach, Team Leader, dan CG Leader (CGL) AOG Teens (pelayanan remaja gereja, Jakarta Timur). Field "cakupan" di data menunjukkan siapa penggunanya; CGL hanya menerima data CG-nya sendiri. Kamu juga paham cara memakai web dashboard ini (lihat PANDUAN APLIKASI di bawah).',
  'Kamu menerima DATA JSON terbaru dari dashboard: tanggal ibadah per region, info CG (termasuk visi/misi & persen per bulan), anggota (status, string absensi, angka kehadiran, milestone selesai & berikutnya, jumlah pelayanan 4 bulan), jadwal pelayanan 4 bulan terakhir (petugas bisa lebih dari 1, dipisah koma), rencana pengembangan, dan event. Untuk ringkasan 1 anak, datanya ada di anak_ini, cg_anak, teman_satu_cg, pelayanan_anak, rencana_anak.',
  'Aturan:',
  '- Jawab dalam bahasa Indonesia yang santai, ringkas, dan jelas. Pakai bullet / angka kalau membantu. Boleh pakai **tebal** untuk poin penting.',
  '- HANYA gunakan data yang diberikan. Kalau datanya tidak ada atau tidak cukup, katakan terus terang — jangan mengarang nama, angka, atau tanggal.',
  '- String absensi tiap anggota sejajar 1:1 dengan "tanggal_ibadah" di region anggota itu. H=Hadir, I=Izin, S=Sakit, A=Alpa, "-"=belum diisi / belum bergabung / tanggal yang akan datang.',
  '- Persentase hadir = jumlah H dibagi jumlah absensi yang terisi (H+I+S+A). PAKAI angka yang sudah dihitung di data (persen_hadir, persen_hadir_per_bulan dengan kunci YYYY-MM, tiga_ibadah_terakhir, terakhir_hadir) — jangan menghitung ulang dari string kalau angkanya sudah ada. "Bulan ini" = field bulan_ini. Sebutkan periode yang kamu pakai.',
  '- Tanggal sesudah "hari_ini" adalah tanggal mendatang (belum terjadi).',
  '- Milestone berurutan: MSJ 1 → MSJ 2 → MSJ 3, CGT 1 → CGT 2 → CGT 3, lalu Baptis Air & Baptis Roh.',
  '- Kalau diminta pesan WhatsApp, tulis hangat, sopan, cocok untuk remaja, tanpa menyebut angka persentase yang bisa mempermalukan.',
  '- Izin (I) dan Sakit (S) = berhalangan dengan kabar, bukan menjauh. Untuk menilai anak yang perlu di-follow-up karena menjauh, yang dihitung hanya Alpa (A); pakai alpa_beruntun.',
  '- Fokus membantu pelayanan: siapa yang perlu didoakan / di-follow-up, tren, perbandingan CG, rekap, dan ide tindak lanjut.',
  '- Default jawaban RINGKAS (maksimal ±250 kata, utamakan tabel atau poin). Jawaban panjang/detail hanya kalau diminta.',
  '- Kalau jawaban membahas tren angka dari waktu ke waktu (mis. persen hadir per bulan) atau membandingkan beberapa CG/anak dari waktu ke waktu, sertakan SATU grafik garis dengan blok kode persis seperti ini (JSON valid, tanpa komentar):',
  '```chart',
  '{"judul":"Kehadiran per bulan","tipe":"garis","satuan":"%","label":["Jun","Jul","Agu"],"seri":[{"nama":"TEEN 01","data":[83,75,71]}]}',
  '```',
  '  tipe "garis" untuk tren dari waktu ke waktu (label = urutan waktu); tipe "batang" untuk membandingkan beberapa CG/anak pada satu periode (label = nama CG/anak, 1 seri). Maks 12 label, data = angka sejajar label (null kalau tidak ada), maks 6 seri. Jangan buat grafik kalau tidak perlu.',
  '- LAGU / PAW: kalau menyarankan lagu (mis. susunan PAW), tulis daftar lagunya dalam SATU blok seperti ini (JSON valid), boleh diikuti 1-3 kalimat penjelasan alur/tema:',
  '```lagu',
  '{"judul":"PAW tema pengharapan","lagu":[{"judul":"Goodness of God","artis":"Bethel Music","tipe":"W"}]}',
  '```',
  '  tipe P = praise/cepat, W = worship/pelan, S = sedang. Aplikasi otomatis menampilkan tombol Lirik (YouTube) & Spotify per lagu — JANGAN menulis lirik dan JANGAN membuat link sendiri.',
  '- STRUKTUR / BAGAN: kalau diminta struktur organisasi, hierarki, atau bagan pemimpin, tulis SATU blok persis seperti ini (JSON valid), lalu 1-2 kalimat penjelasan:',
  '```struktur',
  '{"judul":"Struktur AOG Teens Jakarta Timur","node":{"nama":"Ko Philip","peran":"Gembala Sinode","anak":[{"nama":"Ko Fuji Harsono","peran":"Gembala Regional","anak":[]}]}}',
  '```',
  '  Pakai nama dari PENGETAHUAN TAMBAHAN & DATA (CG + nama CGL dari data cg). Nama yang tidak diketahui (mis. nama Coach) tulis "(belum diisi)" — jangan mengarang. Untuk CG: nama = nama CG, peran = "CGL: <nama CGL>". Masukkan anak-anak CG hanya kalau diminta. Maks 80 kotak.',
  '- MENGUBAH DATA ANAK: kalau pengguna meminta mengubah/mencatat data anak (mis. "Andi sudah lulus MSJ 1", "Budi sekarang kelas 10 di SMAN 12", "no HP Citra 0812…", "Dewi jadi Sponsor"), JANGAN bilang sudah tersimpan. Tulis SATU blok persis seperti ini (JSON valid):',
  '```ubah',
  '{"perubahan":[{"id":123,"nama":"Andi Pratama","data":{"msj1":true,"kelas":"10","sekolah":"SMAN 12"}}],"catatan":""}',
  '```',
  '  id & nama dari data anggota. Kolom yang boleh: msj1, msj2, msj3, cgt1, cgt2, cgt3, baptis_air, baptis_roh (true = selesai, false = belum), status (CGL/Sponsor/Member/Simpatisan/VIP), sekolah, kelas, kelurahan, kecamatan, wa (no HP), lahir (YYYY-MM-DD). Hanya kolom yang disebut pengguna; jangan mengubah nama. Kalau nama anak ambigu, tanya dulu. Setelah blok, 1 kalimat: cek lalu tekan "Cek & simpan".',
  '- MENCATAT ABSENSI: kalau pengguna meminta mencatat/mengisi absensi (mis. "TEEN 01 Sabtu ini: Andi, Budi hadir, Citra izin", atau "semua hadir kecuali Dewi"), JANGAN bilang sudah tersimpan — kamu tidak bisa menyimpan. Tulis SATU blok persis seperti ini (JSON valid):',
  '```absen',
  '{"cg":"TEEN 01","tanggal":"2026-10-24","hasil":[{"id":123,"nama":"Andi Pratama","status":"H"}],"tidak_cocok":["Kevin"],"catatan":""}',
  '```',
  '  id & nama dari data anggota CG itu; status H/I/S/A. tanggal = salah satu tanggal_ibadah region CG itu (YYYY-MM-DD); kalau tidak disebut, pakai tanggal ibadah terakhir yang <= hari_ini. Masukkan hanya anak yang disebut — kecuali "semua hadir (kecuali …)", maka masukkan semua anggota CG itu. Nama yang tidak ada di CG itu → tidak_cocok. Kalau CG-nya tidak jelas (Coach/TL punya banyak CG) dan nama tidak cukup untuk menentukan, tanya dulu. Setelah blok, tulis 1 kalimat: cek lalu tekan "Cek & simpan".',
  '- Kalau pertanyaan disertai FOTO (mis. daftar hadir di kertas, catatan, poster): baca isinya dengan teliti, cocokkan nama dengan data anggota (sebutkan nama yang tidak ditemukan / tidak terbaca), dan jangan mengarang isi yang tidak jelas.',
  '- Jangan meminta atau menebak data pribadi (nomor HP, alamat, tanggal lahir) — data itu sengaja tidak dikirim.'
].join('\n');

// Panduan cara pakai web — supaya AI bisa menjawab "cara ... gimana?"
const APP_GUIDE = [
  'PANDUAN APLIKASI (dashboard absensi AOG Teens Jaktim). Kalau ditanya cara memakai web, jawab langkah demi langkah sesuai panduan ini. Kalau fiturnya tidak ada di panduan, bilang belum ada (jangan mengarang menu/tombol).',
  '- Alamat: CGL buka dashboard CG-nya (mis. /teen-01) atau dari halaman awal pilih JAKTIM 1/2 → pilih CG Leader → Masuk Dashboard. Coach buka /coach, Team Leader buka /tl. Tidak ada login, jadi link jangan dibagikan ke publik.',
  '- Dashboard CGL punya tab: Absensi, Detail CG, Visi CG, Pelayanan, Milestone, Events, Tanya AI (AI khusus data CG itu). Dashboard Coach/TL punya tab: Overview, Absensi, Milestone, Visi, Events, Tanya AI. Coach memilih region Jaktim 1/2 di header; TL melihat semua region. Ada tombol geser Coach/TL.',
  '- Isi absensi: ketuk kotak di tabel berulang kali: kosong → H (hadir) → I (izin) → S (sakit) → A (alpa) → kosong. Tersimpan otomatis; ada tombol Undo beberapa detik. Coach/TL juga bisa ubah langsung di tab Absensi Coach. Di HP ada filter bulan dengan tombol panah.',
  '- Sinyal jelek: absensi tetap tersimpan di HP (kotak bertanda tertunda, indikator "N tertunda") dan terkirim otomatis saat online. Jangan hapus data browser sebelum terkirim.',
  '- Ubah data anak lewat chat (Coach/TL & CGL): mis. "Andi sudah lulus MSJ 1, sekarang kelas 10" → AI menyiapkan kartu "Perubahan data" → "Cek & simpan" → centang kolom yang benar → Simpan.',
  '- Saran lagu PAW tampil sebagai daftar dengan tombol "Lirik" (membuka video lirik di YouTube) dan "Spotify" per lagu; lirik tidak ditulis di aplikasi karena hak cipta.',
  '- Ulang tahun: kartu "Ulang tahun terdekat" (30 hari) di Overview Coach/TL dan tab Detail CG, tombol "Ucapan WA" membuat ucapan dengan AI.',
  '- Isi absensi lewat chat / suara (Coach/TL & CGL): di Tanya AI ketik atau tekan mikrofon lalu ucapkan, mis. "TEEN 01 Sabtu ini: Andi, Budi hadir, Citra izin" → AI menyiapkan kartu absensi → "Cek & simpan" → cek/koreksi → Simpan. CGL hanya bisa untuk CG-nya.',
  '- Absen dari foto (Coach/TL & CGL): tab Absensi → tombol "Absen dari foto" → pilih CG + tanggal ibadah → foto daftar hadir → "Baca dengan AI" → cek & koreksi H/I/S/A per anak → "Simpan". Tidak ada yang tersimpan sebelum Simpan. Tombol "Sisanya → Alpa" untuk anak yang tidak ada di foto.',
  '- Tanggal ibadah bulan baru: Coach/TL tab Absensi → tombol "Generate Sabtu [Bulan Tahun]" (menambah semua hari Sabtu bulan berikutnya, aman dari duplikat).',
  '- Pengingat CGL: Coach tab Absensi → bagian "CGL belum input absensi" → "Ingatkan" per CG atau "Ingatkan semua" (notifikasi ke HP CGL yang sudah mengaktifkan notifikasi).',
  '- Tambah anak baru: dashboard CG → tab Detail CG → "Tambah member".',
  '- Edit data anak: tab Detail CG → klik kartu anak → ubah nama, no WA, tanggal lahir (pilih tanggal), sekolah, kelas, kelurahan/kecamatan (ada saran), role (CGL/Sponsor/Member/Simpatisan/VIP), milestone, dan catatan CGL. Tersimpan otomatis.',
  '- Anak tidak aktif lagi: di detail anak pilih "Arsipkan" — anak pindah ke ARSIP JAKTIM 1/2, riwayat absensi & milestone tetap aman. "Hapus member" menghapus permanen beserta semua absensi & catatan; sarankan Arsipkan.',
  '- Pindah CG / mengembalikan dari arsip (khusus Coach/TL): ketik nama di kotak "Cari nama member" di header Coach → buka detail anak → bagian "Pindah CG" → pilih CG tujuan → "Pindahkan". Riwayat absensi ikut pindah.',
  '- Milestone: MSJ 1→2→3, CGT 1→2→3, Baptis Air, Baptis Roh; ketuk chip milestone di detail anak untuk menandai. Tab Milestone menampilkan donut, progres, dan daftar follow-up (Coach: per CG + filter MSJ/CGT/Baptis).',
  '- Visi CG: tab Visi CG → visi (tersimpan otomatis), misi (klik untuk edit, 1 baris = 1 poin), dan Rencana Pengembangan Member (pilih anak, target, deadline). Coach: tab Visi melihat semua CG + Catatan Coach; Visi Coach region ada di Overview.',
  '- Pelayanan: tab Pelayanan → pilih/tambah bulan → pilih minggu → isi petugas tiap tugas (bisa lebih dari 1 orang; tugas default Firman CG, PAW, Game, Sharing + tugas custom). Ada statistik siapa yang belum pernah/jarang melayani.',
  '- Events: tombol tambah event; Coach/TL bisa pilih cakupan Global / Region / per-CG. Ada hitung mundur, filter kategori, salin teks, broadcast WA, edit, hapus. Event yang sudah lewat 7 hari dihapus otomatis (kecuali event bersama).',
  '- Export: Absensi CSV/PDF (tab Absensi), Detail CSV/PDF (tab Detail CG atau Overview Coach), Wilayah CSV (Overview → Distribusi Wilayah).',
  '- Overview Coach/TL: KPI, Visi Coach, "Perlu perhatian" (anak 3x berturut Alpa atau kehadirannya turun tajam; Izin & Sakit tidak dihitung karena berhalangan dengan kabar; tombol "Saran & WA"), kartu tiap CG (klik untuk buka dashboard CG), dan Distribusi Wilayah (filter kecamatan/kelurahan).',
  '- Tanya AI: tanya bebas soal data; grafik/tabel/bagan struktur bisa "Simpan gambar" (di HP langsung bagikan ke WA); tombol foto untuk mengirim gambar; tombol mikrofon untuk bertanya pakai suara; "Percakapan baru" untuk mulai ulang; riwayat chat tersimpan di HP itu. Di detail anak (Coach) ada "Ringkas anak ini + draft pesan WA". Coach/TL bisa melatih AI lewat tombol "Training AI" di tab Tanya AI: ketik hal baru di kolom "Ajarkan hal baru" → Tambah → Simpan; isinya selalu diikuti AI Coach, TL & CGL.',
  '- Notifikasi: ketuk ikon lonceng di header untuk mengaktifkan. iPhone harus "Add to Home Screen" dulu (iOS 16.4+). Web bisa dipasang seperti aplikasi lewat menu browser → Add to Home Screen / Install.',
  '- Tema tahun (tulisan THE YEAR OF ...): Coach/TL klik blok tema di sidebar untuk mengubah.',
  '- Versi: tulisan vXX di pojok; kalau muncul "Versi baru tersedia · Muat ulang", ketuk untuk memperbarui. Perubahan data muncul langsung di HP lain (indikator Live/Offline, tombol Refresh). Data juga tersalin otomatis ke Google Sheets tiap 1 menit (satu arah, dari web ke Sheets).'
].join('\n');

// ── Pertanyaan RINGAN = tidak butuh data anak/absensi (ide game, lagu PAW, cara pakai web, GMS/pemimpin, istilah) ──
// Dijawab Groq dulu dengan prompt ringkas (tanpa DATA dashboard) supaya muat di batas gratis Groq (8.000 token/menit).
// Ragu → dianggap butuh data (jalur biasa). Groq juga diminta membalas PERLU_DATA kalau ternyata butuh data.
const LIGHT_TOPIC_RE = /\b(game|games|permainan|main(an)?|ice ?break(er|ing)?|icebreak\w*|seru|lagu|paw|praise|worship|pujian|penyembahan|playlist|gms|gembala|pastor|pdt|gereja|aog|msj|cgt|baptis|sharing|cgsm|istilah|kkr|stb|servolution|lcom|ayat|renungan|tema)\b|apa itu|artinya|maksudnya/i;
const LIGHT_GUIDE_RE = /\b(cara|caranya|langkah|tutorial|menu|tombol|fitur|aplikasi|web|dashboard|install|notifikasi|export)\b/i;
const DATA_RE = /\b(absen\w*|hadir|kehadiran|alpa|izin|sakit|persen\w*|rekap|statistik|anak|anak2|member|anggota|teen ?\d+|siapa|berapa|bulan ini|minggu ini|minggu lalu|kemarin|tren|grafik|chart|follow.?up|perhatian|data|ultah|ulang tahun|lahir|petugas|jadwal|milestone|lulus|belum|nama|catat|ubah|ganti|simpan|banding\w*|struktur|bagan|cg (saya|ku|kita|ini)|cg-?ku)\b|%/i;
const DATA_STRICT_RE = /\b(teen ?\d+|siapa|berapa|persen\w*|rekap|statistik|tren|grafik|bulan ini|minggu ini|minggu lalu)\b|%/i;
function isLightQuestion(q, history) {
  q = String(q || '');
  if (!q.trim()) return false;
  if (LIGHT_GUIDE_RE.test(q) && /\b(cara|caranya|gimana|bagaimana|langkah|tutorial|di ?mana)\b/i.test(q) && !DATA_STRICT_RE.test(q)) return true; // "cara isi absensi gimana?"
  // "siapa gembala lokal kita?" — pertanyaan pemimpin (bukan anak/CG tertentu)
  if (/\b(gembala|pastor|pdt|pemimpin|team leader|tl|coach)\b/i.test(q) && !/\b(anak|member|anggota|teen ?\d+|absen\w*|hadir|cgl|cg)\b/i.test(q)) return true;
  if (LIGHT_TOPIC_RE.test(q) && !DATA_RE.test(q)) return true;
  // Pertanyaan lanjutan pendek ("yang lain dong") setelah pertanyaan ringan
  const prev = (history || []).filter(h => h && h.role !== 'model').slice(-1)[0];
  return q.length <= 60 && !DATA_RE.test(q) && !!prev && isLightQuestion(String(prev.text || ''), []);
}
// Ambil bagian Training AI yang relevan (blok dipisah baris kosong). Pengetahuan umum (GMS, pemimpin, aturan) selalu ikut.
const GAME_BLOCK_RE = /\b(game|games|ice ?breaker|permainan)\b/i;
const LAGU_BLOCK_RE = /\b(lagu|paw|praise|worship)\b| — [PWS]\??( |\||$)/i;
function lightNotes(notes, q, budget) {
  const blocks = String(notes || '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const isGame = b => GAME_BLOCK_RE.test(b.split('\n')[0]) || /^- .+ — \d+(-\d+)? mnt/m.test(b) && GAME_BLOCK_RE.test(b);
  const isLagu = b => LAGU_BLOCK_RE.test(b.split('\n')[0]) || (b.match(/ — [PWS]\??/g) || []).length >= 2;
  const kind = blocks.map(b => isLagu(b) ? 'lagu' : isGame(b) ? 'game' : 'umum');
  // Blok di bawah judul besar game/lagu ikut kelompok judulnya (mis. "GAME ONLINE", "INTERNASIONAL")
  let cur = 'umum';
  blocks.forEach((b, i) => {
    const head = b.split('\n')[0];
    if (/^(IDE GAME|LAGU PAW)/i.test(head)) cur = kind[i];
    else if (kind[i] === 'umum' && cur !== 'umum' && /^[A-Z0-9 &/()\-—,.]+$/.test(head.replace(/\(.*\)/, '').trim())) kind[i] = cur;
    else if (kind[i] === 'umum') cur = 'umum';
  });
  const want = { umum: true, game: /\b(game|games|permainan|main(an)?|ice ?break\w*|icebreak\w*|seru|fun)\b/i.test(q), lagu: /\b(lagu|paw|praise|worship|pujian|penyembahan|playlist|pujian)\b/i.test(q) };
  let out = '', used = 0;
  blocks.forEach((b, i) => { if (want[kind[i]] && used + b.length <= budget) { out += b + '\n\n'; used += b.length + 2; } });
  return out.trim();
}

// Format jawaban "Absen dari foto" (structured output Claude)
const ABSEN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['hasil', 'tidak_cocok', 'catatan'],
  properties: {
    hasil: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'nama_di_foto', 'status', 'yakin'],
      properties: { id: { type: 'integer' }, nama_di_foto: { type: 'string' }, status: { type: 'string', enum: ['H', 'I', 'S', 'A'] }, yakin: { type: 'boolean' } } } },
    tidak_cocok: { type: 'array', items: { type: 'string' } },
    catatan: { type: 'string' }
  }
};

// ── Catat pemakaian AI (tabel ai_usage) & batas pemakaian (cg_vision '__AI_LIMITS__') ──
// Anon key Supabase = kunci publik yang sama dengan di index.html (bukan rahasia); bisa diganti lewat env.
const SB_URL = process.env.SUPABASE_URL || 'https://gqppviugodokncxezdwd.supabase.co';
const SB_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcHB2aXVnb2Rva25jeGV6ZHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjIwOTcsImV4cCI6MjA5MDQzODA5N30.w2oUJYWk4yr_tJQuhk0UyxJKwgH1C3FkmJB6CXclSpk';
const KURS = Number(process.env.KURS_IDR) || 16500; // perkiraan Rp per USD
// Harga perkiraan (USD per 1 juta token): in, out, cache read, cache write
const PRICE = [
  [/^groq\//i, { in: Number(process.env.GROQ_PRICE_IN) || 0, out: Number(process.env.GROQ_PRICE_OUT) || 0, cr: 0, cw: 0 }], // paket gratis = Rp0
  [/claude-opus/i, { in: 4, out: 20, cr: 0.4, cw: 5 }],
  [/claude-sonnet/i, { in: 2, out: 10, cr: 0.2, cw: 2.5 }],
  [/claude-haiku/i, { in: 0.1, out: 0.5, cr: 0.01, cw: 0.125 }],
  [/flash-lite/i, { in: 0.1, out: 0.4, cr: 0.025, cw: 0 }],
  [/gemini/i, { in: 0.3, out: 2.5, cr: 0.075, cw: 0 }]
];
const costOf = (model, u) => {
  const p = (PRICE.find(([re]) => re.test(model || '')) || [null, { in: 0, out: 0, cr: 0, cw: 0 }])[1];
  return ((u.in || 0) * p.in + (u.out || 0) * p.out + (u.cr || 0) * p.cr + (u.cw || 0) * p.cw) / 1e6;
};
const cUsage = u => ({ in: (u && u.input_tokens) || 0, out: (u && u.output_tokens) || 0, cr: (u && u.cache_read_input_tokens) || 0, cw: (u && u.cache_creation_input_tokens) || 0 });
const gUsage = m => ({ in: (m && m.promptTokenCount) || 0, out: ((m && m.candidatesTokenCount) || 0) + ((m && m.thoughtsTokenCount) || 0), cr: (m && m.cachedContentTokenCount) || 0, cw: 0 });
const sbFetch = (path, opt) => {
  opt = opt || {};
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), opt.timeout || 4000);
  return fetch(SB_URL + '/rest/v1/' + path, Object.assign({}, opt, { signal: ctrl.signal, headers: Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, opt.headers || {}) }))
    .finally(() => clearTimeout(tm));
};
async function logUsage(rows) { try { await sbFetch('ai_usage', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) }); } catch (e) { /* tabel belum ada / jaringan → abaikan */ } }
let LIMITS_CACHE = { t: 0, v: null };
async function getLimits() {
  if (Date.now() - LIMITS_CACHE.t < 30000) return LIMITS_CACHE.v;
  let v = LIMITS_CACHE.v;
  try { const r = await sbFetch('cg_vision?cg=eq.__AI_LIMITS__&region=eq.all&select=visi'); const d = await r.json(); v = d && d[0] && d[0].visi ? JSON.parse(d[0].visi) : null; } catch (e) {}
  LIMITS_CACHE = { t: Date.now(), v };
  return v;
}
// Jumlah pertanyaan (baris kind=jawab) sejak waktu tertentu; null kalau tidak bisa dihitung (tabel belum ada) → limit dilewati
async function countUsage(q) {
  try {
    const r = await sbFetch('ai_usage?select=id&kind=eq.jawab&' + q, { headers: { Prefer: 'count=exact', Range: '0-0' } });
    if (!r.ok) return null;
    const n = parseInt(String(r.headers.get('content-range') || '').split('/')[1], 10);
    return isFinite(n) ? n : null;
  } catch (e) { return null; }
}
async function costSince(iso) {
  try {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const r = await sbFetch('ai_usage?select=cost_usd&created_at=gte.' + encodeURIComponent(iso) + '&order=id', { headers: { Range: (i * 1000) + '-' + (i * 1000 + 999) } });
      if (!r.ok) return null;
      const d = await r.json();
      d.forEach(x => { sum += Number(x.cost_usd) || 0; });
      if (d.length < 1000) break;
    }
    return sum;
  } catch (e) { return null; }
}
// Awal hari / bulan menurut WIB (UTC+7)
const wibStart = unit => { const n = new Date(Date.now() + 7 * 3600e3); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), unit === 'month' ? 1 : n.getUTCDate()) - 7 * 3600e3).toISOString(); };

// Model cadangan kalau model utama sibuk ("high demand") / dipensiunkan / timeout
// Model Gemini yang sedang kena limit (kuota habis / sibuk) diistirahatkan sementara → pertanyaan langsung ke Claude Haiku
const GEM_COOL = new Map();
const isLimitErr = (status, msg) => status === 429 || /quota|exceeded|rate.?limit|resource.?exhausted|high demand|overloaded|try again later/i.test(String(msg || ''));
const coolGemini = (model, msg) => GEM_COOL.set(model, Date.now() + (/quota|exceeded|exhausted/i.test(String(msg || '')) ? 5 * 60e3 : 60e3));
const geminiCooling = model => (GEM_COOL.get(model) || 0) > Date.now();
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-lite-latest'];
// Groq (model terbuka, API mirip OpenAI). Paket gratis membatasi token per menit (TPM) → data besar ditolak (413);
// batas yang terbaca dari pesan error diingat per model, jadi berikutnya langsung dilewati tanpa membuang waktu.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_FALLBACK = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b']; // model chat yang tersedia untuk key ini (cek 28 Okt 2026)
const GROQ_MAX_OUT = 4096;
const GROQ_LIGHT_OUT = 1800; // jawaban ringan (token keluar juga dihitung dalam batas token/menit)
const GROQ_COOL = new Map(), GROQ_TPM = new Map();
const GROQ_TPM_DEFAULT = Number(process.env.GROQ_TPM) || 8000; // batas token/menit paket gratis (cek 28 Okt 2026)
const groqFail = (model, status, msg) => {
  msg = String(msg || '');
  const lim = /tokens per minute[\s\S]*?Limit:? *(\d+)/i.exec(msg);
  if (status === 413 && lim) GROQ_TPM.set(model, +lim[1]); // terlalu besar untuk model ini → model berikutnya
  else if (status === 401 || status === 403) GROQ_COOL.set('*', Date.now() + 5 * 60e3); // key salah / diblokir
  else if (status === 404 || /decommission|does not exist|not found/i.test(msg)) GROQ_COOL.set(model, Date.now() + 60 * 60e3);
  else if (status === 429 || status === 413) {
    const m = /try again in (?:(\d+)m)?([\d.]+)?s?/i.exec(msg);
    const ms = m ? ((+m[1] || 0) * 60 + (+m[2] || 0)) * 1000 + 1000 : 60e3;
    GROQ_COOL.set(model, Date.now() + Math.min(Math.max(ms, 5000), 10 * 60e3));
  }
};
const groqCooling = model => (GROQ_COOL.get('*') || 0) > Date.now() || (GROQ_COOL.get(model) || 0) > Date.now();
const failNote = m => 'gagal: ' + String(m || 'tidak diketahui').replace(/\s+/g, ' ').slice(0, 140);
const oUsage = u => ({ in: (u && u.prompt_tokens) || 0, out: (u && u.completion_tokens) || 0, cr: (u && u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || 0, cw: 0 });

// Rate limit sederhana per IP (per instance — cukup untuk mencegah pemakaian berlebihan)
const HITS = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 60 * 1000, max = 60; // 60/menit per IP: WiFi gereja & operator seluler sering berbagi 1 IP
  const arr = (HITS.get(ip) || []).filter(t => now - t < win);
  arr.push(now);
  HITS.set(ip, arr);
  return arr.length > max;
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 4 * 1024 * 1024) throw new Error('too_large'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Gunakan POST' });

  const t0 = Date.now();
  // Catatan pemakaian per panggilan AI → disimpan ke ai_usage tepat sebelum respons selesai
  const USE = []; let lastUsage = null;
  const LOGCTX = { scope: '', feature: '', route: '' };
  const _end = res.end.bind(res); let _logged = false;
  res.end = (...a) => {
    if (_logged || !USE.length) return _end(...a);
    _logged = true;
    const ms = Date.now() - t0;
    const rows = USE.map(x => ({ scope: LOGCTX.scope, feature: LOGCTX.feature, route: LOGCTX.route, model: x.model || '', kind: x.kind,
      input_tokens: (x.u && x.u.in) || 0, output_tokens: (x.u && x.u.out) || 0, cache_read: (x.u && x.u.cr) || 0, cache_write: (x.u && x.u.cw) || 0,
      cost_usd: +costOf(x.model, x.u || {}).toFixed(6), ok: x.kind !== 'gagal', ms, note: x.note || null }));
    logUsage(rows).finally(() => _end(...a));
  };
  const KEY = process.env.GEMINI_API_KEY;               // Gemini = cadangan
  // Buang spasi / tanda kutip / baris baru yang ikut tersalin saat mengisi env var di Vercel
  const CLAUDE_KEY = String(process.env.ANTHROPIC_API_KEY || '').trim().replace(/^['"]+|['"]+$/g, '').trim(); // Claude = utama (kalau diisi)
  let CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5'; // bisa diganti Haiku lewat tab Pemakaian AI (claude_model)
  const PIN = process.env.AI_PIN;
  const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const GROQ_KEY = String(process.env.GROQ_API_KEY || '').trim().replace(/^['"]+|['"]+$/g, '').trim();
  const GROQ_MODELS = [...new Set([process.env.GROQ_MODEL].concat(GROQ_FALLBACK).filter(Boolean))];
  if (!KEY && !CLAUDE_KEY) return send(res, 503, { error: 'AI belum aktif: ANTHROPIC_API_KEY / GEMINI_API_KEY belum diisi di Vercel.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return send(res, 429, { error: 'Terlalu banyak pertanyaan. Tunggu 1 menit ya.' });

  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: 'Data terlalu besar / tidak valid.' }); }

  if (PIN && String(body.pin || '') !== String(PIN)) return send(res, 401, { error: 'Kode akses AI salah.' });

  // Diagnosa: daftar model yang tersedia untuk key ini (hanya nama model, tanpa data rahasia)
  const claudeInfo = { aktif: !!CLAUDE_KEY, model: CLAUDE_MODEL, format: !CLAUDE_KEY ? 'kosong' : (/^sk-ant-/.test(CLAUDE_KEY) ? 'format sk-ant (ok)' : 'bukan key Anthropic — awalan ' + CLAUDE_KEY.slice(0, 10) + '…'), panjang: CLAUDE_KEY.length };
  if (body.action === 'models') {
    let groq = { aktif: !!GROQ_KEY, urutan: GROQ_MODELS };
    if (GROQ_KEY) {
      try {
        const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + GROQ_KEY }, signal: ctrl.signal });
        clearTimeout(timer);
        const d = await r.json().catch(() => ({}));
        groq = r.ok ? Object.assign(groq, { models: (d.data || []).map(m => m.id).sort() }) : Object.assign(groq, { error: (d.error && d.error.message) || ('HTTP ' + r.status) });
      } catch (e) { groq.error = 'gagal terhubung'; }
      groq.tpm_tercatat = Object.fromEntries(GROQ_TPM);
    }
    if (!KEY) return send(res, 200, { claude: claudeInfo, groq, current: null, models: [] });
    try {
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': KEY }, signal: ctrl.signal });
      clearTimeout(timer);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return send(res, 502, { error: (data.error && data.error.message) || ('HTTP ' + r.status) });
      const models = (data.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name || '').replace(/^models\//, ''));
      return send(res, 200, { claude: claudeInfo, groq, current: MODEL, models });
    } catch (e) { return send(res, 502, { error: 'Gagal mengambil daftar model.' }); }
  }

  if (body.action === 'groq_test') {
    if (!GROQ_KEY) return send(res, 200, { groq: 'belum aktif' });
    const out = [];
    for (const model of GROQ_MODELS) {
      const t1 = Date.now();
      try {
        const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 20000);
        const r = await fetch(GROQ_URL, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_KEY },
          body: JSON.stringify(Object.assign({ model, max_completion_tokens: 300, temperature: 0.3, messages: [{ role: 'system', content: 'Jawab dalam bahasa Indonesia, maksimal 2 kalimat.' }, { role: 'user', content: 'Berikan 1 ide ice breaking singkat untuk kelompok remaja gereja 8 orang.' }] },
            /gpt-oss/i.test(model) ? { reasoning_effort: 'low' } : {}, /qwen/i.test(model) ? { reasoning_format: 'hidden' } : {})) });
        clearTimeout(timer);
        const d = await r.json().catch(() => ({}));
        out.push({ model, status: r.status, ms: Date.now() - t1, tpm: r.headers.get('x-ratelimit-limit-tokens'), rpd: r.headers.get('x-ratelimit-limit-requests'),
          jawab: String((d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '').slice(0, 300), error: d.error && d.error.message });
      } catch (e) { out.push({ model, error: e && e.name === 'AbortError' ? 'timeout' : 'gagal terhubung', ms: Date.now() - t1 }); }
    }
    return send(res, 200, { groq: out });
  }
  const question = String(body.question || '').trim().slice(0, 2000);
  if (!question) return send(res, 400, { error: 'Pertanyaan kosong.' });
  LOGCTX.scope = String(body.scope || '').slice(0, 40);
  LOGCTX.feature = String(body.feature || 'chat').slice(0, 30);
  const context = typeof body.context === 'string' ? body.context.slice(0, 400000) : JSON.stringify(body.context || {}).slice(0, 400000);
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  // "Training": pengetahuan tambahan dari Coach/TL (disimpan di dashboard) → bagian dari system prompt
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 20000) : '';
  // Data pribadi anak (no HP, alamat, tgl lahir, sekolah, catatan) → HANYA dikirim ke Claude, tidak pernah ke Gemini
  const priv = typeof body.private === 'string' ? body.private.slice(0, 200000) : '';
  const SYSTEM_BASE = SYSTEM_PROMPT + '\n\n' + APP_GUIDE + (notes ? '\n\nPENGETAHUAN TAMBAHAN DARI COACH/TL (selalu ikuti; kalau bertentangan dengan DATA dashboard, yang benar DATA):\n' + notes : '');
  const SYSTEM_TEXT = SYSTEM_BASE; // Gemini: tanpa data pribadi
  const SYSTEM_CLAUDE = priv ? SYSTEM_BASE.replace('- Jangan meminta atau menebak data pribadi (nomor HP, alamat, tanggal lahir) — data itu sengaja tidak dikirim.',
    '- DATA PRIBADI ANAK (no_hp, tanggal_lahir, sekolah, kelas, kelurahan, kecamatan, catatan_cgl) ada di blok DATA PRIBADI. Gunakan hanya untuk pelayanan: kontak follow-up, kunjungan, ulang tahun, kelompok wilayah/sekolah. Tampilkan no HP hanya kalau diminta; jangan menebak data yang kosong.') : SYSTEM_BASE;

  const contents = [
    { role: 'user', parts: [{ text: 'DATA DASHBOARD TERBARU (JSON):\n' + context }] },
    { role: 'model', parts: [{ text: 'Siap, data sudah saya baca. Silakan bertanya.' }] }
  ];
  history.forEach(h => {
    const role = h && h.role === 'model' ? 'model' : 'user';
    const text = String((h && h.text) || '').slice(0, 4000);
    if (text) contents.push({ role, parts: [{ text }] });
  });
  const parts = [{ text: question }];
  // Foto opsional dari HP (sudah diperkecil di client)
  const img = body.image;
  if (img && typeof img === 'object') {
    const mt = String(img.mimeType || '');
    const data = String(img.data || '');
    if (!/^image\/(jpeg|png|webp)$/.test(mt) || !/^[A-Za-z0-9+/=]+$/.test(data) || data.length > 3500000) return send(res, 400, { error: 'Foto tidak valid / terlalu besar.' });
    parts.push({ inlineData: { mimeType: mt, data } });
  }
  contents.push({ role: 'user', parts });
  const hasImage = parts.length > 1;
  const wantJSON = body.json === true; // mis. Absen dari foto → jawaban JSON murni
  // Pilihan pengguna: auto = Claude lalu Gemini cadangan; claude / gemini = hanya itu
  // Batas pemakaian (diatur Coach Jaktim 1 di tab Pemakaian AI). 0 / kosong = tanpa batas.
  let claudeCapped = false;
  const lim = await getLimits();
  // Model Claude utama dipilih Coach Jaktim 1 di tab Pemakaian AI: 'sonnet' (default) / 'haiku' (lebih murah)
  if (lim && lim.claude_model === 'haiku') CLAUDE_MODEL = process.env.CLAUDE_CHECK_MODEL || 'claude-haiku-5-5';
  // Mode Auto (semua CGL + Coach/TL yang memilih Auto): AI utama diatur di tab Pemakaian AI.
  // 'gemini' (default) = Gemini utama, Claude cadangan · 'claude' = Claude utama, Gemini cadangan.
  // Pertanyaan data pribadi selalu Claude dulu (client mengirim provider 'auto'). Pilihan manual Coach/TL tetap dihormati.
  let reqProv = ['claude', 'gemini', 'gemini-first'].includes(body.provider) ? body.provider : 'auto';
  if (lim && lim.ai_utama === 'claude' && reqProv === 'gemini-first') reqProv = 'auto';
  if (lim) {
    const today = encodeURIComponent(wibStart('day'));
    if (lim.harian > 0) { const n = await countUsage('created_at=gte.' + today); if (n !== null && n >= lim.harian) return send(res, 429, { error: 'Batas pemakaian AI hari ini (' + lim.harian + ' pertanyaan) sudah tercapai. Coba lagi besok.' }); }
    if (lim.per_cg > 0 && LOGCTX.scope.indexOf('cgl:') === 0) { const n = await countUsage('created_at=gte.' + today + '&scope=eq.' + encodeURIComponent(LOGCTX.scope)); if (n !== null && n >= lim.per_cg) return send(res, 429, { error: 'Batas pemakaian AI untuk ' + LOGCTX.scope.slice(4) + ' hari ini (' + lim.per_cg + ' pertanyaan) sudah tercapai. Coba lagi besok.' }); }
    if (lim.anggaran_bulan > 0) { const usd = await costSince(wibStart('month')); if (usd !== null && usd * KURS >= lim.anggaran_bulan) return send(res, 429, { error: 'Anggaran AI bulan ini sudah habis. AI aktif lagi bulan depan (atau anggaran dinaikkan di tab Pemakaian AI).' }); }
    if (lim.claude_harian > 0 && reqProv !== 'gemini' && reqProv !== 'gemini-first') { const n = await countUsage('created_at=gte.' + today + '&model=like.claude-sonnet*'); if (n !== null && n >= lim.claude_harian) claudeCapped = true; }
  }
  // Kuota Claude Sonnet habis → jawab pakai Gemini (data pribadi tidak ikut)
  const prov = claudeCapped ? 'gemini' : reqProv;
  LOGCTX.route = prov + (claudeCapped ? ' (kuota Claude habis)' : '') + (lim && lim.ai_utama === 'claude' && body.provider === 'gemini-first' ? ' (Claude utama)' : '');
  const claudeFirst = prov !== 'gemini-first';
  const CHECK_MODEL = process.env.CLAUDE_CHECK_MODEL || 'claude-haiku-5-5'; // pengecek jawaban Gemini (murah)
  const wantCheck = body.check === true && prov === 'gemini-first' && !!CLAUDE_KEY && !hasImage && !(lim && lim.cek_haiku === false); // bisa dimatikan supaya lebih cepat
  const useClaude = !!CLAUDE_KEY && prov !== 'gemini';
  const useGemini = !!KEY && prov !== 'claude';
  const useHaiku = !!CLAUDE_KEY && prov !== 'claude'; // cadangan murah kalau Gemini kena limit
  const useGroq = !!GROQ_KEY && prov !== 'claude' && !hasImage; // cadangan gratis, tanpa data pribadi & tanpa foto
  const noAI = note => send(res, 502, Object.assign({ error: prov === 'claude' ? (CLAUDE_KEY ? 'Claude sedang tidak bisa menjawab. Coba lagi, atau pilih AI "Auto".' : 'Claude belum aktif. Pilih AI "Auto" atau "Gemini".') : (prov === 'gemini' && !KEY ? 'Gemini belum aktif. Pilih AI "Auto".' : 'AI tidak bisa dihubungi. Coba lagi sebentar lagi.') }, note ? { note } : {}));

  const geminiBody = think => JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_TEXT }] },
    contents,
    generationConfig: Object.assign({ temperature: 0.3, maxOutputTokens: 8192 }, think ? { thinkingConfig: { thinkingLevel: 'low' } } : {}, wantJSON ? { responseMimeType: 'application/json' } : {})
  });
  const callGemini = async (model, think) => {
    // Batas 20 dtk per panggilan supaya tidak menggantung sampai Vercel timeout
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), hasImage ? 35000 : 15000); // baca foto butuh waktu lebih lama
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: geminiBody(think)
      });
      const data = await r.json().catch(() => ({}));
      lastUsage = gUsage(data.usageMetadata);
      return { r, data, msg: (data && data.error && data.error.message) || ('HTTP ' + r.status) };
    } finally { clearTimeout(timer); }
  };

  // ── Claude (utama): Messages API lewat fetch (proyek tanpa npm). Gagal apa pun → lanjut ke Gemini ──
  const imgData = hasImage ? parts[1].inlineData : null;
  const claudeBody = (useFormat, stream, mdl) => {
    const msgs = [];
    const push = (role, blocks) => {
      const last = msgs[msgs.length - 1];
      if (last && last.role === role) last.content.push(...blocks); else msgs.push({ role, content: blocks });
    };
    // Data dashboard di-cache (prompt caching) → pertanyaan lanjutan lebih murah & cepat
    push('user', [{ type: 'text', text: 'DATA DASHBOARD TERBARU (JSON):\n' + context + (priv ? '\n\nDATA PRIBADI ANAK (JSON, hanya untuk pelayanan):\n' + priv : ''), cache_control: { type: 'ephemeral' } }]);
    push('assistant', [{ type: 'text', text: 'Siap, data sudah saya baca. Silakan bertanya.' }]);
    history.forEach(h => {
      const text = String((h && h.text) || '').slice(0, 4000);
      if (text) push(h && h.role === 'model' ? 'assistant' : 'user', [{ type: 'text', text }]);
    });
    const lastBlocks = [];
    if (imgData) lastBlocks.push({ type: 'image', source: { type: 'base64', media_type: imgData.mimeType, data: imgData.data } });
    lastBlocks.push({ type: 'text', text: question });
    push('user', lastBlocks);
    const output_config = { effort: 'low' }; // chat & ekstraksi: low = cepat, tetap teliti
    if (useFormat) output_config.format = { type: 'json_schema', schema: ABSEN_SCHEMA };
    return JSON.stringify({
      model: mdl || CLAUDE_MODEL,
      max_tokens: 12000,
      stream: !!stream,
      system: [{ type: 'text', text: SYSTEM_CLAUDE, cache_control: { type: 'ephemeral' } }],
      messages: msgs,
      output_config
    });
  };
  const CLAUDE_HEADERS = { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2026-10-21' };
  const callClaude = async (useFormat, mdl) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), hasImage ? 35000 : 25000);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: CLAUDE_HEADERS,
        body: claudeBody(useFormat, false, mdl)
      });
      const data = await r.json().catch(() => ({}));
      lastUsage = cUsage(data.usage);
      if (!r.ok) return { status: r.status, err: 'HTTP ' + r.status + ' ' + String((data.error && data.error.message) || '').slice(0, 160) };
      if (data.stop_reason === 'refusal') return { err: 'refusal' };
      // Baca blok berdasarkan type (blok thinking bisa ada di depan)
      const text = (data.content || []).filter(b => b && b.type === 'text').map(b => b.text || '').join('').trim();
      if (!text) return { err: 'jawaban kosong (' + (data.stop_reason || '-') + ')' };
      return { text, model: data.model || mdl || CLAUDE_MODEL, finish: data.stop_reason === 'max_tokens' ? 'MAX_TOKENS' : 'STOP' };
    } catch (e) {
      return { err: e && e.name === 'AbortError' ? 'timeout' : 'gagal terhubung' };
    } finally { clearTimeout(timer); }
  };

  // ── Streaming: teks dikirim sepotong-sepotong (NDJSON) → jawaban langsung muncul di HP ──
  // Baris: {"t":"teks"} … lalu {"done":true,"model":…,"finish":…} atau {"error":"…"}
  const withTimer = (firstMs, idleMs) => {
    const ctrl = new AbortController();
    let tm = setTimeout(() => ctrl.abort(), firstMs);
    return { signal: ctrl.signal, kick: () => { clearTimeout(tm); tm = setTimeout(() => ctrl.abort(), idleMs); }, stop: () => clearTimeout(tm) };
  };
  const readSSE = async (resp, onData, kick) => {
    const reader = resp.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      kick();
      buf = (buf + dec.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const evt = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = evt.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
        if (!data || data === '[DONE]') continue;
        let j; try { j = JSON.parse(data); } catch (e) { continue; }
        onData(j);
      }
    }
  };
  const streamClaude = async (emit, mdl) => {
    const tmr = withTimer(hasImage ? 35000 : 25000, 25000);
    let model = mdl || CLAUDE_MODEL, stop = '', got = false, err = '', usage = {};
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: tmr.signal, headers: CLAUDE_HEADERS, body: claudeBody(false, true, mdl) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); return { err: 'HTTP ' + r.status + ' ' + String((d.error && d.error.message) || '').slice(0, 160) }; }
      await readSSE(r, ev => {
        if (ev.type === 'message_start' && ev.message && ev.message.usage) usage = cUsage(ev.message.usage);
        if (ev.type === 'message_delta' && ev.usage && ev.usage.output_tokens != null) usage.out = ev.usage.output_tokens;
        if (ev.type === 'message_start' && ev.message && ev.message.model) model = ev.message.model;
        else if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta' && ev.delta.text) { got = true; emit(ev.delta.text); }
        else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        else if (ev.type === 'error') err = String((ev.error && ev.error.message) || 'error').slice(0, 160);
      }, tmr.kick);
    } catch (e) { err = e && e.name === 'AbortError' ? 'timeout' : 'gagal terhubung'; }
    finally { tmr.stop(); lastUsage = usage; }
    if (stop === 'refusal' && !got) return { err: 'refusal' };
    if (err) return { err };
    if (!got) return { err: 'jawaban kosong (' + (stop || '-') + ')' };
    return { ok: true, model, finish: stop === 'max_tokens' ? 'MAX_TOKENS' : 'STOP' };
  };
  const streamGemini = async (model, think, emit) => {
    const tmr = withTimer(hasImage ? 35000 : 12000, 15000); // huruf pertama maks 12 dtk, jeda antar potongan maks 15 dtk
    let got = false, finish = '', err = '', usage = {};
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse', {
        method: 'POST', signal: tmr.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: geminiBody(think)
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); return { status: r.status, msg: (d && d.error && d.error.message) || ('HTTP ' + r.status) }; }
      await readSSE(r, ev => {
        if (ev.usageMetadata) usage = gUsage(ev.usageMetadata);
        const c = ev.candidates && ev.candidates[0];
        if (c && c.content && Array.isArray(c.content.parts)) c.content.parts.forEach(p => { if (p.text && !p.thought) { got = true; emit(p.text); } });
        if (c && c.finishReason) finish = c.finishReason;
      }, tmr.kick);
    } catch (e) { err = e && e.name === 'AbortError' ? 'timeout' : 'gagal terhubung'; }
    finally { tmr.stop(); lastUsage = usage; }
    if (err) return { err, status: 504 };
    if (!got) return { status: 502, msg: 'AI tidak memberi jawaban (' + (finish || '-') + ')' };
    return { ok: true, finish };
  };
  // ── Groq: menerima persis yang diterima Gemini (SYSTEM_TEXT + DATA umum), TIDAK PERNAH data pribadi ──
  const GROQ_HEADERS = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_KEY };
  const groqMessages = () => {
    const m = [{ role: 'system', content: SYSTEM_TEXT }, { role: 'user', content: 'DATA DASHBOARD TERBARU (JSON):\n' + context }, { role: 'assistant', content: 'Siap, data sudah saya baca. Silakan bertanya.' }];
    history.forEach(h => { const t = String((h && h.text) || '').slice(0, 4000); if (t) m.push({ role: h && h.role === 'model' ? 'assistant' : 'user', content: t }); });
    m.push({ role: 'user', content: question });
    return m;
  };
  const groqEstTok = Math.ceil((SYSTEM_TEXT.length + context.length + question.length + history.reduce((a, h) => a + String((h && h.text) || '').slice(0, 4000).length, 0)) / 3.5) + GROQ_MAX_OUT;
  const groqSkip = (model, est) => groqCooling(model) || (est || groqEstTok) > (GROQ_TPM.get(model) || GROQ_TPM_DEFAULT);
  // Versi ringan: tanpa DATA dashboard, hanya aturan inti + Training AI yang relevan (+ panduan aplikasi kalau ditanya cara pakai)
  const isLight = prov === 'gemini-first' && LOGCTX.feature === 'chat' && !hasImage && !wantJSON && !(lim && lim.groq_ringan === false) && isLightQuestion(question, history);
  const lightMessages = () => {
    const lagu = SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf('- LAGU / PAW'), SYSTEM_PROMPT.indexOf('- STRUKTUR / BAGAN'));
    const guide = LIGHT_GUIDE_RE.test(question) || history.some(h => h && h.role !== 'model' && LIGHT_GUIDE_RE.test(String(h.text || '')));
    const sys = [
      'Kamu asisten untuk CG Leader (CGL), Coach, dan Team Leader AOG Teens Jakarta Timur (pelayanan remaja GMS Church).',
      'Aturan:',
      '- Jawab dalam bahasa Indonesia yang santai, ringkas (maks ±200 kata), dan jelas; pakai poin bila membantu, **tebal** untuk hal penting.',
      '- Fakta tentang GMS, AOG, pemimpin, acara, dan cara pakai aplikasi HANYA dari PENGETAHUAN di bawah — jangan mengarang nama, tanggal, menu, atau tombol. Kalau tidak ada, bilang belum tahu.',
      '- Ide game/kegiatan boleh kreatif, utamakan dari daftar di PENGETAHUAN; cocok untuk remaja, tidak mempermalukan.',
      '- Kamu TIDAK menerima data anggota, absensi, pelayanan, atau milestone. Kalau pertanyaan butuh data itu (nama anak, angka kehadiran, rekap, siapa yang …, jadwal), balas PERSIS satu kata: PERLU_DATA',
      lagu.trim(),
      '- Jangan menulis lirik lagu (hak cipta).',
      '- LAGU: pilih HANYA lagu yang tertulis di daftar LAGU PAW pada PENGETAHUAN, judul ditulis persis. Jangan menambah lagu lain. Artis = nama sebelum titik dua di baris lagu itu (mis. "NDC Worship: Tak Terbatas" → artis "NDC Worship"); lagu di bawah judul GMS LIVE → artis "GMS Live". Tipe P/W/S ikuti kode di daftar.'
    ].join('\n');
    const know = lightNotes(notes, question + ' ' + history.filter(h => h && h.role !== 'model').slice(-2).map(h => String(h.text || '')).join(' '), guide ? 7000 : 11000);
    const m = [{ role: 'system', content: sys + (know ? '\n\nPENGETAHUAN (dari Coach/TL):\n' + know : '') + (guide ? '\n\n' + APP_GUIDE : '') }];
    history.slice(-4).forEach(h => { const t = String((h && h.text) || '').slice(0, 1200); if (t) m.push({ role: h && h.role === 'model' ? 'assistant' : 'user', content: t }); });
    m.push({ role: 'user', content: question });
    return m;
  };
  const lightEstTok = () => Math.ceil(lightMessages().reduce((a, x) => a + x.content.length, 0) / 3) + GROQ_LIGHT_OUT;
  const groqBody = (model, stream, light) => JSON.stringify(Object.assign(
    { model, messages: light ? lightMessages() : groqMessages(), temperature: light && !/\b(lagu|paw|praise|worship|pujian|penyembahan|playlist)\b/i.test(question) ? 0.6 : 0.2, max_completion_tokens: light ? GROQ_LIGHT_OUT : GROQ_MAX_OUT, stream: !!stream },
    /gpt-oss/i.test(model) ? { reasoning_effort: 'low' } : {},
    /qwen/i.test(model) ? { reasoning_format: 'hidden' } : {}, // proses berpikir tidak ikut tampil di jawaban
    wantJSON ? { response_format: { type: 'json_object' } } : {}));
  const streamGroq = async (model, emit, light) => {
    const tmr = withTimer(20000, 20000);
    let got = false, finish = '', err = '', usage = {}, hold = light ? '' : null, needData = false;
    // Mode ringan: tahan ±12 huruf pertama → kalau isinya PERLU_DATA, belum ada yang terkirim dan jalur biasa dipakai
    const out = t => {
      if (hold === null) { got = true; emit(t); return; }
      hold += t;
      if (/^\s*PERLU_DATA/i.test(hold)) { needData = true; return; }
      if (hold.trim().length >= 12 && !/^\s*P(E(R(L(U(_(D(A(T(A)?)?)?)?)?)?)?)?)?\s*$/i.test(hold)) { got = true; const h = hold; hold = null; emit(h); }
    };
    try {
      const r = await fetch(GROQ_URL, { method: 'POST', signal: tmr.signal, headers: GROQ_HEADERS, body: groqBody(model, true, light) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); return { status: r.status, msg: (d.error && d.error.message) || ('HTTP ' + r.status) }; }
      await readSSE(r, ev => {
        const u = ev.usage || (ev.x_groq && ev.x_groq.usage); if (u) usage = oUsage(u);
        const c = ev.choices && ev.choices[0];
        if (c && c.delta && typeof c.delta.content === 'string' && c.delta.content && !needData) out(c.delta.content);
        if (c && c.finish_reason) finish = c.finish_reason;
        if (ev.error) err = String(ev.error.message || 'error').slice(0, 160);
      }, tmr.kick);
    } catch (e) { err = e && e.name === 'AbortError' ? 'timeout' : 'gagal terhubung'; }
    finally { tmr.stop(); lastUsage = usage; }
    if (needData) return { needData: true, msg: 'perlu data' };
    if (hold && hold.trim() && !err) { got = true; emit(hold); } // jawaban sangat pendek
    if (err) return { status: 504, msg: err };
    if (!got) return { status: 502, msg: 'jawaban kosong (' + (finish || '-') + ')' };
    return { ok: true, finish: finish === 'length' ? 'MAX_TOKENS' : 'STOP' };
  };
  const callGroq = async (model) => {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(GROQ_URL, { method: 'POST', signal: ctrl.signal, headers: GROQ_HEADERS, body: groqBody(model, false) });
      const d = await r.json().catch(() => ({}));
      lastUsage = oUsage(d.usage);
      if (!r.ok) return { status: r.status, msg: (d.error && d.error.message) || ('HTTP ' + r.status) };
      const c = d.choices && d.choices[0];
      const text = String((c && c.message && c.message.content) || '').trim();
      if (!text) return { status: 502, msg: 'jawaban kosong' };
      return { text, finish: c.finish_reason === 'length' ? 'MAX_TOKENS' : 'STOP' };
    } catch (e) { return { status: 504, msg: e && e.name === 'AbortError' ? 'timeout' : 'gagal terhubung' }; }
    finally { clearTimeout(timer); }
  };
  // Pengecek: Claude (Haiku) memeriksa jawaban Gemini yang berisi angka/data → 'OK' atau versi yang sudah dibetulkan
  const CHECK_RULES = 'TUGAS KHUSUS: kamu PEMERIKSA jawaban asisten lain untuk pertanyaan di bawah. Bandingkan angka, nama, tanggal, persentase, dan fakta di JAWABAN dengan DATA & PENGETAHUAN. Kalau tidak ada kesalahan fakta (gaya bahasa boleh beda), balas tepat satu kata: OK. Kalau ada yang salah atau dikarang, tulis ULANG jawaban lengkap yang sudah benar dengan format yang sama (markdown dan blok ```chart/```absen/```ubah/```struktur/```lagu tetap dipakai persis formatnya), tanpa menyebut bahwa kamu memeriksa. Kalau penilaian butuh konteks percakapan sebelumnya yang tidak ada, balas OK.';
  const needsCheck = t => /\d/.test(t) || /```(absen|ubah|chart|struktur)/i.test(t) || /\|[^\n]*\|/.test(t);
  const checkWithClaude = async (answer) => {
    const tmr = withTimer(9000, 9000); // lebih dari 9 dtk → jawaban Gemini dipakai tanpa menunggu cek
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: tmr.signal, headers: CLAUDE_HEADERS,
        body: JSON.stringify({
          model: CHECK_MODEL, max_tokens: 8000,
          system: [{ type: 'text', text: SYSTEM_TEXT + '\n\n' + CHECK_RULES, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: [
            { type: 'text', text: 'DATA DASHBOARD TERBARU (JSON):\n' + context, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: 'PERTANYAAN:\n' + question + '\n\nJAWABAN YANG DICEK:\n' + answer }] }],
          output_config: { effort: 'low' }
        })
      });
      const data = await r.json().catch(() => ({}));
      lastUsage = cUsage(data.usage);
      if (!r.ok) { console.warn('[api/ai] cek claude gagal', r.status, data.error && data.error.message); return {}; }
      const t = (data.content || []).filter(x => x && x.type === 'text').map(x => x.text || '').join('').trim();
      if (/^ok[.!]?$/i.test(t)) return { ok: true, model: data.model || CHECK_MODEL };
      if (t.length > 20 && data.stop_reason !== 'max_tokens') return { fix: t, model: data.model || CHECK_MODEL };
      return {};
    } catch (e) { return {}; } finally { tmr.stop(); }
  };
  const streamAnswer = async () => {
    let started = false, note = '', full = '';
    const emit = obj => {
      if (!started) {
        started = true;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Accel-Buffering', 'no');
      }
      res.write(JSON.stringify(obj) + '\n');
    };
    const text = t => { full += t; emit({ t }); };
    // Jawaban Gemini/Groq berisi angka/data → dicek Claude Haiku (kalau sisa waktu cukup)
    const checkFull = async () => {
      if (!(wantCheck && needsCheck(full) && Date.now() - t0 < 38000)) return;
      emit({ checking: true });
      const chk = await checkWithClaude(full);
      USE.push({ model: chk.model || CHECK_MODEL, kind: 'cek', u: lastUsage, note: chk.fix ? 'diperbaiki' : chk.ok ? 'benar' : 'tidak jelas' }); lastUsage = null;
      if (chk.fix) emit({ fix: chk.fix, checker: chk.model });
      else if (chk.ok) emit({ checked: chk.model });
    };
    const tryClaude = async () => {
      const c = await streamClaude(text);
      USE.push({ model: c.model || CLAUDE_MODEL, kind: c.ok ? 'jawab' : 'gagal', u: lastUsage, note: c.ok ? undefined : failNote(c.err) }); lastUsage = null;
      if (c.ok) { emit(Object.assign({ done: true, model: c.model, finish: c.finish }, note ? { note } : {})); res.end(); return 'done'; }
      if (started) { emit({ error: 'Jawaban terputus — coba tanya lagi.' }); res.end(); return 'done'; }
      note = (note ? note + ' · ' : '') + 'Claude: ' + c.err; // belum ada teks terkirim → aman pindah
      console.warn('[api/ai] claude stream gagal', note);
      return 'fail';
    };
    const tryGemini = async () => {
      // Gemini utama sedang istirahat karena limit → langsung ke Haiku tanpa mencoba Gemini lain
      if ((useHaiku || useGroq) && geminiCooling(MODEL)) { note = (note ? note + ' · ' : '') + 'Gemini istirahat (limit)'; return 'fail'; }
      const queue = [MODEL].concat(FALLBACK_MODELS), tried = [];
      while (queue.length && Date.now() - t0 < 50000) {
        const model = queue.shift();
        if (!model || tried.includes(model)) continue;
        tried.push(model);
        if (geminiCooling(model)) { note = (note ? note + ' · ' : '') + 'Gemini ' + model + ': istirahat (limit)'; continue; }
        let r = await streamGemini(model, true, text);
        if (!r.ok && !started && r.status === 400 && /thinking/i.test(r.msg || '')) r = await streamGemini(model, false, text);
        USE.push({ model, kind: r.ok ? 'jawab' : 'gagal', u: lastUsage, note: r.ok ? undefined : failNote(r.msg || r.err) }); lastUsage = null;
        if (r.ok) {
          await checkFull();
          emit(Object.assign({ done: true, model, finish: r.finish }, note ? { note } : {})); res.end(); return 'done';
        }
        if (started) { emit({ error: 'Jawaban terputus — coba tanya lagi.' }); res.end(); return 'done'; }
        note = (note ? note + ' · ' : '') + 'Gemini ' + model + ': ' + (r.msg || r.err || 'gagal').slice(0, 120);
        if (isLimitErr(r.status, r.msg)) coolGemini(model, r.msg);
        else if (r.status === 504 || r.status >= 500) GEM_COOL.set(model, Date.now() + 60e3); // macet / timeout → istirahat 1 mnt
        const sug = r.msg && /use (?:models\/)?([a-z0-9][a-z0-9.\-]*)/i.exec(r.msg);
        if (sug && sug[1]) queue.unshift(sug[1]);
        else if (useHaiku || useGroq) break; // ada cadangan → langsung pindah, jangan antre model Gemini lain (dulu bisa ±60 dtk)
        const retriable = !r.msg || [404, 429, 500, 503].includes(r.status) || /high demand|overloaded|unavailable|no longer available|not found|try again/i.test(r.msg);
        if (!retriable) break;
      }
      return 'fail';
    };
    const tryGroq = async () => {
      for (const model of GROQ_MODELS) {
        if (Date.now() - t0 > 45000) break;
        if (groqSkip(model)) continue; // sedang istirahat / data terlalu besar untuk batas model ini
        const r = await streamGroq(model, text);
        USE.push({ model: 'groq/' + model, kind: r.ok ? 'jawab' : 'gagal', u: lastUsage, note: r.ok ? 'cadangan Gemini' : failNote(r.msg) }); lastUsage = null;
        if (r.ok) {
          await checkFull();
          emit(Object.assign({ done: true, model: 'groq/' + model, finish: r.finish }, note ? { note } : {})); res.end(); return 'done';
        }
        if (started) { emit({ error: 'Jawaban terputus — coba tanya lagi.' }); res.end(); return 'done'; }
        note = (note ? note + ' · ' : '') + 'Groq ' + model + ': ' + String(r.msg || 'gagal').slice(0, 120);
        groqFail(model, r.status, r.msg);
        if (r.status === 401 || r.status === 403) break;
      }
      return 'fail';
    };
    const tryGroqLight = async () => {
      const est = lightEstTok();
      for (const model of GROQ_MODELS) {
        if (Date.now() - t0 > 30000) break;
        if (groqSkip(model, est)) continue;
        const r = await streamGroq(model, text, true);
        USE.push({ model: 'groq/' + model, kind: r.ok ? 'jawab' : 'gagal', u: lastUsage, note: r.needData ? 'ringan → perlu data' : 'ringan' }); lastUsage = null;
        if (r.ok) { emit(Object.assign({ done: true, model: 'groq/' + model, finish: r.finish }, note ? { note } : {})); res.end(); return 'done'; }
        if (started) { emit({ error: 'Jawaban terputus — coba tanya lagi.' }); res.end(); return 'done'; }
        if (r.needData) { LOGCTX.route += ' (ringan → data)'; return 'fail'; } // jalur biasa dengan data
        note = (note ? note + ' · ' : '') + 'Groq ' + model + ': ' + String(r.msg || 'gagal').slice(0, 120);
        groqFail(model, r.status, r.msg);
        if (r.status === 401 || r.status === 403) break;
      }
      return 'fail';
    };
    const tryHaiku = async () => {
      const c = await streamClaude(text, CHECK_MODEL);
      USE.push({ model: c.model || CHECK_MODEL, kind: c.ok ? 'jawab' : 'gagal', u: lastUsage, note: 'cadangan Gemini' }); lastUsage = null;
      if (c.ok) { emit(Object.assign({ done: true, model: c.model || CHECK_MODEL, finish: c.finish }, note ? { note } : {})); res.end(); return 'done'; }
      if (started) { emit({ error: 'Jawaban terputus — coba tanya lagi.' }); res.end(); return 'done'; }
      note = (note ? note + ' · ' : '') + 'Haiku: ' + c.err;
      return 'fail';
    };
    // Urutan: Auto (data pribadi) = Sonnet → Gemini → Groq → Haiku · Gemini dulu = Gemini → Groq → Haiku → Sonnet
    // Pertanyaan ringan (tanpa data) → Groq ringkas dulu (gratis & cepat), lalu jalur biasa
    if (isLight) LOGCTX.route += ' · ringan';
    const order = claudeFirst ? [useClaude && tryClaude, useGemini && tryGemini, useGroq && tryGroq, useHaiku && tryHaiku] : [isLight && useGroq && tryGroqLight, useGemini && tryGemini, useGroq && tryGroq, useHaiku && tryHaiku, useClaude && tryClaude];
    for (const step of order) { if (step && (await step()) === 'done') return; }
    return noAI(note);
  };
  if (body.stream === true && !wantJSON) return streamAnswer();

  let claudeNote = '';
  if (useClaude && claudeFirst) {
    let c = await callClaude(wantJSON);
    if (!c.text && wantJSON && c.status === 400) c = await callClaude(false); // format JSON ditolak → prompt saja
    USE.push({ model: c.model || CLAUDE_MODEL, kind: c.text ? 'jawab' : 'gagal', u: lastUsage }); lastUsage = null;
    if (c.text) return send(res, 200, { text: c.text, model: c.model, finish: c.finish });
    claudeNote = 'Claude: ' + String(c.err || '');
    console.warn('[api/ai] claude gagal, pakai Gemini', claudeNote);
  }
  if (!useGemini && !useGroq && !useHaiku) return noAI(claudeNote);

  // Gemini (cadangan, atau utama kalau gemini-first): model utama, lalu cadangan kalau sibuk / dipensiunkan / timeout (maks ±55 dtk total sejak request masuk)
  const queue = useGemini ? [MODEL].concat(FALLBACK_MODELS) : [];
  const tried = [];
  let lastErr = 'AI tidak bisa dihubungi.', lastStatus = 502;
  if ((useHaiku || useGroq) && geminiCooling(MODEL)) { queue.length = 0; lastErr = 'Gemini istirahat (limit)'; } // langsung ke Groq / Haiku
  while (queue.length && Date.now() - t0 < 55000) {
    const model = queue.shift();
    if (!model || tried.includes(model)) continue;
    tried.push(model);
    if (geminiCooling(model)) continue; // sedang istirahat karena limit
    let out;
    try {
      out = await callGemini(model, true); // berpikir ringkas → jauh lebih cepat
      // Model yang tidak kenal thinkingLevel → ulangi tanpa
      if (!out.r.ok && out.r.status === 400 && /thinking/i.test(out.msg)) out = await callGemini(model, false);
    }
    catch (e) {
      if (e && e.name === 'AbortError') { lastErr = 'AI terlalu lama menjawab.'; lastStatus = 504; console.warn('[api/ai] timeout', model); USE.push({ model, kind: 'gagal', u: null, note: 'gagal: timeout' }); GEM_COOL.set(model, Date.now() + 60e3); if (useHaiku || useGroq) break; continue; }
      console.error('[api/ai] fetch failed', model, e); lastErr = 'Gagal menghubungi AI.'; continue;
    }
    const { r, data, msg } = out;
    USE.push({ model, kind: r.ok && data.candidates && data.candidates.length ? 'jawab' : 'gagal', u: lastUsage, note: r.ok ? undefined : failNote(msg) }); lastUsage = null;
    if (r.ok) {
      const cand = data.candidates && data.candidates[0];
      const text = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts.map(p => p.text || '').join('') : '';
      if (text) return send(res, 200, Object.assign({ text, model, finish: cand.finishReason || '' }, claudeNote ? { note: claudeNote } : {}));
      return send(res, 502, { error: 'AI tidak memberi jawaban' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : '') + '.' });
    }
    console.warn('[api/ai] gemini error', model, r.status, msg);
    lastErr = 'AI menolak permintaan: ' + msg.slice(0, 200); lastStatus = 502;
    // Google menyarankan model pengganti → coba itu dulu
    const sug = /use (?:models\/)?([a-z0-9][a-z0-9.\-]*)/i.exec(msg);
    if (sug && sug[1]) queue.unshift(sug[1]);
    if (isLimitErr(r.status, msg)) coolGemini(model, msg);
    else if (r.status >= 500) GEM_COOL.set(model, Date.now() + 60e3);
    if (!(sug && sug[1]) && (useHaiku || useGroq)) break; // ada cadangan → langsung pindah
    const retriable = [404, 429, 500, 503].includes(r.status) || /high demand|overloaded|unavailable|no longer available|not found|try again/i.test(msg);
    if (!retriable) break; // mis. key salah → tidak perlu coba model lain
  }
  if (useGroq) { // Gemini kena limit / gagal → Groq (gratis, tanpa data pribadi)
    for (const model of GROQ_MODELS) {
      if (Date.now() - t0 > 45000) break;
      if (groqSkip(model)) continue;
      const q = await callGroq(model);
      USE.push({ model: 'groq/' + model, kind: q.text ? 'jawab' : 'gagal', u: lastUsage, note: 'cadangan Gemini' }); lastUsage = null;
      if (q.text) return send(res, 200, { text: q.text, model: 'groq/' + model, finish: q.finish, note: 'Gemini: ' + lastErr });
      lastErr += ' · Groq ' + model + ': ' + String(q.msg || '').slice(0, 120);
      groqFail(model, q.status, q.msg);
      if (q.status === 401 || q.status === 403) break;
    }
  }
  if (useHaiku) { // Gemini & Groq gagal → Claude Haiku (murah)
    let h = await callClaude(wantJSON, CHECK_MODEL);
    if (!h.text && wantJSON && h.status === 400) h = await callClaude(false, CHECK_MODEL);
    USE.push({ model: h.model || CHECK_MODEL, kind: h.text ? 'jawab' : 'gagal', u: lastUsage, note: 'cadangan Gemini' }); lastUsage = null;
    if (h.text) return send(res, 200, { text: h.text, model: h.model || CHECK_MODEL, finish: h.finish, note: 'Gemini: ' + lastErr });
  }
  if (useClaude && !claudeFirst) { // gemini-first: Gemini & Haiku gagal → Claude Sonnet
    const c = await callClaude(wantJSON);
    USE.push({ model: c.model || CLAUDE_MODEL, kind: c.text ? 'jawab' : 'gagal', u: lastUsage }); lastUsage = null;
    if (c.text) return send(res, 200, { text: c.text, model: c.model, finish: c.finish, note: 'Gemini: ' + lastErr });
  }
  return send(res, lastStatus, Object.assign({ error: lastErr.replace(/[.\s]*$/, '.') + ' Coba lagi sebentar lagi.', tried }, claudeNote ? { note: claudeNote } : {}));
};

module.exports.isLightQuestion = isLightQuestion;
module.exports.lightNotes = lightNotes;
