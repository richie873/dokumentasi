# Dokumentasi Pekerjaan (foto di folder, deskripsi di Neon)

Foto ada di folder `public/photos/`. Database Neon hanya menyimpan deskripsi (satu tabel, dibuat otomatis).

```
public/photos/        foto (urutan mengikuti nama file)
api/descriptions.js   API kecil: baca dan simpan deskripsi ke Neon
build.mjs             membuat daftar foto saat build
```

## Pasang (sekitar 10 menit)
1. Taruh folder ini di GitHub, lalu di Vercel: **Add New > Project**, pilih repositori, **Deploy** dengan pengaturan bawaan.
2. Di proyek Vercel: **Storage > Create Database > Neon** (paket gratis), hubungkan ke proyek. Vercel otomatis mengisi variabel `DATABASE_URL`.
3. (Disarankan) **Settings > Environment Variables**: tambah `EDIT_PASSWORD` berisi kata sandi untuk tim.
4. **Deployments > Redeploy** agar variabel terbaca.

Tabel `descriptions` dibuat otomatis saat halaman pertama kali dibuka.

## Pemakaian
- Semua orang yang punya alamat bisa melihat foto dan deskripsi.
- Klik **Edit deskripsi**, ketik di bawah foto, tersimpan otomatis dan langsung terlihat oleh semua orang. Bila `EDIT_PASSWORD` diisi, kata sandi ditanya sekali per browser.
- Menambah foto: salin ke `public/photos/` (lanjutkan nomornya: `80.jpg`, `81.jpg`, ...), lalu push ke GitHub. Foto baru muncul otomatis.

## Catatan
- Siapa pun yang tahu alamat bisa melihat foto. Tanpa `EDIT_PASSWORD`, siapa pun juga bisa mengubah deskripsi.
- Bila dua orang mengedit foto yang sama bersamaan, yang terakhir menyimpan yang dipakai.
- Kecilkan foto ke lebar sekitar 2000 px sebelum diunggah. Batas ukuran deploy Vercel belum saya pastikan, cek dokumentasinya sebelum mengunggah 200 foto.
- Neon gratis menghentikan database saat tidak dipakai. Pembukaan pertama setelah lama bisa terasa lambat beberapa detik, datanya tetap ada.
- Saya mengujinya dengan database tiruan, belum dengan Neon sungguhan.

## Menjalankan di komputer sendiri
Butuh Node.js 18 atau lebih baru.
```
npm install
npm run dev
```
Lalu buka http://localhost:3000. Jangan membuka `index.html` langsung atau memakai server statis lain, karena `/api/descriptions` tidak ada di sana.
- Tanpa pengaturan apa pun, deskripsi disimpan di file `.dev-deskripsi.json` (hanya untuk mencoba).
- Untuk memakai Neon sungguhan: salin `DATABASE_URL` dari dashboard Neon (atau Vercel > Storage) ke file `.env.local` berisi `DATABASE_URL=postgres://...`. `EDIT_PASSWORD=...` juga bisa ditaruh di file yang sama.
