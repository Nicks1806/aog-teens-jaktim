// Vercel Serverless Function — proxy "Tanya AI" (Gemini) untuk tab Coach/TL.
// Tanpa npm / build step: Node 18+ sudah punya fetch.
// Environment variables (Vercel → Settings → Environment Variables):
//   GEMINI_API_KEY  (wajib)  — key Gemini, JANGAN ditaruh di index.html / repo
//   AI_PIN          (opsional) — kalau diisi, Coach/TL wajib memasukkan kode akses; kosong = tanpa kode
//   GEMINI_MODEL    (opsional, default 'gemini-3.5-flash' — paling stabil saat dicek 27 Okt 2026)
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
  '- STRUKTUR / BAGAN: kalau diminta struktur organisasi, hierarki, atau bagan pemimpin, tulis SATU blok persis seperti ini (JSON valid), lalu 1-2 kalimat penjelasan:',
  '```struktur',
  '{"judul":"Struktur AOG Teens Jakarta Timur","node":{"nama":"Ko Philip","peran":"Gembala Sinode","anak":[{"nama":"Ko Fuji Harsono","peran":"Gembala Regional","anak":[]}]}}',
  '```',
  '  Pakai nama dari PENGETAHUAN TAMBAHAN & DATA (CG + nama CGL dari data cg). Nama yang tidak diketahui (mis. nama Coach) tulis "(belum diisi)" — jangan mengarang. Untuk CG: nama = nama CG, peran = "CGL: <nama CGL>". Masukkan anak-anak CG hanya kalau diminta. Maks 80 kotak.',
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
  '- Tanya AI: tanya bebas soal data; grafik/tabel/bagan struktur bisa "Simpan gambar" (di HP langsung bagikan ke WA); tombol foto untuk mengirim gambar; tombol mikrofon untuk bertanya pakai suara; "Percakapan baru" untuk mulai ulang; riwayat chat tersimpan di HP itu. Di detail anak (Coach) ada "Ringkas anak ini + draft pesan WA". Coach/TL bisa mengisi "Pengetahuan AI" (tombol di tab Tanya AI) berisi info & aturan tambahan yang selalu diikuti AI.',
  '- Notifikasi: ketuk ikon lonceng di header untuk mengaktifkan. iPhone harus "Add to Home Screen" dulu (iOS 16.4+). Web bisa dipasang seperti aplikasi lewat menu browser → Add to Home Screen / Install.',
  '- Tema tahun (tulisan THE YEAR OF ...): Coach/TL klik blok tema di sidebar untuk mengubah.',
  '- Versi: tulisan vXX di pojok; kalau muncul "Versi baru tersedia · Muat ulang", ketuk untuk memperbarui. Perubahan data muncul langsung di HP lain (indikator Live/Offline, tombol Refresh). Data juga tersalin otomatis ke Google Sheets tiap 1 menit (satu arah, dari web ke Sheets).'
].join('\n');

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

// Model cadangan kalau model utama sibuk ("high demand") / dipensiunkan / timeout
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-lite-latest'];

// Rate limit sederhana per IP (per instance — cukup untuk mencegah pemakaian berlebihan)
const HITS = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 60 * 1000, max = 15;
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
  const KEY = process.env.GEMINI_API_KEY;               // Gemini = cadangan
  // Buang spasi / tanda kutip / baris baru yang ikut tersalin saat mengisi env var di Vercel
  const CLAUDE_KEY = String(process.env.ANTHROPIC_API_KEY || '').trim().replace(/^['"]+|['"]+$/g, '').trim(); // Claude = utama (kalau diisi)
  const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
  const PIN = process.env.AI_PIN;
  const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  if (!KEY && !CLAUDE_KEY) return send(res, 503, { error: 'AI belum aktif: ANTHROPIC_API_KEY / GEMINI_API_KEY belum diisi di Vercel.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return send(res, 429, { error: 'Terlalu banyak pertanyaan. Tunggu 1 menit ya.' });

  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: 'Data terlalu besar / tidak valid.' }); }

  if (PIN && String(body.pin || '') !== String(PIN)) return send(res, 401, { error: 'Kode akses AI salah.' });

  // Diagnosa: daftar model yang tersedia untuk key ini (hanya nama model, tanpa data rahasia)
  const claudeInfo = { aktif: !!CLAUDE_KEY, model: CLAUDE_MODEL, format: !CLAUDE_KEY ? 'kosong' : (/^sk-ant-/.test(CLAUDE_KEY) ? 'format sk-ant (ok)' : 'bukan key Anthropic — awalan ' + CLAUDE_KEY.slice(0, 10) + '…'), panjang: CLAUDE_KEY.length };
  if (body.action === 'models') {
    if (!KEY) return send(res, 200, { claude: claudeInfo, current: null, models: [] });
    try {
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': KEY }, signal: ctrl.signal });
      clearTimeout(timer);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return send(res, 502, { error: (data.error && data.error.message) || ('HTTP ' + r.status) });
      const models = (data.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name || '').replace(/^models\//, ''));
      return send(res, 200, { claude: claudeInfo, current: MODEL, models });
    } catch (e) { return send(res, 502, { error: 'Gagal mengambil daftar model.' }); }
  }

  const question = String(body.question || '').trim().slice(0, 2000);
  if (!question) return send(res, 400, { error: 'Pertanyaan kosong.' });
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
  const prov = ['claude', 'gemini'].includes(body.provider) ? body.provider : 'auto';
  const useClaude = !!CLAUDE_KEY && prov !== 'gemini';
  const useGemini = !!KEY && prov !== 'claude';
  const noAI = note => send(res, 502, Object.assign({ error: prov === 'claude' ? (CLAUDE_KEY ? 'Claude sedang tidak bisa menjawab. Coba lagi, atau pilih AI "Auto".' : 'Claude belum aktif. Pilih AI "Auto" atau "Gemini".') : (prov === 'gemini' && !KEY ? 'Gemini belum aktif. Pilih AI "Auto".' : 'AI tidak bisa dihubungi. Coba lagi sebentar lagi.') }, note ? { note } : {}));

  const geminiBody = think => JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_TEXT }] },
    contents,
    generationConfig: Object.assign({ temperature: 0.3, maxOutputTokens: 8192 }, think ? { thinkingConfig: { thinkingLevel: 'low' } } : {}, wantJSON ? { responseMimeType: 'application/json' } : {})
  });
  const callGemini = async (model, think) => {
    // Batas 20 dtk per panggilan supaya tidak menggantung sampai Vercel timeout
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), hasImage ? 35000 : 20000); // baca foto butuh waktu lebih lama
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: geminiBody(think)
      });
      const data = await r.json().catch(() => ({}));
      return { r, data, msg: (data && data.error && data.error.message) || ('HTTP ' + r.status) };
    } finally { clearTimeout(timer); }
  };

  // ── Claude (utama): Messages API lewat fetch (proyek tanpa npm). Gagal apa pun → lanjut ke Gemini ──
  const imgData = hasImage ? parts[1].inlineData : null;
  const claudeBody = (useFormat, stream) => {
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
      model: CLAUDE_MODEL,
      max_tokens: 12000,
      stream: !!stream,
      system: [{ type: 'text', text: SYSTEM_CLAUDE, cache_control: { type: 'ephemeral' } }],
      messages: msgs,
      output_config
    });
  };
  const CLAUDE_HEADERS = { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2026-10-21' };
  const callClaude = async (useFormat) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), hasImage ? 35000 : 25000);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: CLAUDE_HEADERS,
        body: claudeBody(useFormat, false)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return { status: r.status, err: 'HTTP ' + r.status + ' ' + String((data.error && data.error.message) || '').slice(0, 160) };
      if (data.stop_reason === 'refusal') return { err: 'refusal' };
      // Baca blok berdasarkan type (blok thinking bisa ada di depan)
      const text = (data.content || []).filter(b => b && b.type === 'text').map(b => b.text || '').join('').trim();
      if (!text) return { err: 'jawaban kosong (' + (data.stop_reason || '-') + ')' };
      return { text, model: data.model || CLAUDE_MODEL, finish: data.stop_reason === 'max_tokens' ? 'MAX_TOKENS' : 'STOP' };
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
  const streamClaude = async (emit) => {
    const tmr = withTimer(hasImage ? 35000 : 25000, 25000);
    let model = CLAUDE_MODEL, stop = '', got = false, err = '';
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: tmr.signal, headers: CLAUDE_HEADERS, body: claudeBody(false, true) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); return { err: 'HTTP ' + r.status + ' ' + String((d.error && d.error.message) || '').slice(0, 160) }; }
      await readSSE(r, ev => {
        if (ev.type === 'message_start' && ev.message && ev.message.model) model = ev.message.model;
        else if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta' && ev.delta.text) { got = true; emit(ev.delta.text); }
        else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        else if (ev.type === 'error') err = String((ev.error && ev.error.message) || 'error').slice(0, 160);
      }, tmr.kick);
    } catch (e) { err = e && e.name === 'AbortError' ? 'timeout' : 'gagal terhubung'; }
    finally { tmr.stop(); }
    if (stop === 'refusal' && !got) return { err: 'refusal' };
    if (err) return { err };
    if (!got) return { err: 'jawaban kosong (' + (stop || '-') + ')' };
    return { ok: true, model, finish: stop === 'max_tokens' ? 'MAX_TOKENS' : 'STOP' };
  };
  const streamGemini = async (model, think, emit) => {
    const tmr = withTimer(hasImage ? 35000 : 20000, 20000);
    let got = false, finish = '', err = '';
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse', {
        method: 'POST', signal: tmr.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: geminiBody(think)
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); return { status: r.status, msg: (d && d.error && d.error.message) || ('HTTP ' + r.status) }; }
      await readSSE(r, ev => {
        const c = ev.candidates && ev.candidates[0];
        if (c && c.content && Array.isArray(c.content.parts)) c.content.parts.forEach(p => { if (p.text && !p.thought) { got = true; emit(p.text); } });
        if (c && c.finishReason) finish = c.finishReason;
      }, tmr.kick);
    } catch (e) { err = e && e.name === 'AbortError' ? 'timeout' : 'gagal terhubung'; }
    finally { tmr.stop(); }
    if (err) return { err, status: 504 };
    if (!got) return { status: 502, msg: 'AI tidak memberi jawaban (' + (finish || '-') + ')' };
    return { ok: true, finish };
  };
  const streamAnswer = async () => {
    let started = false, note = '';
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
    const text = t => emit({ t });
    if (useClaude) {
      const c = await streamClaude(text);
      if (c.ok) { emit({ done: true, model: c.model, finish: c.finish }); return res.end(); }
      if (started) { emit({ error: 'Jawaban terputus — coba tanya lagi.' }); return res.end(); }
      note = 'Claude: ' + c.err; // belum ada teks terkirim → aman pindah ke Gemini
      console.warn('[api/ai] claude stream gagal, pakai Gemini', note);
    }
    if (!useGemini) return noAI(note);
    const queue = [MODEL].concat(FALLBACK_MODELS), tried = [];
    let lastErr = 'AI tidak bisa dihubungi.';
    while (queue.length && Date.now() - t0 < 55000) {
      const model = queue.shift();
      if (!model || tried.includes(model)) continue;
      tried.push(model);
      let r = await streamGemini(model, true, text);
      if (!r.ok && !started && r.status === 400 && /thinking/i.test(r.msg || '')) r = await streamGemini(model, false, text);
      if (r.ok) { emit(Object.assign({ done: true, model, finish: r.finish }, note ? { note } : {})); return res.end(); }
      if (started) { emit({ error: 'Jawaban terputus — coba tanya lagi.' }); return res.end(); }
      lastErr = r.msg ? 'AI menolak permintaan: ' + String(r.msg).slice(0, 200) : (r.err === 'timeout' ? 'AI terlalu lama menjawab.' : 'Gagal menghubungi AI.');
      const sug = r.msg && /use (?:models\/)?([a-z0-9][a-z0-9.\-]*)/i.exec(r.msg);
      if (sug && sug[1]) queue.unshift(sug[1]);
      const retriable = !r.msg || [404, 429, 500, 503].includes(r.status) || /high demand|overloaded|unavailable|no longer available|not found|try again/i.test(r.msg);
      if (!retriable) break;
    }
    return send(res, 502, Object.assign({ error: lastErr.replace(/[.\s]*$/, '.') + ' Coba lagi sebentar lagi.', tried }, note ? { note } : {}));
  };
  if (body.stream === true && !wantJSON) return streamAnswer();

  let claudeNote = '';
  if (useClaude) {
    let c = await callClaude(wantJSON);
    if (!c.text && wantJSON && c.status === 400) c = await callClaude(false); // format JSON ditolak → prompt saja
    if (c.text) return send(res, 200, { text: c.text, model: c.model, finish: c.finish });
    claudeNote = 'Claude: ' + String(c.err || '');
    console.warn('[api/ai] claude gagal, pakai Gemini', claudeNote);
  }
  if (!useGemini) return noAI(claudeNote);

  // Gemini (cadangan): model utama, lalu cadangan kalau sibuk / dipensiunkan / timeout (maks ±55 dtk total sejak request masuk)
  const queue = [MODEL].concat(FALLBACK_MODELS);
  const tried = [];
  let lastErr = 'AI tidak bisa dihubungi.', lastStatus = 502;
  while (queue.length && Date.now() - t0 < 55000) {
    const model = queue.shift();
    if (!model || tried.includes(model)) continue;
    tried.push(model);
    let out;
    try {
      out = await callGemini(model, true); // berpikir ringkas → jauh lebih cepat
      // Model yang tidak kenal thinkingLevel → ulangi tanpa
      if (!out.r.ok && out.r.status === 400 && /thinking/i.test(out.msg)) out = await callGemini(model, false);
    }
    catch (e) {
      if (e && e.name === 'AbortError') { lastErr = 'AI terlalu lama menjawab.'; lastStatus = 504; console.warn('[api/ai] timeout', model); continue; }
      console.error('[api/ai] fetch failed', model, e); lastErr = 'Gagal menghubungi AI.'; continue;
    }
    const { r, data, msg } = out;
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
    const retriable = [404, 429, 500, 503].includes(r.status) || /high demand|overloaded|unavailable|no longer available|not found|try again/i.test(msg);
    if (!retriable) break; // mis. key salah → tidak perlu coba model lain
  }
  return send(res, lastStatus, Object.assign({ error: lastErr.replace(/[.\s]*$/, '.') + ' Coba lagi sebentar lagi.', tried }, claudeNote ? { note: claudeNote } : {}));
};
