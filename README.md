# ALYZ xBUGz — Demo Dashboard

Public web berbasis HTML, CSS, JavaScript modular dan Firebase. Fitur sender serta modul PRANK BUG di project ini **hanya simulasi UI lokal**. Tidak ada integrasi WhatsApp Web, pairing WhatsApp asli, pengiriman bug, atau pengiriman pesan ke nomor yang dimasukkan.

## Fitur
- Layar fingerprint tekan-tahan 0–100% (animasi UI).
- Login username/password dengan Firebase Authentication.
- Pengajuan akses FULL UP, RESSELER, OWNER.
- ACC/TOLAK order oleh admin.
- Chat admin real-time dengan Firestore dan unggah gambar ke Firebase Storage.
- Dashboard Home, Sender simulasi, Profil, AI ALYZ (navigasi lokal), Order admin.
- Video background dan dashboard dari folder `media/`.
- Layout responsif mobile/desktop.

## 1. Buat Firebase project
1. Buat project di https://console.firebase.google.com/
2. Tambahkan aplikasi Web.
3. Aktifkan **Authentication → Sign-in method → Email/Password**.
4. Buat **Cloud Firestore** dalam production mode.
5. Aktifkan **Storage**.
6. Salin konfigurasi Web Firebase ke `firebaseconfig.json`.
7. Deploy rules:
   - Firestore: isi dari `firebase/firestore.rules`.
   - Storage: isi dari `firebase/storage.rules`.

`firebaseconfig.json` adalah konfigurasi publik aplikasi web, bukan tempat menyimpan password admin atau private key. Batasi domain aplikasi di Firebase Authentication → Settings → Authorized domains.

## 2. Buat admin pertama
1. Daftarkan satu akun melalui halaman pengajuan (gunakan username khusus admin).
2. Di Firebase Console → Authentication → Users, salin UID akun tersebut.
3. Di Firestore buat koleksi `admins`, lalu dokumen dengan ID persis UID tadi.
4. Isi field `active: true` dan `label: "ALYZ Admin"`.
5. Buat dokumen `users/{UID}` dengan field:
   - `username`: username admin
   - `displayName`: `Alyz`
   - `role`: `ADMIN`
   - `status`: `active`
   - `createdAt`: timestamp
6. Admin sekarang dapat membuka menu ORDER.

Penting: dokumen `admins/{uid}` hanya boleh dibuat manual oleh pemilik project melalui Firebase Console. Rules melarang pembuatan admin dari browser.

## 3. Jalankan project
Karena JavaScript memakai ES Modules, jalankan lewat local web server, jangan membuka `index.html` dengan `file://`.

Contoh:
- VS Code: ekstensi Live Server.
- Node.js: `npx serve .`
- Python: `python -m http.server 8000`

Lalu buka alamat local server di browser.

## 4. Media
Ganti file berikut dengan media milik sendiri:
- `media/animasi.mp4` — background halaman fingerprint/login.
- `media/alyz.mp4` — video dashboard rasio 16:9.
- `media/profile.png` — gambar avatar default.

Browser dapat memutar file video lokal tanpa internet setelah file tersedia di perangkat/server, tetapi autoplay umumnya harus muted. Google Fonts memerlukan internet; fallback sistem tetap digunakan jika offline.

## 5. Alur pengguna
1. Pengguna menekan dan menahan fingerprint untuk masuk ke halaman login.
2. Pengguna memilih BELI AKSES, memilih role, lalu membuat username/password.
3. Aplikasi membuat akun Firebase Auth dan mengirim order pending.
4. Admin memeriksa di ORDER → ACC ORDER, lalu TERIMA atau TOLAK.
5. Jika diterima, role pengguna aktif. Pengguna login kembali.
6. Pengguna dapat chat admin melalui Firestore.

### Catatan upgrade role
Tampilan upgrade disediakan sebagai pengajuan order baru. Penetapan harga potongan upgrade harus diperiksa admin; jangan menganggap pembayaran otomatis terverifikasi. Untuk sistem pembayaran otomatis, integrasikan payment gateway resmi di backend tepercaya.

## 6. Konfigurasi tambahan
Edit `app.js` untuk:
- `CHANNEL_URL`: tautan saluran WhatsApp resmi.
- `ADMIN_WA`: nomor kontak admin format internasional tanpa tanda `+`.
- Harga role dan teks UI.

## Keamanan & batasan
- Jangan pernah memasukkan service account private key ke frontend.
- Jangan menonaktifkan Firestore/Storage Rules untuk membuat aplikasi “berhasil”.
- Username dikonversi menjadi alamat email internal `username@alyz.local`; pengguna tetap login dengan username pada UI.
- Password dikelola Firebase Authentication, bukan disimpan di Firestore.
- Sistem chat memerlukan internet dan konfigurasi Firebase yang valid.
- Presence sederhana diperbarui saat sesi aktif; untuk produksi, gunakan Cloud Functions/Realtime Database presence dengan validasi server.
- Demo sender tidak membuat koneksi WhatsApp dan tidak mengirim apa pun.
- Modul demo PRANK BUG hanya countdown visual lokal dan tidak berinteraksi dengan nomor telepon.


## 7. Admin credentials via Vercel Environment Variables

Admin login is verified server-side by `api/admin-login.js`; the admin password is never bundled into browser JavaScript.

Add these variables in **Vercel → Project → Settings → Environment Variables**:

- `USERNAME_APP` — admin username.
- `PASSWORD_APP` — a long, unique admin password.
- `FIREBASE_SERVICE_ACCOUNT_JSON` — complete Firebase service-account JSON, stored as one JSON string.

The service account is required because the Vercel API uses Firebase Admin SDK to provision the admin Auth user, assign admin custom claims, and create the protected `admins/{uid}` document. Generate it in Firebase Console → Project settings → Service accounts. Keep it private; never put it in `firebaseconfig.json`, `app.js`, or a public repository.

After adding variables, redeploy the Vercel project. Install dependencies with `npm install` (Vercel installs from `package.json` automatically).

For security, use a strong unique password and rotate it if it has been shared in chat, screenshots, source control, or logs. Do not reuse an everyday password.
