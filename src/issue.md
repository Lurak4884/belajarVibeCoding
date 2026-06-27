# Mock API Subscription Service

## Tujuan
Membuat mock API subscription service yang dapat diakses dari internet, menggunakan stack yang sudah ada di repository ini (ElysiaJS + Drizzle ORM + MySQL). API ini mensimulasikan alur subscription, check status, dan unsubscribe dengan mekanisme callback otomatis.

## Perubahan dari Versi Sebelumnya
- **Hapus** seluruh endpoint `/users` yang ada di `src/index.js`.
- **Hapus** tabel `users` dari `src/schema.js` dan migration lama di folder `drizzle/`.
- **Gantikan** dengan endpoint dan skema baru untuk subscription service.

## Database Schema

### Tabel: `subscriptions`

| Kolom           | Tipe          | Keterangan                                              |
|-----------------|---------------|---------------------------------------------------------|
| `id`            | serial (PK)   | Auto-increment primary key                              |
| `transactionId` | varchar(100)  | Unique, identifier transaksi dari pemanggil              |
| `msisdn`        | varchar(20)   | Nomor telepon pelanggan                                  |
| `productName`   | varchar(100)  | Nama produk/layanan yang di-subscribe                    |
| `status`        | enum          | Status subscription: `active`, `inactive`, `unsubscribe` |
| `createdAt`     | timestamp     | Waktu pembuatan subscription                             |
| `updatedAt`     | timestamp     | Waktu terakhir status diperbarui                         |

> **Catatan:** Field `transactionId` harus bersifat **unique** untuk mencegah duplikasi subscription.

## Status Lifecycle

```
[Request Masuk] → inactive → (callback pertama: inactive, jeda 30 detik) → active (callback kedua: active)
                                                                            ↓
                                                                     [Unsubscribe API] → unsubscribe
```

## Endpoint API

Semua endpoint menggunakan prefix `/api/v1/`.

---

### 1. POST `/api/v1/subscription`

**Deskripsi:** Menerima request subscription baru, menyimpan ke database, dan mengirimkan callback secara otomatis.

**Request Body (JSON):**
```json
{
  "transactionId": "TXN-20260627-001",
  "msisdn": "6281234567890",
  "productName": "Premium Package"
}
```

**Alur Proses:**
1. Validasi bahwa `transactionId` dan `msisdn` ada di request body.
2. Cek apakah `transactionId` sudah ada di database.
   - Jika sudah ada → tolak dengan error response.
   - Jika belum ada → lanjutkan.
3. Simpan data subscription ke database dengan status awal **`inactive`**.
4. Kirim response sukses ke pemanggil.
5. **Callback pertama (segera):** Kirim HTTP POST ke callback URL (dari environment variable `CALLBACK_URL`) dengan payload status `inactive`.
6. **Callback kedua (jeda 30 detik):** Update status di database menjadi **`active`**, lalu kirim HTTP POST ke callback URL dengan payload status `active`.

**Success Response (201):**
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "transactionId": "TXN-20260627-001",
    "msisdn": "6281234567890",
    "status": "inactive"
  }
}
```

**Error Response - Duplicate (409):**
```json
{
  "success": false,
  "message": "Subscription with this transactionId already exists"
}
```

**Error Response - Validation (400):**
```json
{
  "success": false,
  "message": "transactionId and msisdn are required"
}
```

**Callback Payload (JSON POST ke CALLBACK_URL):**
```json
{
  "transactionId": "TXN-20260627-001",
  "msisdn": "6281234567890",
  "productName": "Premium Package",
  "status": "inactive",
  "timestamp": "2026-06-27T10:30:00.000Z"
}
```
> Callback kedua (setelah 30 detik) memiliki payload yang sama namun dengan `status: "active"` dan timestamp yang diperbarui.

---

### 2. GET `/api/v1/subscription/status/:transactionId`

**Deskripsi:** Mengecek status subscription berdasarkan `transactionId` yang diberikan sebagai URL parameter.

**Contoh Request:**
```
GET /api/v1/subscription/status/TXN-20260627-001
```

**Alur Proses:**
1. Ambil `transactionId` dari URL parameter.
2. Query database untuk mencari subscription dengan `transactionId` tersebut.
   - Jika ditemukan → kembalikan data subscription.
   - Jika tidak ditemukan → kembalikan error 404.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "transactionId": "TXN-20260627-001",
    "msisdn": "6281234567890",
    "productName": "Premium Package",
    "status": "active",
    "createdAt": "2026-06-27T10:30:00.000Z",
    "updatedAt": "2026-06-27T10:30:30.000Z"
  }
}
```

**Error Response - Not Found (404):**
```json
{
  "success": false,
  "message": "Subscription not found"
}
```

---

### 3. POST `/api/v1/subscription/unsubscribe`

**Deskripsi:** Mengubah status subscription menjadi `unsubscribe` di database.

**Request Body (JSON):**
```json
{
  "transactionId": "TXN-20260627-001"
}
```

**Alur Proses:**
1. Validasi bahwa `transactionId` ada di request body.
2. Cari subscription di database berdasarkan `transactionId`.
   - Jika tidak ditemukan → kembalikan error 404.
   - Jika ditemukan → update status menjadi **`unsubscribe`** dan update `updatedAt`.
3. Kembalikan response sukses.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Subscription has been unsubscribed",
  "data": {
    "transactionId": "TXN-20260627-001",
    "status": "unsubscribe"
  }
}
```

**Error Response - Not Found (404):**
```json
{
  "success": false,
  "message": "Subscription not found"
}
```

**Error Response - Validation (400):**
```json
{
  "success": false,
  "message": "transactionId is required"
}
```

---

## Environment Variable

Tambahkan variabel berikut ke `.env` dan `.env.example`:

| Variabel        | Deskripsi                                           | Contoh                                                 |
|-----------------|-----------------------------------------------------|--------------------------------------------------------|
| `DATABASE_URL`  | Koneksi string MySQL (sudah ada)                     | `mysql://user:pass@host:3306/dbname`                   |
| `CALLBACK_URL`  | URL tujuan pengiriman callback setelah subscription  | `https://webhook.site/your-unique-id`                  |

## Perubahan File

| File                  | Aksi       | Keterangan                                              |
|-----------------------|------------|---------------------------------------------------------|
| `src/schema.js`       | **Modify** | Hapus tabel `users`, buat tabel `subscriptions`          |
| `src/index.js`        | **Modify** | Hapus endpoint `/users`, buat 3 endpoint subscription baru |
| `src/db.js`           | **Tetap**  | Tidak ada perubahan, koneksi database tetap sama          |
| `drizzle.config.js`   | **Tetap**  | Tidak ada perubahan                                      |
| `.env.example`        | **Modify** | Tambahkan `CALLBACK_URL`                                 |
| `drizzle/*`           | **Delete** | Hapus migration lama, generate ulang setelah schema baru |

## Catatan Implementasi
- Gunakan `setTimeout` (atau mekanisme delay sederhana) untuk mensimulasikan jeda 30 detik sebelum callback kedua dikirim.
- Callback dikirim menggunakan `fetch()` bawaan Bun ke `CALLBACK_URL` yang dikonfigurasi di environment variable.
- Tidak perlu mekanisme retry untuk callback; ini hanya mock server.
- Tetap gunakan JavaScript murni (`.js`), bukan TypeScript.
- Gunakan library yang sudah terinstal (Elysia, Drizzle ORM, mysql2). Tidak perlu install dependency tambahan.

## Kriteria Penerimaan
- Perintah `bun run dev` menjalankan server tanpa error.
- `POST /api/v1/subscription` menyimpan data ke database dan mengirim 2 callback (inactive segera, active setelah 30 detik).
- `POST /api/v1/subscription` dengan `transactionId` duplikat mengembalikan error 409.
- `GET /api/v1/subscription/status/:transactionId` mengembalikan status yang benar dari database.
- `POST /api/v1/subscription/unsubscribe` mengubah status menjadi `unsubscribe`.
- Tabel `users` lama sudah dihapus dari schema dan digantikan oleh tabel `subscriptions`.
