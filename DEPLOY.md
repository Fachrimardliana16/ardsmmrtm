# Deploy ke Hostinger

Backend memakai **PHP 8.1+ + SQLite** secara default. Tidak perlu MySQL, Node.js,
npm, Composer, atau build step. MySQL masih didukung lewat `db.driver = 'mysql'`.

## 1. Upload file

Di hPanel Hostinger buka **Files → File Manager → public_html**, lalu upload isi project
sehingga strukturnya:

```
public_html/
├── index.html
├── about.html, jobs.html, ...   (semua halaman + css/ js/ assets/ uploads/)
├── admin/
│   ├── index.html               (console, butuh login)
│   └── login.html               (halaman sign in)
├── .htaccess                    (wajib)
└── api/
    ├── index.php
    ├── install.php
    ├── schema.sqlite.sql        (dipakai installer SQLite)
    ├── schema.sql               (hanya untuk mode MySQL)
    ├── config.example.php
    ├── config.php               (dibuat di langkah 3)
    ├── .htaccess
    ├── data/  routes/  src/
    └── storage/                 (harus bisa ditulis PHP)
```

Tidak perlu di-upload: `server/`, `node_modules/`, `.git/`, `_pages/`, `_partials/`,
`scripts/`, file `.md`, screenshot PNG, dan `pages.json`. `.htaccess` tetap memblokir
folder-folder itu kalau tidak sengaja ikut ter-upload.

Cara cepat: zip seluruh project, upload, extract di `public_html`, lalu hapus folder
yang tidak dipakai. Pastikan file `.htaccess` ikut (File Manager kadang menyembunyikan
file titik — aktifkan "Show hidden files").

**Jangan upload database lokal** dari `api/storage/`: `ardson.sqlite`,
`ardson.sqlite-wal`, `ardson.sqlite-shm`, dan `installed.lock`. Upload folder `storage`
dalam keadaan kosong (kecuali `.htaccess`). Kalau file database lokal ikut ter-upload,
installer akan menolak jalan dan data lokal bisa tercampur ke produksi.

## 2. Siapkan storage SQLite

Tidak ada database yang perlu dibuat di hPanel. Installer akan membuat
`api/storage/ardson.sqlite` otomatis.

Pastikan folder `api/storage` dan `api/storage/uploads` bisa ditulis oleh PHP. Di File
Manager klik kanan folder → **Permissions** → `755`. Kalau installer melaporkan tidak
bisa menulis, coba `775`. Jangan set `777`.

Untuk keamanan ekstra, database boleh diletakkan di luar `public_html`, misalnya:

```php
'path' => dirname(__DIR__, 2) . '/ardson-data/ardson.sqlite',
```

Folder tujuan harus ada dan bisa ditulis PHP. Default `api/storage/ardson.sqlite`
sudah aman karena `api/.htaccess` memblokir akses langsung ke folder itu.

### Opsional: MySQL

Kalau tetap ingin MySQL, buat database di hPanel → **Databases → MySQL Databases**,
lalu ubah blok `db` di `config.php`:

```php
'db' => [
    'driver' => 'mysql',
    'host' => 'localhost',
    'port' => 3306,
    'name' => 'u123456789_ardson',
    'user' => 'u123456789_ardson',
    'pass' => 'PASSWORD_DATABASE',
    'charset' => 'utf8mb4',
],
```

Installer otomatis memakai `schema.sql` untuk MySQL dan `schema.sqlite.sql` untuk
SQLite.

## 3. Konfigurasi

Di File Manager, copy `api/config.example.php` menjadi `api/config.php`, lalu edit:

```php
'db' => [
    'driver' => 'sqlite',
    'path' => __DIR__ . '/storage/ardson.sqlite',
],

'admin' => [
    'user' => 'admin@ardsonmaritime.com',
    // Pakai password_hash(), bukan plaintext.
    'password' => '$2y$12$...',
    // ...
],
```

Buat hash password admin dengan:

```bash
php -r "echo password_hash('PASSWORD_BARU', PASSWORD_BCRYPT), PHP_EOL;"
```

Tempel hasilnya ke `admin.password`. Login memakai user dan password itu, bukan
kredensial demo lama.

Lalu isi kunci enkripsi CV. Jalankan di terminal lokal:

```bash
php -r "echo bin2hex(random_bytes(32));"
```

Tempel hasil 64 karakter ke `security.cv_key`. **Simpan kunci ini** — tanpa kunci yang
sama, CV lama tidak bisa dibuka. Kalau dibiarkan kosong, CV disimpan tanpa enkripsi
(hanya untuk development).

Pengaturan opsional:

- `mail.host` — isi `smtp.hostinger.com`, `mail.user`, `mail.pass`, `mail.to` agar email
  notifikasi benar-benar terkirim. Kalau kosong, notifikasi hanya ditulis ke log.
- `whatsapp.token`, `phone_id`, `to` — untuk notifikasi WhatsApp.
- `security.virus_scan_strict` — biarkan `true`; kalau server tidak punya ClamAV,
  set `false` supaya upload CV tidak gagal. Di Hostinger shared, ClamAV biasanya tidak
  tersedia, jadi praktisnya `false` + validasi tipe file tetap aktif.
- `media.ffmpeg` — biarkan kosong; Hostinger umumnya menyediakan `ffmpeg` di PATH.

Set permission `api/config.php` ke `600` bila File Manager mendukung.

## 4. Jalankan installer (sekali saja)

Buka:

```
https://ardsonmaritime.com/api/install.php
```

Installer membuat tabel dari schema yang sesuai dan mengimpor konten demo asli (jobs,
seafarer, crew request, insight, user, role, log, backup). Kalau database sudah berisi
data, seed dilewati.

Setelah selesai, **hapus `api/install.php`**. Installer juga menolak jalan lagi selama
`api/storage/installed.lock` ada.

## 5. Setting PHP

hPanel → **Advanced → PHP Configuration**:

- PHP versi **8.2** atau **8.3** (minimal 8.1).
- Extension SQLite: `pdo_sqlite`, `sqlite3`. Untuk mode MySQL tambahkan `pdo_mysql`.
- Extension umum: `openssl`, `gd`, `fileinfo`, `curl`, `mbstring`, `json`.
- `upload_max_filesize` minimal `8M` (CV 5 MB) dan `post_max_size` minimal `10M`.
- Untuk upload video hero, naikkan `upload_max_filesize` dan `post_max_size` ke `64M`
  atau sesuai batas `uploads.max_media_bytes` (default 50 MB).
- `max_execution_time` minimal `120` untuk konversi video.

Aktifkan **SSL** di hPanel (Let's Encrypt), lalu arahkan HTTP ke HTTPS.

## 6. Verifikasi

1. `https://ardsonmaritime.com/` — halaman tampil.
2. `https://ardsonmaritime.com/api/v1/health` — `{"ok":true,...}`.
3. `https://ardsonmaritime.com/api/v1/jobs` — daftar lowongan.
4. `https://ardsonmaritime.com/admin/login.html` — login dengan user/password di
   `config.php`.
5. Coba submit form seafarer tanpa CV, lalu cek menu admin.

## Backup

Database SQLite adalah file biasa. Backup **ketiganya** saat situs aktif:

```
api/storage/ardson.sqlite
api/storage/ardson.sqlite-wal
api/storage/ardson.sqlite-shm
```

File `-wal` dan `-shm` bisa tidak ada. Menyalin hanya `ardson.sqlite` saat ada transaksi
berjalan bisa kehilangan data terbaru. Paling aman: pakai backup otomatis hPanel, atau
matikan sementara write lalu copy ketiga file. Backup JSON dari menu admin membackup
konten aplikasi, bukan seluruh file database.

## Yang berubah dari versi Node

- Data tidak lagi in-memory: semua entitas, setting, log, session admin, dan backup
  disimpan di SQLite (atau MySQL) sehingga aman untuk banyak PHP worker.
- Kontrak API (`/api/v1/...`), pesan, status code, dan perilaku rate limit dipertahankan.
- CV tetap dienkripsi AES-256-GCM dan hanya bisa diunduh lewat endpoint admin.
- `server/` (Express) tidak dipakai di hosting. Boleh dihapus dari paket upload, tapi
  simpan di repo lokal sebagai referensi.

## Troubleshooting

- **"Database unavailable"** — untuk SQLite, cek `pdo_sqlite` aktif dan folder
  `api/storage` writable. Cek juga `db.path` di `api/config.php`. Untuk MySQL, cek
  `db.host`, `db.name`, `db.user`, dan `db.pass`.
- **Installer: "unable to open database file"** — folder database tidak ada atau tidak
  bisa ditulis PHP. Buat folder dan set permission `755`/`775`.
- **404 di semua `/api/...`** — `.htaccess` api tidak ter-upload atau `mod_rewrite`
  nonaktif. Hubungi support Hostinger bila perlu.
- **Klik Admin malah kembali ke halaman utama / login tidak muncul** — pastikan folder
  `admin/` ikut ter-upload (`admin/login.html` dan `admin/index.html`). Kalau halaman
  login terbuka tapi langsung pindah, hapus token lama di tab itu lewat DevTools:
  `sessionStorage.removeItem('ardson_admin_token')`, atau buka mode Incognito.
- **Upload gagal "File too large"** — naikkan `upload_max_filesize`/`post_max_size`.
- **CV tidak bisa dibuka** — `security.cv_key` berbeda dari saat upload. Kembalikan
  kunci lama.
- **Notifikasi tidak masuk** — isi konfigurasi `mail` atau `whatsapp`; tanpa itu
  notifikasi hanya masuk `api/storage/logs/app.log`.
