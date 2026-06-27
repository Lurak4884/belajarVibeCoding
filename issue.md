# Mock API Subscription Service (v2)

## Tujuan
Membuat mock API subscription service yang dapat diakses dari internet, menggunakan stack yang sudah ada di repository ini (ElysiaJS + Drizzle ORM + MySQL). API ini mensimulasikan alur subscription, check status, dan unsubscribe dengan mekanisme callback otomatis.

## Perubahan dari Versi Sebelumnya
- **Hapus** seluruh endpoint `/users` yang ada di `src/index.js`.
- **Hapus** tabel `users` dari `src/schema.js` dan migration lama di folder `drizzle/`.
- **Gantikan** dengan endpoint dan skema baru untuk subscription service.

## Database Schema

### Tabel: `subscriptions`

| Kolom                    | Tipe          | Keterangan                                                            |
|--------------------------|---------------|-----------------------------------------------------------------------|
| `id`                     | serial (PK)   | Auto-increment primary key                                            |
| `partnerSubscriptionId`  | varchar(100)  | Unique, transactionId dari request partner, disimpan dengan nama ini   |
| `referenceId`            | varchar(36)   | UUID yang di-generate oleh aplikasi sebagai referensi internal         |
| `msisdn`                 | varchar(20)   | Unique, nomor telepon pelanggan                                        |
| `productName`            | varchar(100)  | Nama produk/layanan yang di-subscribe                                  |
| `subscriptionStatus`     | enum          | Status: `pending`, `inactive`, `active`, `unsubscribe`                 |
| `createdAt`              | timestamp     | Waktu pembuatan subscription                                           |
| `updatedAt`              | timestamp     | Waktu terakhir status diperbarui                                       |

> **Catatan:**
> - Field `partnerSubscriptionId` harus bersifat **unique** untuk mencegah duplikasi.
> - Field `msisdn` harus bersifat **unique** — satu nomor hanya boleh memiliki satu subscription aktif.
> - Field `referenceId` di-generate oleh aplikasi dalam format **UUID**.

## Subscription Status Lifecycle

```
[Request Masuk] → pending (tersimpan di DB, sync response: status OK)
      ↓ (jeda CALLBACK_DELAY_INACTIVE, default 2 detik)
  inactive (update DB, callback pertama dikirim: subscriptionStatus = inactive)
      ↓ (jeda CALLBACK_DELAY_ACTIVE, default 30 detik)
  active (update DB, callback kedua dikirim: subscriptionStatus = active)
      ↓
  [Unsubscribe API] → sync response: status OK
      ↓ (jeda CALLBACK_DELAY_UNSUBSCRIBE)
  unsubscribe (update DB, callback dikirim: subscriptionStatus = unsubscribe)
```

## Autentikasi

Semua endpoint API (subscribe, check status, unsubscribe) memerlukan **Basic Authentication** pada header request.

**Format Header:**
```
Authorization: Basic Base64(AUTH_CLIENT_ID:AUTH_CLIENT_KEY)
```

- `AUTH_CLIENT_ID` dan `AUTH_CLIENT_KEY` dikonfigurasi melalui environment variable.
- Jika header `Authorization` tidak ada atau credential tidak valid, API mengembalikan response **401 Unauthorized**:
```json
{
  "status": "Not OK",
  "message": "Unauthorized: Invalid credentials"
}
```

> **Catatan:** Basic auth hanya diterapkan pada request masuk ke API mock server. Callback keluar ke `CALLBACK_URL` **tidak** menggunakan auth.

## Endpoint API

Semua endpoint menggunakan prefix `/api/v1/`.

---

### 1. POST `/api/v1/subscription`

**Deskripsi:** Menerima request subscription baru, menyimpan ke database, dan mengirimkan callback secara otomatis.

**Request Header:**
```
Authorization: Basic Base64(clientId:clientKey)
Content-Type: application/json
```

**Request Body (JSON):**
```json
{
  "transactionId": "TXN-20260627-001",
  "msisdn": "6281234567890",
  "productName": "Premium Package"
}
```

**Alur Proses:**
1. Validasi Basic Auth pada header.
2. Validasi bahwa `transactionId` dan `msisdn` ada di request body.
3. Cek apakah `transactionId` (sebagai `partnerSubscriptionId`) **atau** `msisdn` sudah ada di database.
   - Jika salah satu sudah ada → tolak dengan error response.
   - Jika keduanya belum ada → lanjutkan.
4. Generate `referenceId` baru (UUID).
5. Simpan data subscription ke database dengan `subscriptionStatus` = **`pending`**.
6. Kirim sync response ke pemanggil dengan `status: "OK"`.
7. **Callback pertama (jeda `CALLBACK_DELAY_INACTIVE`, default 2 detik):** Update `subscriptionStatus` di database menjadi **`inactive`**, lalu kirim HTTP POST ke `CALLBACK_URL` dengan payload `subscriptionStatus: "inactive"`.
8. **Callback kedua (jeda `CALLBACK_DELAY_ACTIVE`, default 30 detik setelah callback pertama):** Update `subscriptionStatus` di database menjadi **`active`**, lalu kirim HTTP POST ke `CALLBACK_URL` dengan payload `subscriptionStatus: "active"`.

**Success Response (201):**
```json
{
  "status": "OK",
  "message": "Subscription created successfully",
  "data": {
    "partnerSubscriptionId": "TXN-20260627-001",
    "referenceId": "550e8400-e29b-41d4-a716-446655440000",
    "msisdn": "6281234567890"
  }
}
```

**Error Response - Duplicate transactionId atau msisdn (409):**
```json
{
  "status": "Not OK",
  "message": "Subscription with this transactionId or msisdn already exists"
}
```

**Error Response - Validation (400):**
```json
{
  "status": "Not OK",
  "message": "transactionId and msisdn are required"
}
```

**Callback Payload (JSON POST ke CALLBACK_URL, tanpa auth):**
```json
{
  "partnerSubscriptionId": "TXN-20260627-001",
  "referenceId": "550e8400-e29b-41d4-a716-446655440000",
  "msisdn": "6281234567890",
  "productName": "Premium Package",
  "subscriptionStatus": "inactive",
  "timestamp": "2026-06-27T10:30:02.000Z"
}
```
> Callback kedua memiliki payload yang sama namun dengan `subscriptionStatus: "active"` dan `timestamp` yang diperbarui.

---

### 2. POST `/api/v1/subscription/check-status`

**Deskripsi:** Mengecek status subscription berdasarkan `transactionId` dan `msisdn` yang dikirim di request body.

**Request Header:**
```
Authorization: Basic Base64(clientId:clientKey)
Content-Type: application/json
```

**Request Body (JSON):**
```json
{
  "transactionId": "TXN-20260627-001",
  "msisdn": "6281234567890"
}
```

**Alur Proses:**
1. Validasi Basic Auth pada header.
2. Validasi bahwa `transactionId` dan `msisdn` ada di request body.
3. Translasikan `transactionId` sebagai `partnerSubscriptionId`.
4. Query database untuk mencari subscription dengan `partnerSubscriptionId` **dan** `msisdn` yang cocok.
   - Jika ditemukan → kembalikan data subscription.
   - Jika tidak ditemukan → kembalikan error 404.

**Success Response (200):**
```json
{
  "status": "OK",
  "data": {
    "partnerSubscriptionId": "TXN-20260627-001",
    "referenceId": "550e8400-e29b-41d4-a716-446655440000",
    "msisdn": "6281234567890",
    "productName": "Premium Package",
    "subscriptionStatus": "active",
    "createdAt": "2026-06-27T10:30:00.000Z",
    "updatedAt": "2026-06-27T10:30:30.000Z"
  }
}
```

**Error Response - Not Found (404):**
```json
{
  "status": "Not OK",
  "message": "Subscription not found"
}
```

**Error Response - Validation (400):**
```json
{
  "status": "Not OK",
  "message": "transactionId and msisdn are required"
}
```

---

### 3. POST `/api/v1/subscription/unsubscribe`

**Deskripsi:** Mengirim response sync dengan `status: "OK"`, kemudian mengupdate status di database menjadi `unsubscribe` dan mengirimkan callback setelah delay.

**Request Header:**
```
Authorization: Basic Base64(clientId:clientKey)
Content-Type: application/json
```

**Request Body (JSON):**
```json
{
  "transactionId": "TXN-20260627-001",
  "msisdn": "6281234567890"
}
```

**Alur Proses:**
1. Validasi Basic Auth pada header.
2. Validasi bahwa `transactionId` dan `msisdn` ada di request body.
3. Translasikan `transactionId` sebagai `partnerSubscriptionId`.
4. Cari subscription di database berdasarkan `partnerSubscriptionId` **dan** `msisdn`.
   - Jika tidak ditemukan → kembalikan error 404.
   - Jika ditemukan → kirim sync response `status: "OK"`.
5. **Callback (jeda `CALLBACK_DELAY_UNSUBSCRIBE`):** Update `subscriptionStatus` di database menjadi **`unsubscribe`**, lalu kirim HTTP POST ke `CALLBACK_URL` dengan payload `subscriptionStatus: "unsubscribe"`.

**Success Response (200):**
```json
{
  "status": "OK",
  "message": "In Progress for unsubscription",
  "data": {
    "partnerSubscriptionId": "TXN-20260627-001",
    "referenceId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Error Response - Not Found (404):**
```json
{
  "status": "Not OK",
  "message": "Subscription not found"
}
```

**Error Response - Validation (400):**
```json
{
  "status": "Not OK",
  "message": "transactionId and msisdn are required"
}
```

**Callback Payload Unsubscribe (JSON POST ke CALLBACK_URL, tanpa auth):**
```json
{
  "partnerSubscriptionId": "TXN-20260627-001",
  "referenceId": "550e8400-e29b-41d4-a716-446655440000",
  "msisdn": "6281234567890",
  "productName": "Premium Package",
  "subscriptionStatus": "unsubscribe",
  "timestamp": "2026-06-27T11:00:05.000Z"
}
```

---

## Environment Variable

Tambahkan variabel berikut ke `.env` dan `.env.example`:

| Variabel                     | Deskripsi                                                    | Contoh                                                 |
|------------------------------|--------------------------------------------------------------|--------------------------------------------------------|
| `DATABASE_URL`               | Koneksi string MySQL (sudah ada)                              | `mysql://user:pass@host:3306/dbname`                   |
| `CALLBACK_URL`               | URL tujuan pengiriman callback                                | `https://webhook.site/your-unique-id`                  |
| `CALLBACK_DELAY_INACTIVE`    | Delay (ms) sebelum callback inactive dikirim                  | `2000`                                                 |
| `CALLBACK_DELAY_ACTIVE`      | Delay (ms) sebelum callback active dikirim (setelah inactive) | `30000`                                                |
| `CALLBACK_DELAY_UNSUBSCRIBE` | Delay (ms) sebelum callback unsubscribe dikirim               | `5000`                                                 |
| `AUTH_CLIENT_ID`             | Client ID untuk Basic Authentication                          | `mockClientId`                                         |
| `AUTH_CLIENT_KEY`            | Client Key/Secret untuk Basic Authentication                  | `mockClientSecret`                                     |

## Perubahan File

| File                  | Aksi       | Keterangan                                                                            |
|-----------------------|------------|---------------------------------------------------------------------------------------|
| `src/schema.js`       | **Modify** | Hapus tabel `users`, buat tabel `subscriptions` dengan kolom baru                      |
| `src/index.js`        | **Modify** | Hapus endpoint `/users`, buat 3 endpoint subscription baru + middleware basic auth     |
| `src/db.js`           | **Tetap**  | Tidak ada perubahan, koneksi database tetap sama                                       |
| `drizzle.config.js`   | **Tetap**  | Tidak ada perubahan                                                                    |
| `.env.example`        | **Modify** | Tambahkan `CALLBACK_URL`, delay variables, dan auth variables                          |
| `drizzle/*`           | **Delete** | Hapus migration lama, generate ulang setelah schema baru                               |

## Catatan Implementasi
- Gunakan `setTimeout` untuk mensimulasikan jeda callback. Nilai delay diambil dari environment variable (`CALLBACK_DELAY_INACTIVE`, `CALLBACK_DELAY_ACTIVE`, `CALLBACK_DELAY_UNSUBSCRIBE`).
- Callback dikirim menggunakan `fetch()` bawaan Bun ke `CALLBACK_URL`. Callback **tidak** menggunakan auth header.
- `referenceId` di-generate menggunakan `crypto.randomUUID()` bawaan Bun/Node.
- `transactionId` dari request disimpan di database sebagai `partnerSubscriptionId`.
- Basic Auth middleware memeriksa header `Authorization` dan mencocokkan dengan `AUTH_CLIENT_ID` dan `AUTH_CLIENT_KEY` dari env.
- Tidak perlu mekanisme retry untuk callback; ini hanya mock server.
- Tetap gunakan JavaScript murni (`.js`), bukan TypeScript.
- Gunakan library yang sudah terinstal (Elysia, Drizzle ORM, mysql2). Tidak perlu install dependency tambahan.

## Kriteria Penerimaan
- Perintah `bun run dev` menjalankan server tanpa error.
- Request tanpa Basic Auth atau dengan credential salah mengembalikan 401.
- `POST /api/v1/subscription` menyimpan data dengan `subscriptionStatus: pending`, lalu mengirim 2 callback (inactive setelah `CALLBACK_DELAY_INACTIVE`, active setelah `CALLBACK_DELAY_ACTIVE`).
- `POST /api/v1/subscription` dengan `transactionId` atau `msisdn` duplikat mengembalikan error 409.
- `POST /api/v1/subscription/check-status` mengembalikan data subscription yang benar beserta `referenceId`.
- `POST /api/v1/subscription/unsubscribe` mengembalikan `{ "status": "OK" }` secara sync, lalu mengirim callback unsubscribe setelah delay.
- Semua response menggunakan format `status: "OK"` atau `status: "Not OK"` (bukan `success: true/false`).
- Tabel `users` lama sudah dihapus dari schema dan digantikan oleh tabel `subscriptions`.
