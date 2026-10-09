(function () {
'use strict';
const $ = s => document.querySelector(s);
const grid = $('#grid'), emptyEl = $('#empty'), et = $('#et'), es = $('#es'), statsEl = $('#stats'), fillEl = $('#fill');
const q = $('#q'), fAll = $('#f-all'), fEmpty = $('#f-empty'), editBtn = $('#edit'), editBar = $('#editbar'), editInfo = $('#editinfo');
const toastEl = $('#toast'), upBtn = $('#up'), upIn = $('#upin');
const lb = $('#lb'), lbImg = $('#lbimg'), lbCap = $('#lbcap'), lbPos = $('#lbpos'), lbPrev = $('#lbprev'), lbNext = $('#lbnext');

const KEY_NAME = 'dokumentasi-kunci-v1';
let items = [], filter = 'all', pending = 0, failed = 0;
let editKey = ''; try { editKey = localStorage.getItem(KEY_NAME) || ''; } catch (e) {}

const pad = n => String(n).padStart(2, '0');
const src = it => it.url || ('photos/' + encodeURIComponent(it.file));
const descOf = it => it.desc || '';
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) { if (k === 'class') e.className = props[k]; else e.setAttribute(k, props[k]); }
  kids.forEach(c => { if (c != null) e.append(c); });
  return e;
}
let toastT = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 3500); }

function makeCard(it, i) {
  const c = { it, pos: i + 1 };
  const img = h('img', { alt: 'Foto nomor ' + c.pos, loading: 'lazy', decoding: 'async', src: src(it) });
  const no = h('span', { class: 'no' }, 'No. ' + pad(c.pos));
  const plate = h('button', { class: 'plate', type: 'button', 'aria-label': 'Perbesar foto' }, img, no);
  plate.addEventListener('click', () => openLb(c));
  c.p = h('p', { class: 'desc' });
  c.ta = h('textarea', { id: 'd-' + i, rows: '3', placeholder: 'Tulis deskripsi pekerjaan pada foto ini' });
  c.ta.addEventListener('input', () => {
    it.desc = c.ta.value; c.dirty = true;
    showDesc(c); updateStats(); setSt(c, 'Menyimpan…', ''); clearTimeout(c.t); c.t = setTimeout(() => save(c), 700);
  });
  c.ta.addEventListener('blur', () => { if (c.dirty) { clearTimeout(c.t); save(c); } });
  c.st = h('span', { class: 'st', 'aria-live': 'polite' });
  c.del = null;
  if (it.id) {
    c.del = h('button', { class: 'ghost delbtn', type: 'button' }, 'Hapus foto');
    let armed = false, tm = 0;
    c.del.addEventListener('click', async () => {
      if (!armed) { armed = true; c.del.textContent = 'Yakin hapus?'; c.del.classList.add('armed'); tm = setTimeout(() => { armed = false; c.del.textContent = 'Hapus foto'; c.del.classList.remove('armed'); }, 4000); return; }
      clearTimeout(tm); c.del.disabled = true;
      try { await api('/api/photos?id=' + it.id, { method: 'DELETE' }); items = items.filter(x => x !== c); c.el.remove(); renumber(); updateStats(); applyFilter(); toast('Foto dihapus.'); }
      catch (e) { c.del.disabled = false; toast('Gagal menghapus foto.'); }
    });
  }
  c.el = h('article', { class: 'card' }, plate,
    h('div', { class: 'body' }, h('label', { class: 'lab', 'for': 'd-' + i }, 'Deskripsi'), c.p, c.ta, c.st, c.del));
  c.ta.value = descOf(it);
  showDesc(c);
  return c;
}
function showDesc(c) {
  const d = descOf(c.it).trim();
  c.p.textContent = d || 'Belum ada deskripsi';
  c.p.classList.toggle('none', !d);
}

function updateStats() {
  const n = items.length, filled = items.filter(c => descOf(c.it).trim()).length;
  statsEl.textContent = n + ' foto · ' + filled + ' deskripsi terisi';
  fillEl.style.width = n ? Math.round(filled / n * 100) + '%' : '0';
}
function setSt(c, msg, k) { c.st.textContent = msg; c.st.dataset.k = k; }
function updateEditInfo() {
  editInfo.textContent = failed ? failed + ' deskripsi gagal tersimpan. Periksa koneksi lalu ketik ulang atau klik di luar kolom.'
    : pending ? 'Menyimpan…' : 'Deskripsi tersimpan otomatis ke database dan terlihat oleh semua orang.';
}
async function api(url, opt) {
  opt = opt || {}; opt.headers = Object.assign({}, opt.headers, { 'x-edit-key': editKey });
  const r = await fetch(url, opt);
  if (r.status === 401) {
    const k = prompt(editKey ? 'Kata sandi salah. Masukkan kata sandi edit:' : 'Masukkan kata sandi edit:');
    if (k === null) throw new Error('batal');
    editKey = k; try { localStorage.setItem(KEY_NAME, k); } catch (e) {}
    return api(url, opt);
  }
  if (!r.ok) { let m = ''; try { m = (await r.json()).error || ''; } catch (e) {} throw new Error(m || r.status); }
  return r.json().catch(() => ({}));
}
const put = (file, desc) => api('/api/descriptions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file, desc }) });

function renumber() { items.forEach((c, i) => { c.pos = i + 1; c.it.pos = i + 1; c.el.querySelector('.no').textContent = 'No. ' + pad(c.pos); c.el.querySelector('img').alt = 'Foto nomor ' + c.pos; }); }

/* unggah foto: diperkecil dulu di browser (maks 2400 px) agar muat batas 4 MB */
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const s = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    for (const q of [0.85, 0.7, 0.55]) {
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size < 3.8 * 1024 * 1024) return blob;
    }
  } catch (e) {}
  if (file.size < 3.8 * 1024 * 1024) return file;
  throw new Error('Foto terlalu besar dan tidak bisa diperkecil');
}
async function uploadFiles(files) {
  const list = [...files].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
  if (!list.length) return;
  upBtn.disabled = true; let ok = 0, bad = 0;
  for (let i = 0; i < list.length; i++) {
    editInfo.textContent = 'Mengunggah foto ' + (i + 1) + ' dari ' + list.length + '…';
    try {
      const blob = await shrink(list[i]);
      const row = await api('/api/photos', { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg', 'x-name': encodeURIComponent(list[i].name) }, body: blob });
      const c = makeCard(toItem(row), items.length); items.push(c); grid.append(c.el); ok++; updateStats(); applyFilter();
    } catch (e) { bad++; if (e.message === 'batal') break; }
  }
  upBtn.disabled = false; upIn.value = '';
  toast(ok + ' foto diunggah' + (bad ? ', ' + bad + ' gagal.' : '.')); updateEditInfo();
  if (ok) c_scroll();
}
function c_scroll() { const l = items[items.length - 1]; if (l) l.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
const toItem = r => ({ file: 'up-' + r.id, id: r.id, url: r.url, desc: '' });
upBtn.addEventListener('click', () => upIn.click());
upIn.addEventListener('change', () => uploadFiles(upIn.files));
async function save(c) {
  c.dirty = false; const v = c.it.desc; pending++; updateEditInfo();
  try { await put(c.it.file, v); if (!c.dirty) setSt(c, 'Tersimpan', 'ok'); c.failed && (failed--, c.failed = false); }
  catch (e) { setSt(c, 'Gagal menyimpan', 'err'); if (!c.failed) { failed++; c.failed = true; } c.dirty = true; }
  pending--; updateEditInfo();
}

function applyFilter() {
  const term = q.value.trim().toLowerCase(); let shown = 0;
  items.forEach(c => {
    const d = descOf(c.it).toLowerCase();
    let ok = true;
    if (filter === 'empty' && d.trim()) ok = false;
    if (ok && term) ok = d.includes(term) || String(c.pos) === term;
    c.el.hidden = !ok; if (ok) shown++;
  });
  if (!items.length) { et.textContent = 'Belum ada foto'; es.textContent = 'Taruh foto di folder public/photos lalu deploy ulang.'; emptyEl.hidden = false; }
  else if (!shown) { et.textContent = 'Tidak ada foto yang cocok'; es.textContent = 'Ubah kata pencarian atau filter.'; emptyEl.hidden = false; }
  else emptyEl.hidden = true;
}
q.addEventListener('input', applyFilter);
function setFilter(f) { filter = f; fAll.setAttribute('aria-pressed', String(f === 'all')); fEmpty.setAttribute('aria-pressed', String(f === 'empty')); applyFilter(); }
fAll.addEventListener('click', () => setFilter('all'));
fEmpty.addEventListener('click', () => setFilter('empty'));

/* mode edit */
function setEdit(on) {
  document.body.classList.toggle('editing', on);
  editBtn.setAttribute('aria-pressed', String(on));
  editBtn.textContent = on ? 'Selesai edit' : 'Edit deskripsi';
  editBar.hidden = !on;
  if (on) updateEditInfo();
}
editBtn.addEventListener('click', () => setEdit(editBtn.getAttribute('aria-pressed') !== 'true'));

/* pembesar foto */
let lbList = [], lbIdx = 0, lbFrom = null;
function openLb(c) {
  lbList = items.filter(x => !x.el.hidden); lbIdx = Math.max(0, lbList.indexOf(c));
  lbFrom = document.activeElement; showLb(); lb.hidden = false;
  document.body.style.overflow = 'hidden'; $('#lbclose').focus();
}
function showLb() {
  const c = lbList[lbIdx]; if (!c) { closeLb(); return; }
  lbImg.src = src(c.it); lbImg.alt = 'Foto nomor ' + c.pos;
  lbPos.textContent = 'No. ' + pad(c.pos) + '  ·  ' + (lbIdx + 1) + ' dari ' + lbList.length;
  lbCap.textContent = descOf(c.it).trim() || 'Belum ada deskripsi';
  lbPrev.disabled = lbIdx <= 0; lbNext.disabled = lbIdx >= lbList.length - 1;
}
function closeLb() { lb.hidden = true; lbImg.removeAttribute('src'); document.body.style.overflow = ''; if (lbFrom && lbFrom.focus) lbFrom.focus(); }
$('#lbclose').addEventListener('click', closeLb);
lbPrev.addEventListener('click', () => { if (lbIdx > 0) { lbIdx--; showLb(); } });
lbNext.addEventListener('click', () => { if (lbIdx < lbList.length - 1) { lbIdx++; showLb(); } });
lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lbstage')) closeLb(); });
document.addEventListener('keydown', e => {
  if (lb.hidden) return;
  if (e.key === 'Escape') closeLb(); else if (e.key === 'ArrowLeft') lbPrev.click(); else if (e.key === 'ArrowRight') lbNext.click();
});

/* mulai */
Promise.all([
  fetch('photos.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  fetch('/api/descriptions', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(r.status)).catch(() => null),
  fetch('/api/photos', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => [])
]).then(([base, map, ups]) => {
  const list = base.concat(ups.map(toItem));
  list.forEach(it => { it.desc = (map && map[it.file]) || ''; });
  items = list.map((it, i) => makeCard(it, i));
  items.forEach(c => grid.append(c.el));
  updateStats(); applyFilter();
  if (!map) { editBtn.disabled = true; toast('Deskripsi tidak bisa dimuat dari database.'); }
}).catch(() => { et.textContent = 'Daftar foto tidak bisa dimuat'; es.textContent = 'Jalankan node build.mjs lalu deploy ulang.'; emptyEl.hidden = false; statsEl.textContent = ''; });
})();
