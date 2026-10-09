// GET    /api/photos          -> [{ id, url, name }]  (foto yang diunggah)
// POST   /api/photos          -> unggah satu foto (body mentah image/*, header x-edit-key, x-name)
// DELETE /api/photos?id=12    -> hapus foto unggahan
// Env: DATABASE_URL (Neon), BLOB_READ_WRITE_TOKEN (Vercel Blob), EDIT_PASSWORD (opsional)
const MAX = 4 * 1024 * 1024; // batas body fungsi Vercel ~4,5 MB

async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const parts = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > MAX) throw Object.assign(new Error('besar'), { code: 413 }); parts.push(c); }
  return Buffer.concat(parts);
}

function makeHandler({ getSql, putFile, delFile }) {
  let ready = null;
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const sql = getSql();
      if (!ready) ready = sql`CREATE TABLE IF NOT EXISTS photos (id serial PRIMARY KEY, url text NOT NULL, name text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`;
      await ready;
      if (req.method === 'GET') {
        const rows = await sql`SELECT id, url, name FROM photos ORDER BY id`;
        return res.status(200).json(rows);
      }
      if (req.method === 'POST' || req.method === 'DELETE') {
        const pw = process.env.EDIT_PASSWORD;
        if (pw && req.headers['x-edit-key'] !== pw) return res.status(401).json({ error: 'Kata sandi salah' });
      }
      if (req.method === 'POST') {
        const type = String(req.headers['content-type'] || '');
        const buf = await readBody(req);
        if (!buf.length || buf.length > MAX) return res.status(413).json({ error: 'Ukuran foto terlalu besar' });
        const ext = /png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : 'jpg';
        const mime = ext === 'jpg' ? 'image/jpeg' : 'image/' + ext;
        let name = ''; try { name = decodeURIComponent(String(req.headers['x-name'] || '')).slice(0, 200); } catch (e) {}
        const key = 'foto/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        const url = await putFile(key, buf, mime);
        const rows = await sql`INSERT INTO photos (url, name) VALUES (${url}, ${name}) RETURNING id, url, name`;
        return res.status(200).json(rows[0]);
      }
      if (req.method === 'DELETE') {
        const id = parseInt(new URL(req.url, 'http://x').searchParams.get('id'), 10);
        if (!id) return res.status(400).json({ error: 'id tidak valid' });
        const rows = await sql`DELETE FROM photos WHERE id = ${id} RETURNING url`;
        if (rows[0]) { try { await delFile(rows[0].url); } catch (e) { console.error(e); } }
        await sql`DELETE FROM descriptions WHERE file = ${'up-' + id}`.catch(() => {});
        return res.status(200).json({ ok: true });
      }
      res.setHeader('Allow', 'GET, POST, DELETE');
      return res.status(405).json({ error: 'Metode tidak didukung' });
    } catch (e) {
      console.error(e);
      if (e && e.code === 413) return res.status(413).json({ error: 'Ukuran foto terlalu besar' });
      return res.status(500).json({ error: 'Gagal: ' + (e && e.message ? e.message : 'kesalahan server') });
    }
  };
}

module.exports = makeHandler({
  getSql() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diisi');
    return require('@neondatabase/serverless').neon(process.env.DATABASE_URL);
  },
  async putFile(key, buf, mime) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Vercel Blob belum dihubungkan');
    const r = await require('@vercel/blob').put(key, buf, { access: 'public', contentType: mime, addRandomSuffix: false });
    return r.url;
  },
  async delFile(url) { await require('@vercel/blob').del(url); }
});
module.exports.makeHandler = makeHandler;
