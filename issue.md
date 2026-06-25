# Setup Project Backend (ElysiaJS + Drizzle + MySQL)

## Tujuan
Membuat fondasi proyek backend baru menggunakan Bun, framework ElysiaJS, dan Drizzle ORM dengan koneksi ke database MySQL, menggunakan JavaScript murni (tanpa TypeScript).

## Langkah-langkah Implementasi

1. **Inisialisasi Proyek**
   - Lakukan inisialisasi proyek baru dengan Bun (`bun init`) di direktori root.
   - Karena menggunakan JavaScript, hapus atau abaikan konfigurasi TypeScript (seperti `tsconfig.json`) jika dihasilkan secara otomatis.

2. **Instalasi Dependencies**
   - Install framework **ElysiaJS** beserta plugin standar yang dibutuhkan.
   - Install **Drizzle ORM** dan Drizzle Kit.
   - Install driver untuk koneksi ke **MySQL** (misalnya `mysql2`).

3. **Konfigurasi Database (Drizzle)**
   - Buat file konfigurasi Drizzle (`drizzle.config.js`).
   - Buat skema database dasar di `schema.js` untuk contoh tabel sederhana (misalnya tabel `users`).
   - Siapkan file koneksi database dan pastikan dapat terhubung ke MySQL menggunakan kredensial dari environment variables (`.env`).
   - Tambahkan script pada `package.json` untuk *generate* dan jalankan migrasi database.

4. **Setup Server ElysiaJS & Pembuatan Endpoint**
   - Buat file *entry point* utama (`src/index.js`).
   - Inisialisasi aplikasi ElysiaJS dan tentukan port untuk mendengarkan request.
   - Inject koneksi database Drizzle ke dalam router/konteks agar bisa diakses di berbagai *handler*.
   - Buat endpoint berikut:
     - `GET /` : Endpoint *health check* yang mengembalikan teks "Hello World".
     - `GET /users` : Mengambil dan merespons seluruh data dari tabel `users` di database.
     - `POST /users` : Endpoint untuk membuat/memasukkan data *user* baru ke tabel `users`.

## Catatan Implementasi (Implementation Notes)
- **Ekstensi File**: Seluruh file proyek harus menggunakan ekstensi `.js` (JavaScript) bukan `.ts`.
- **Package Type**: Pastikan konfigurasi `package.json` sudah mendukung format *ES Modules* jika diperlukan (misalnya dengan menambahkan `"type": "module"`), menyesuaikan standar eksekusi Bun dan Drizzle dalam JS.
- **Variabel Lingkungan**: Jangan pernah hardcode kredensial database di dalam *source code*. Kredensial MySQL (seperti host, username, password) harus diambil lewat `.env`.
- **Drizzle Tanpa TS**: Drizzle ORM dibangun dengan TypeScript-first, sehingga saat menggunakan JavaScript, manfaatkan *JSDoc* (opsional) untuk mempermudah pengecekan jika diperlukan oleh programmer yang mengimplementasikannya nanti.

## Kriteria Penerimaan (Acceptance Criteria)
- Perintah `bun run dev` (atau yang setara untuk menjalankan `src/index.js`) dapat menjalankan server lokal dengan lancar.
- Endpoint CRUD (`/users`) dapat dieksekusi dari aplikasi pihak ketiga (seperti Postman/cURL) dan perubahan ter-refleksi di dalam MySQL.
- Terdapat skema tabel Drizzle berformat `.js` yang sukses di-migrasi ke dalam database.
