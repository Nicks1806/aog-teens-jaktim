// Vercel Serverless Function — proxy "Tanya AI" (Gemini) untuk tab Coach/TL.
// Tanpa npm / build step: Node 18+ sudah punya fetch.
// Environment variables (Vercel → Settings → Environment Variables):
//   GEMINI_API_KEY  (wajib)  — key Gemini, JANGAN ditaruh di index.html / repo
//   AI_PIN          (opsional) — kalau diisi, Coach/TL wajib memasukkan kode akses; kosong = tanpa kode
//   GEMINI_MODEL    (opsional, default 'gemini-3.5-flash' — paling stabil saat dicek 27 Okt 2026)
// Kalau Google menolak model dan menyarankan model lain ("use models/xxx"), otomatis dicoba ulang sekali.

const SYSTEM_PROMPT = [
  'Kamu adalah asisten data untuk Coach dan Team Leader AOG Teens (pelayanan remaja gereja, Jakarta Timur). Kamu juga paham cara memakai web dashboard ini (lihat PANDUAN APLIKASI di bawah).',
  'Kamu menerima DATA JSON terbaru dari dashboard: tanggal ibadah per region, info CG (termasuk visi/misi & persen per bulan), anggota (status, string absensi, angka kehadiran, milestone selesai & berikutnya, jumlah pelayanan 4 bulan), jadwal pelayanan 4 bulan terakhir (petugas bisa lebih dari 1, dipisah koma), rencana pengembangan, dan event. Untuk ringkasan 1 anak, datanya ada di anak_ini, cg_anak, teman_satu_cg, pelayanan_anak, rencana_anak.',
  'Aturan:',
  '- Jawab dalam bahasa Indonesia yang santai, ringkas, dan jelas. Pakai bullet / angka kalau membantu. Boleh pakai **tebal** untuk poin penting.',
  '- HANYA gunakan data yang diberikan. Kalau datanya tidak ada atau tidak cukup, katakan terus terang — jangan mengarang nama, angka, atau tanggal.',
  '- String absensi tiap anggota sejajar 1:1 dengan "tanggal_ibadah" di region anggota itu. H=Hadir, I=Izin, S=Sakit, A=Alpa, "-"=belum diisi / belum bergabung / tanggal yang akan datang.',
  '- Persentase hadir = jumlah H dibagi jumlah absensi yang terisi (H+I+S+A). PAKAI angka yang sudah dihitung di data (persen_hadir, persen_hadir_per_bulan dengan kunci YYYY-MM, tiga_ibadah_terakhir, terakhir_hadir) — jangan menghitung ulang dari string kalau angkanya sudah ada. "Bulan ini" = field bulan_ini. Sebutkan periode yang kamu pakai.',
  '- Tanggal sesudah "hari_ini" adalah tanggal mendatang (belum terjadi).',
  '- Milestone berurutan: MSJ 1 → MSJ 2 → MSJ 3, CGT 1 → CGT 2 → CGT 3, lalu Baptis Air & Baptis Roh.',
  '- Kalau diminta pesan WhatsApp, tulis hangat, sopan, cocok untuk remaja, tanpa menyebut angka persentase yang bisa mempermalukan.',
  '- Fokus membantu pelayanan: siapa yang perlu didoakan / di-follow-up, tren, perbandingan CG, rekap, dan ide tindak lanjut.',
  '- Default jawaban RINGKAS (maksimal ±250 kata, utamakan tabel atau poin). Jawaban panjang/detail hanya kalau diminta.',
  '- Kalau jawaban membahas tren angka dari waktu ke waktu (mis. persen hadir per bulan) atau membandingkan beberapa CG/anak dari waktu ke waktu, sertakan SATU grafik garis dengan blok kode persis seperti ini (JSON valid, tanpa komentar):',
  '```chart',
  '{"judul":"Kehadiran per bulan","tipe":"garis","satuan":"%","label":["Jun","Jul","Agu"],"seri":[{"nama":"TEEN 01","data":[83,75,71]}]}',
  '```',
  '  tipe "garis" untuk tren dari waktu ke waktu (label = urutan waktu); tipe "batang" untuk membandingkan beberapa CG/anak pada satu periode (label = nama CG/anak, 1 seri). Maks 12 label, data = angka sejajar label (null kalau tidak ada), maks 6 seri. Jangan buat grafik kalau tidak perlu.',
  '- Kalau pertanyaan disertai FOTO (mis. daftar hadir di kertas, catatan, poster): baca isinya dengan teliti, cocokkan nama dengan data anggota (sebutkan nama yang tidak ditemukan / tidak terbaca), dan jangan mengarang isi yang tidak jelas.',
  '- Jangan meminta atau menebak data pribadi (nomor HP, alamat, tanggal lahir) — data itu sengaja tidak dikirim.'
].join('\n');

// Panduan cara pakai web — supaya AI bisa menjawab "cara ... gimana?"
const APP_GUIDE = [
  'PANDUAN APLIKASI (dashboard absensi AOG Teens Jaktim). Kalau ditanya cara memakai web, jawab langkah demi langkah sesuai panduan ini. Kalau fiturnya tidak ada di panduan, bilang belum ada (jangan mengarang menu/tombol).',
  '- Alamat: CGL buka dashboard CG-nya (mis. /teen-01) atau dari halaman awal pilih JAKTIM 1/2 → pilih CG Leader → Masuk Dashboard. Coach buka /coach, Team Leader buka /tl. Tidak ada login, jadi link jangan dibagikan ke publik.',
  '- Dashboard CGL punya tab: Absensi, Detail CG, Visi CG, Pelayanan, Milestone, Events. Dashboard Coach/TL punya tab: Overview, Absensi, Milestone, Visi, Events, Tanya AI. Coach memilih region Jaktim 1/2 di header; TL melihat semua region. Ada tombol geser Coach/TL.',
  '- Isi absensi: ketuk kotak di tabel berulang kali: kosong → H (hadir) → I (izin) → S (sakit) → A (alpa) → kosong. Tersimpan otomatis; ada tombol Undo beberapa detik. Coach/TL juga bisa ubah langsung di tab Absensi Coach. Di HP ada filter bulan dengan tombol panah.',
  '- Sinyal jelek: absensi tetap tersimpan di HP (kotak bertanda tertunda, indikator "N tertunda") dan terkirim otomatis saat online. Jangan hapus data browser sebelum terkirim.',
  '- Absen dari foto (Coach/TL): tab Absensi Coach atau tab Tanya AI → tombol "Absen dari foto" → pilih CG + tanggal ibadah → foto daftar hadir → "Baca dengan AI" → cek & koreksi H/I/S/A per anak → "Simpan". Tidak ada yang tersimpan sebelum Simpan. Tombol "Sisanya → Alpa" untuk anak yang tidak ada di foto.',
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
  '- Overview Coach/TL: KPI, Visi Coach, "Perlu perhatian" (anak 3+ ibadah berturut tidak hadir atau kehadirannya turun tajam, tombol "Saran & WA"), kartu tiap CG (klik untuk buka dashboard CG), dan Distribusi Wilayah (filter kecamatan/kelurahan).',
  '- Tanya AI: tanya bebas soal data; grafik/tabel bisa "Simpan gambar" (di HP langsung bagikan ke WA); tombol foto untuk mengirim gambar; tombol mikrofon untuk bertanya pakai suara; "Percakapan baru" untuk mulai ulang; riwayat chat tersimpan di HP itu. Di detail anak (Coach) ada "Ringkas anak ini + draft pesan WA".',
  '- Notifikasi: ketuk ikon lonceng di header untuk mengaktifkan. iPhone harus "Add to Home Screen" dulu (iOS 16.4+). Web bisa dipasang seperti aplikasi lewat menu browser → Add to Home Screen / Install.',
  '- Tema tahun (tulisan THE YEAR OF ...): Coach/TL klik blok tema di sidebar untuk mengubah.',
  '- Versi: tulisan vXX di pojok; kalau muncul "Versi baru tersedia · Muat ulang", ketuk untuk memperbarui. Perubahan data muncul langsung di HP lain (indikator Live/Offline, tombol Refresh). Data juga tersalin otomatis ke Google Sheets tiap 1 menit (satu arah, dari web ke Sheets).'
].join('\n');

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

  const KEY = process.env.GEMINI_API_KEY;
  const PIN = process.env.AI_PIN;
  const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  if (!KEY) return send(res, 503, { error: 'AI belum aktif: GEMINI_API_KEY belum diisi di Vercel.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return send(res, 429, { error: 'Terlalu banyak pertanyaan. Tunggu 1 menit ya.' });

  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: 'Data terlalu besar / tidak valid.' }); }

  if (PIN && String(body.pin || '') !== String(PIN)) return send(res, 401, { error: 'Kode akses AI salah.' });

  // Diagnosa: daftar model yang tersedia untuk key ini (hanya nama model, tanpa data rahasia)
  if (body.action === 'models') {
    try {
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': KEY }, signal: ctrl.signal });
      clearTimeout(timer);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return send(res, 502, { error: (data.error && data.error.message) || ('HTTP ' + r.status) });
      const models = (data.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name || '').replace(/^models\//, ''));
      return send(res, 200, { current: MODEL, models });
    } catch (e) { return send(res, 502, { error: 'Gagal mengambil daftar model.' }); }
  }

  const question = String(body.question || '').trim().slice(0, 2000);
  if (!question) return send(res, 400, { error: 'Pertanyaan kosong.' });
  const context = typeof body.context === 'string' ? body.context.slice(0, 400000) : JSON.stringify(body.context || {}).slice(0, 400000);
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

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

  const callGemini = async (model, think) => {
    // Batas 20 dtk per panggilan supaya tidak menggantung sampai Vercel timeout
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), hasImage ? 35000 : 20000); // baca foto butuh waktu lebih lama
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT + '\n\n' + APP_GUIDE }] },
          contents,
          generationConfig: Object.assign({ temperature: 0.3, maxOutputTokens: 8192 }, think ? { thinkingConfig: { thinkingLevel: 'low' } } : {}, wantJSON ? { responseMimeType: 'application/json' } : {})
        })
      });
      const data = await r.json().catch(() => ({}));
      return { r, data, msg: (data && data.error && data.error.message) || ('HTTP ' + r.status) };
    } finally { clearTimeout(timer); }
  };

  // Coba model utama, lalu cadangan kalau sibuk / dipensiunkan / timeout (maks ±55 dtk total)
  const queue = [MODEL].concat(FALLBACK_MODELS);
  const tried = [];
  const started = Date.now();
  let lastErr = 'AI tidak bisa dihubungi.', lastStatus = 502;
  while (queue.length && Date.now() - started < 55000) {
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
      if (text) return send(res, 200, { text, model, finish: cand.finishReason || '' });
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
  return send(res, lastStatus, { error: lastErr.replace(/[.\s]*$/, '.') + ' Coba lagi sebentar lagi.', tried });
};
