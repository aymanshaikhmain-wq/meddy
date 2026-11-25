const SYS = `You are Meddy, an expert MBBS tutor (anatomy, physiology, biochemistry, pathology, pharmacology, microbiology, forensic medicine, community medicine, medicine, surgery, OBG, paediatrics and more). Accuracy comes first: if the message contains a REFERENCE block, use it when relevant; otherwise rely on standard textbooks (Gray's, Snell, BD Chaurasia, Guyton, Harrison, Robbins, KD Tripathi). Never invent facts, numbers, nerve roots or eponyms - if unsure, say so and tell the student what to check. Be structured and exam-oriented: headings, bullets, mnemonics, clinical correlations, viva and MCQ points. End anatomy answers with a short 'Verify in:' line naming a textbook chapter topic. Educational use only, not for patient care.`;

const PER_USER = parseInt(process.env.DAILY_LIMIT || '40', 10);     // AI messages per person per day
const GLOBAL = parseInt(process.env.GLOBAL_DAILY_LIMIT || '1000', 10);  // hard cost cap for the whole site per day
const mem = globalThis.__meddy || (globalThis.__meddy = { day: '', users: new Map(), total: 0 });

async function bump(id) {
  const day = new Date().toISOString().slice(0, 10);
  const url = process.env.UPSTASH_REDIS_REST_URL, tok = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && tok) { // persistent counters (recommended, free tier is enough)
    const call = async (cmd) => (await (await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + tok }, body: JSON.stringify(cmd) })).json()).result;
    const u = await call(['INCR', `m:${day}:u:${id}`]); if (u === 1) await call(['EXPIRE', `m:${day}:u:${id}`, 100000]);
    const g = await call(['INCR', `m:${day}:g`]); if (g === 1) await call(['EXPIRE', `m:${day}:g`, 100000]);
    return { u, g };
  }
  if (mem.day !== day) { mem.day = day; mem.users = new Map(); mem.total = 0; } // best-effort without Redis
  const u = (mem.users.get(id) || 0) + 1; mem.users.set(id, u); mem.total++;
  return { u, g: mem.total };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ text: 'POST only' });
  const P = (process.env.PROVIDER || 'gemini').toLowerCase(); // gemini (free) | groq (free) | anthropic (paid)
  const key = P === 'gemini' ? process.env.GEMINI_API_KEY : P === 'groq' ? process.env.GROQ_API_KEY : process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ text: `Server missing the API key for provider "${P}". See DEPLOY.md step B.` });
  if (process.env.ACCESS_CODE && req.headers['x-code'] !== process.env.ACCESS_CODE) return res.status(401).json({ text: 'Access code needed.' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();
  const dev = String(req.headers['x-device'] || '').slice(0, 40);
  let c;
  try { c = await bump(ip + '|' + dev); } catch (e) { c = { u: 0, g: 0 }; }
  if (c.u > PER_USER) return res.status(429).json({ text: `Daily limit reached (${PER_USER} AI messages). It resets at midnight UTC. Notes, atlas, quizzes and flashcards still work offline.`, left: 0 });
  if (c.g > GLOBAL) return res.status(429).json({ text: 'Meddy is resting for today (site-wide limit reached). Try again tomorrow.', left: 0 });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-14)
    .map(m => ({ role: m.role, content: m.content.slice(0, 14000) }));
  if (!messages.length || messages[0].role !== 'user') return res.status(400).json({ text: 'Bad request.' });
  try {
    let r, text;
    if (P === 'gemini') {
      const model = process.env.MODEL || 'gemini-2.5-flash';
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, generationConfig: { maxOutputTokens: 1400 },
          contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) })
      });
      const d = await r.json();
      if (!r.ok) return res.status(r.status === 429 ? 429 : 500).json({ text: r.status === 429 ? 'The free AI quota is used up for now. Try again in a few minutes or tomorrow.' : (d.error?.message || 'AI error') });
      text = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    } else if (P === 'groq') {
      r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
        body: JSON.stringify({ model: process.env.MODEL || 'llama-3.3-70b-versatile', max_tokens: 1400, messages: [{ role: 'system', content: SYS }, ...messages] })
      });
      const d = await r.json();
      if (!r.ok) return res.status(r.status === 429 ? 429 : 500).json({ text: r.status === 429 ? 'The free AI quota is used up for now. Try again in a few minutes.' : (d.error?.message || 'AI error') });
      text = d.choices?.[0]?.message?.content || '';
    } else {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.MODEL || 'claude-sonnet-5-5', max_tokens: 1400, system: SYS, messages })
      });
      const d = await r.json();
      if (!r.ok) return res.status(500).json({ text: d.error?.message || 'AI error' });
      text = (d.content || []).map(c => c.text || '').join('');
    }
    res.status(200).json({ text, left: Math.max(0, PER_USER - c.u) });
  } catch (e) {
    res.status(500).json({ text: 'AI unreachable: ' + e.message });
  }
}
