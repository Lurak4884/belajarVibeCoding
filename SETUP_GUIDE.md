# Panduan Setup Service Mock API & Callback (ElysiaJS + Drizzle + PostgreSQL)

Dokumen ini berisi arsitektur dan langkah-langkah untuk merekonstruksi service API serupa dengan database cloud PostgreSQL dan integrasi callback asynchronous.

## 1. Stack Teknologi & Prasyarat
- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [ElysiaJS](https://elysiajs.com)
- **Database ORM**: [Drizzle ORM](https://orm.drizzle.team)
- **Database Driver**: `postgres` (PostgreSQL client)
- **Hosting / Deploy Target**: Render.com (menggunakan Docker)

---

## 2. Struktur Proyek
```text
├── src/
│   ├── db.js          # Inisialisasi koneksi PostgreSQL & Drizzle
│   ├── schema.js      # Definisi skema tabel database (Drizzle)
│   └── index.js       # ElysiaJS routing, Auth, & Logika Bisnis
├── Dockerfile         # Konfigurasi containerization untuk cloud deployment
├── drizzle.config.js  # Konfigurasi sync schema Drizzle
├── package.json       # Dependencies dan scripts
└── .env               # Environment variables lokal
```

---

## 3. Langkah Rekonstruksi & Setup

### Langkah A: Inisialisasi Proyek & Dependencies
Jalankan perintah berikut untuk menginisialisasi proyek Node/Bun baru:
```bash
bun init
bun add elysia drizzle-orm postgres
bun add -d drizzle-kit
```

### Langkah B: Konfigurasi Drizzle (`drizzle.config.js`)
Buat konfigurasi sinkronisasi skema ke database:
```javascript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://localhost:5432/mydb',
  },
});
```

### Langkah C: Skema Tabel (`src/schema.js`)
Definisikan tabel `subscriptions` menggunakan Drizzle PostgreSQL core:
```javascript
import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  partnerSubscriptionId: varchar('partner_subscription_id', { length: 255 }).notNull().unique(),
  referenceId: varchar('reference_id', { length: 255 }).notNull(),
  msisdn: varchar('msisdn', { length: 20 }).notNull().unique(),
  productName: varchar('product_name', { length: 255 }),
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('pending').notNull(),
  createdAt: timestamp('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});
```

### Langkah D: Koneksi Database (`src/db.js`)
Buat file inisialisasi koneksi dengan penanganan environment variable:
```javascript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not set!");
}

const client = postgres(connectionString || 'postgres://localhost:5432/mydb', {
  prepare: false
});

export const db = drizzle(client, { schema });
```

### Langkah E: Menulis Logika API & Callback (`src/index.js`)
Gunakan ElysiaJS untuk menangani *request* dan *middleware* Basic Auth. Contoh penanganan Basic Auth:
```javascript
const checkAuth = ({ headers, set }) => {
  const authHeader = headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    set.status = 401;
    return { status: "Not OK", message: "Unauthorized" };
  }
  const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('ascii');
  const [clientId, clientKey] = credentials.split(':');
  
  if (clientId !== process.env.AUTH_CLIENT_ID || clientKey !== process.env.AUTH_CLIENT_KEY) {
    set.status = 401;
    return { status: "Not OK", message: "Unauthorized" };
  }
};
```
Gunakan port dinamis untuk deployment cloud:
```javascript
app.listen(process.env.PORT || 8080);
```

Untuk alur *asynchronous* callback (Pending -> Inactive -> Active), gunakan `setTimeout` yang memicu pembaruan status database menggunakan objek `Date` asli (bukan `.toISOString()`) dan mengirim payload JSON ke `CALLBACK_URL` partner.

---

## 4. Konfigurasi Deployment (Docker)
Buat file `Dockerfile` berikut di root direktori Anda:
```dockerfile
FROM oven/bun:1 as base
WORKDIR /usr/src/app

COPY package.json bun.lock* ./
RUN bun install

COPY . .

EXPOSE 8080

CMD ["bun", "run", "start"]
```

Di `package.json`, atur skrip start agar otomatis melakukan migrasi skema saat server menyala di cloud:
```json
"scripts": {
  "start": "bun run db:push && bun src/index.js",
  "db:push": "drizzle-kit push"
}
```

---

## 5. Deployment ke Render.com
1. Hubungkan GitHub Anda ke Render.com.
2. Buat layanan **PostgreSQL** gratis dan salin **Internal Database URL**-nya.
3. Buat **Web Service**, hubungkan ke repositori Anda, pilih runtime **Docker**, dan buat dengan jenis *instance* **Free**.
4. Di tab **Environment**, masukkan variabel berikut:
   - `DATABASE_URL` (dari PostgreSQL Render)
   - `CALLBACK_URL` (URL Webhook tujuan milik partner, misal dari Webhook.site)
   - `AUTH_CLIENT_ID` & `AUTH_CLIENT_KEY` (Kredensial Basic Auth API Anda)
   - variabel delay callback jika dibutuhkan (`CALLBACK_DELAY_INACTIVE`, dll)
