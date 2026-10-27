// Vercel Serverless Function — proxy "Tanya AI" (Gemini) untuk tab Coach/TL.
// Tanpa npm / build step: Node 18+ sudah punya fetch.
// Environment variables (Vercel → Settings → Environment Variables):
//   GEMINI_API_KEY  (wajib)  — key Gemini, JANGAN ditaruh di index.html / repo
//   AI_PIN          (opsional) — kalau diisi, Coach/TL wajib memasukkan kode akses; kosong = tanpa kode
//   GEMINI_MODEL    (opsional, default 'gemini-flash-latest' — alias Flash terbaru)
// Kalau Google menolak model dan menyarankan model lain ("use models/xxx"), otomatis dicoba ulang sekali.

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

// Model cadangan kalau model utama sibuk ("high demand") / dipensiunkan / timeout
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];

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
  const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
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
  contents.push({ role: 'user', parts: [{ text: question }] });

  const callGemini = async (model) => {
    // Batas 20 dtk per panggilan supaya tidak menggantung sampai Vercel timeout
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
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
  let lastErr = 'Gemini tidak bisa dihubungi.', lastStatus = 502;
  while (queue.length && Date.now() - started < 55000) {
    const model = queue.shift();
    if (!model || tried.includes(model)) continue;
    tried.push(model);
    let out;
    try { out = await callGemini(model); }
    catch (e) {
      if (e && e.name === 'AbortError') { lastErr = 'Gemini terlalu lama menjawab.'; lastStatus = 504; console.warn('[api/ai] timeout', model); continue; }
      console.error('[api/ai] fetch failed', model, e); lastErr = 'Gagal menghubungi Gemini.'; continue;
    }
    const { r, data, msg } = out;
    if (r.ok) {
      const cand = data.candidates && data.candidates[0];
      const text = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts.map(p => p.text || '').join('') : '';
      if (text) return send(res, 200, { text, model });
      return send(res, 502, { error: 'Gemini tidak memberi jawaban' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : '') + '.' });
    }
    console.warn('[api/ai] gemini error', model, r.status, msg);
    lastErr = 'Gemini menolak permintaan: ' + msg.slice(0, 200); lastStatus = 502;
    // Google menyarankan model pengganti → coba itu dulu
    const sug = /use (?:models\/)?([a-z0-9][a-z0-9.\-]*)/i.exec(msg);
    if (sug && sug[1]) queue.unshift(sug[1]);
    const retriable = [404, 429, 500, 503].includes(r.status) || /high demand|overloaded|unavailable|no longer available|not found|try again/i.test(msg);
    if (!retriable) break; // mis. key salah → tidak perlu coba model lain
  }
  return send(res, lastStatus, { error: lastErr.replace(/[.\s]*$/, '.') + ' Coba lagi sebentar lagi.', tried });
};
