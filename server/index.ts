import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildApp } from './app.ts'
import { loadContent } from './content.ts'
import { openDb } from './db.ts'
import { serverModes } from './modes/registry.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const prod = process.env.NODE_ENV === 'production'

const app = await buildApp({
  db: openDb(process.env.DB_PATH ?? join(root, 'data/highlow.db')),
  modes: serverModes,
  puzzles: loadContent(join(root, 'content'), serverModes),
  clientDir: prod ? join(root, 'dist') : undefined,
  // Secure cookies need HTTPS in production (Caddy). Browsers also accept them on http://localhost.
  secureCookies: prod,
  logger: true,
})
// 8788 by default so it can run on the same machine as Blinker (8787).
await app.listen({ port: Number(process.env.PORT ?? 8788), host: process.env.HOST ?? '127.0.0.1' })
