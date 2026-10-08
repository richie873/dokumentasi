// GET  /api/descriptions            -> { "01.jpg": "teks", ... }
// PUT  /api/descriptions {file,desc} -> simpan satu deskripsi (kosong = hapus)
// Env: DATABASE_URL (otomatis dari integrasi Neon di Vercel), EDIT_PASSWORD (opsional)
const { neon } = require('@neondatabase/serverless');

function makeHandler(getSql) {
  let ready = null;
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const sql = getSql();
      if (!ready) ready = sql`CREATE TABLE IF NOT EXISTS descriptions (file text PRIMARY KEY, text text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
      await ready;

      if (req.method === 'GET') {
        const rows = await sql`SELECT file, text FROM descriptions`;
        const out = {}; rows.forEach(r => { out[r.file] = r.text; });
        return res.status(200).json(out);
      }
      if (req.method === 'PUT') {
        const pw = process.env.EDIT_PASSWORD;
        if (pw && req.headers['x-edit-key'] !== pw) return res.status(401).json({ error: 'Kata sandi salah' });
        let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
        const file = b && typeof b.file === 'string' ? b.file : '';
        const desc = b && typeof b.desc === 'string' ? b.desc : null;
        if (!file || file.length > 200 || desc === null || desc.length > 5000) return res.status(400).json({ error: 'Data tidak valid' });
        if (!desc.trim()) await sql`DELETE FROM descriptions WHERE file = ${file}`;
        else await sql`INSERT INTO descriptions (file, text) VALUES (${file}, ${desc})
                       ON CONFLICT (file) DO UPDATE SET text = EXCLUDED.text, updated_at = now()`;
        return res.status(200).json({ ok: true });
      }
      res.setHeader('Allow', 'GET, PUT');
      return res.status(405).json({ error: 'Metode tidak didukung' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Database tidak bisa dihubungi' });
    }
  };
}
module.exports = makeHandler(() => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diisi');
  return neon(process.env.DATABASE_URL);
});
module.exports.makeHandler = makeHandler;
