// Vercel Serverless Function — proxy "Tanya AI" (Gemini) untuk tab Coach/TL.
// Tanpa npm / build step: Node 18+ sudah punya fetch.
// Environment variables (Vercel → Settings → Environment Variables):
//   GEMINI_API_KEY  (wajib)  — key Gemini, JANGAN ditaruh di index.html / repo
//   AI_PIN          (wajib)  — kode akses AI untuk Coach/TL
//   GEMINI_MODEL    (opsional, default 'gemini-2.5-flash')

const SYSTEM_PROMPT = [
  'Kamu adalah asisten data untuk Coach dan Team Leader AOG Teens (pelayanan remaja gereja, Jakarta Timur).',
  'Kamu menerima DATA JSON terbaru dari dashboard absensi: daftar tanggal ibadah per region, info CG, anggota (status, string absensi, milestone), dan event.',
  'Aturan:',
  '- Jawab dalam bahasa Indonesia yang santai, ringkas, dan jelas. Pakai bullet / angka kalau membantu. Boleh pakai **tebal** untuk poin penting.',
  '- HANYA gunakan data yang diberikan. Kalau datanya tidak ada atau tidak cukup, katakan terus terang — jangan mengarang nama, angka, atau tanggal.',
  '- String absensi tiap anggota sejajar 1:1 dengan "tanggal_ibadah" di region anggota itu. H=Hadir, I=Izin, S=Sakit, A=Alpa, "-"=belum diisi / belum bergabung / tanggal yang akan datang.',
  '- Persentase hadir = jumlah H dibagi jumlah absensi yang terisi (H+I+S+A), kecuali diminta lain. Sebutkan angka & periode yang kamu pakai.',
  '- Tanggal sesudah "hari_ini" adalah tanggal mendatang (belum terjadi).',
  '- Milestone berurutan: MSJ 1 → MSJ 2 → MSJ 3, CGT 1 → CGT 2 → CGT 3, lalu Baptis Air & Baptis Roh.',
  '- Kalau diminta pesan WhatsApp, tulis hangat, sopan, cocok untuk remaja, tanpa menyebut angka persentase yang bisa mempermalukan.',
  '- Fokus membantu pelayanan: siapa yang perlu didoakan / di-follow-up, tren, perbandingan CG, rekap, dan ide tindak lanjut.',
  '- Jangan meminta atau menebak data pribadi (nomor HP, alamat, tanggal lahir) — data itu sengaja tidak dikirim.'
].join('\n');

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
  for await (const c of req) { size += c.length; if (size > 600 * 1024) throw new Error('too_large'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Gunakan POST' });

  const KEY = process.env.GEMINI_API_KEY;
  const PIN = process.env.AI_PIN;
  const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!KEY || !PIN) return send(res, 503, { error: 'AI belum aktif: GEMINI_API_KEY / AI_PIN belum diisi di Vercel.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return send(res, 429, { error: 'Terlalu banyak pertanyaan. Tunggu 1 menit ya.' });

  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: 'Data terlalu besar / tidak valid.' }); }

  if (String(body.pin || '') !== String(PIN)) return send(res, 401, { error: 'Kode akses AI salah.' });

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
  contents.push({ role: 'user', parts: [{ text: question }] });

  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(MODEL) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ('HTTP ' + r.status);
      console.error('[api/ai] gemini error', r.status, msg);
      return send(res, 502, { error: 'Gemini menolak permintaan: ' + msg.slice(0, 200) });
    }
    const cand = data.candidates && data.candidates[0];
    const text = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts.map(p => p.text || '').join('') : '';
    if (!text) return send(res, 502, { error: 'Gemini tidak memberi jawaban' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : '') + '.' });
    return send(res, 200, { text, model: MODEL });
  } catch (e) {
    console.error('[api/ai] fetch failed', e);
    return send(res, 502, { error: 'Gagal menghubungi Gemini. Coba lagi.' });
  }
};
