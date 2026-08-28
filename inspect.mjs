import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query('select id, slug, url, "ownerKey", "createdAt" from "Link"');
console.table(r.rows);
await c.end();
