import { Elysia } from 'elysia';
import { db } from './db.js';
import { users } from './schema.js';

const app = new Elysia()
  .get('/', () => 'Hello World')
  .get('/users', async () => {
    try {
      return await db.select().from(users);
    } catch (error) {
      return { error: error.message };
    }
  })
  .post('/users', async ({ body, set }) => {
    try {
      if (!body || !body.name || !body.email) {
        set.status = 400;
        return { error: 'Name and email are required' };
      }
      await db.insert(users).values({
        name: body.name,
        email: body.email,
      });
      set.status = 210; // Custom success status or 201
      set.status = 201;
      return { success: true, message: 'User created successfully' };
    } catch (error) {
      set.status = 500;
      return { error: error.message };
    }
  })
  .listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
