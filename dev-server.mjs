// ============================================================
//  SESDIAN - local dev server (no Vercel CLI required).
//  Same server as production (server.mjs), started in dev mode so static
//  assets are never cached and API errors report their real message.
//
//  Usage:  cp .env.example .env.local  (fill DATABASE_URL + JWT_SECRET)
//          npm install
//          npm run dev      ->  http://localhost:3000
// ============================================================
import { startServer } from './server.mjs';

startServer({ dev: true });
