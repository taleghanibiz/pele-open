// served as /js/config.js (vercel.json rewrite), so the browser config comes from Vercel env, not from code
export default function handler(req, res) {
  const v = k => JSON.stringify(process.env[k] || '');
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(`export const SUPABASE_URL = ${v('SUPABASE_URL')};\nexport const SUPABASE_KEY = ${v('SUPABASE_ANON_KEY')};\nexport const BOT = ${v('TELEGRAM_BOT')};\n`);
}
