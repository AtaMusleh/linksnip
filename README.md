# LinkSnip

A URL shortener with per-link click analytics — no account required.

![demo](./demo.gif)

**Live demo:** https://linksnip-vert.vercel.app

## Features

- Shorten any `http`/`https` URL to a 7-character slug
- Optional custom slug (3–32 characters) and optional expiry date
- Per-link analytics: total clicks, a 30-day clicks-over-time chart, and a referrer breakdown
- QR code for any short link, downloadable as a PNG
- Dashboard scoped to the visitor's browser via an httpOnly cookie — no sign-up, no password
- Expired links return `410 Gone` instead of silently breaking
- Rate limited to 10 link creations per hour per visitor
- Light and dark themes, responsive from 375px

## Tech Stack

**Frontend**
- Next.js 16 (App Router, React Server Components) with React 19 and the React Compiler
- TypeScript in strict mode, no `any`
- Tailwind CSS v4 with shadcn/ui components on Radix primitives
- Recharts for the clicks chart, `qrcode.react` for QR generation
- `next-themes` for light/dark, `sonner` for toasts, `lucide-react` for icons

**Backend**
- Next.js Route Handlers for the JSON API and the redirect
- Zod for validation, shared verbatim between client and server
- `nanoid` for slug generation, `@paralleldrive/cuid2` for the anonymous owner key

**Database**
- PostgreSQL on Neon
- Prisma 7 with the `@prisma/adapter-pg` driver adapter

**Deployment**
- Vercel. Country data comes from the `x-vercel-ip-country` header that the platform attaches at the edge.

## Database Schema

```prisma
model Link {
  id        String    @id @default(cuid())
  slug      String    @unique
  url       String
  ownerKey  String
  createdAt DateTime  @default(now())
  expiresAt DateTime?
  clicks    Click[]

  @@index([ownerKey])
}

model Click {
  id        String   @id @default(cuid())
  linkId    String
  link      Link     @relation(fields: [linkId], references: [id], onDelete: Cascade)
  clickedAt DateTime @default(now())
  referrer  String?
  country   String?

  @@index([linkId, clickedAt])
}
```

`ownerKey` is an opaque cuid stored in an httpOnly cookie. It scopes the dashboard to one browser without authentication, and because the cookie is httpOnly, no client script can read or forge another visitor's key. Deleting a link cascades to its clicks.

## Architecture

### The redirect flow

`src/app/[slug]/route.ts` is the hot path — every visit to a short link runs it.

1. Look up the link by `slug` (a single indexed query).
2. Unknown slug → redirect to `/not-found`.
3. `expiresAt` in the past → `410 Gone` with a readable message. `410` rather than `404` because the link genuinely existed and is deliberately finished, which also tells crawlers to drop it rather than retry.
4. Otherwise, read `referer` and `x-vercel-ip-country` from the request headers, schedule the click insert, and return a `302` to the target URL.

Everything after the lookup is designed so that analytics can fail without the redirect failing. The click insert is wrapped in `try`/`catch` that swallows errors: a lost click is strictly better than a broken link.

### Why click recording uses `after()`, not a floating promise

The obvious way to record a click without blocking the redirect is to fire the insert and not await it:

```ts
void prisma.click.create({ data: { ... } }); // don't do this
```

On a serverless platform this silently loses writes. The invocation can be frozen the moment the response is sent, so a promise still in flight may never resume — the redirect succeeds and the click disappears, with nothing in the logs to explain it. The failure is invisible and load-dependent, which makes it hard to notice and harder to reproduce.

Next.js provides `after()` for exactly this: work scheduled with it runs *after* the response is flushed, and the platform keeps the invocation alive until it finishes.

```ts
after(async () => {
  try {
    await prisma.click.create({ data: { linkId: link.id, referrer, country } });
  } catch {
    // A lost click must never surface as a broken redirect.
  }
});
```

The visitor still waits on nothing, but the write is actually guaranteed a chance to complete. Headers are read *before* the callback, since the request is no longer available inside it.

### Why 302, not 301

A `301 Moved Permanently` is cached aggressively by browsers, often indefinitely and without revalidation. After a visitor's first click, their browser would jump straight to the destination and never hit the server again — so every later click from that browser goes uncounted. For a shortener whose entire value is the click data, a `301` quietly corrupts the numbers, and the more popular a link is the more wrong they get.

`301` is also effectively irreversible: caches keep sending people to the old destination long after a link is deleted or its target changed.

`302 Found` costs one server request per visit and keeps the server in the loop, which is the whole point.

### Why `slug` and `[linkId, clickedAt]` are indexed

`slug` carries `@unique`, which creates a unique index. That index serves both purposes: it enforces that no two links share a slug, and it makes the redirect lookup an index seek rather than a sequential scan. Since the redirect runs on every single visit, this is the one query that has to stay fast as the table grows. A separate `@@index([slug])` would be redundant — the unique constraint already provides the index, and a second one would only add write overhead.

`[linkId, clickedAt]` is a composite index in that order because every analytics query filters by `linkId` first and then bounds `clickedAt` to the last 30 days. A composite index is only usable left-to-right, so this ordering lets Postgres seek directly to one link's rows and then range-scan the window, instead of scanning every click ever recorded. The order matters: `[clickedAt, linkId]` would not support "this link's recent clicks" nearly as well.

`ownerKey` is indexed because the dashboard's only query is "all links for this owner."

### Other notes

- **Validation is shared.** `src/lib/validation.ts` holds the Zod schemas used by both the browser form and the route handler, so client and server can never disagree about what a valid URL is. Only `http:` and `https:` are accepted — `javascript:`, `data:`, and `file:` are rejected, since a shortener that redirects to them is a script-injection vector.
- **Slug keyspace.** 7 characters from a 57-character alphabet that excludes visually ambiguous glyphs (`0`/`O`, `I`/`l`/`1`), giving ~1.95 × 10¹² combinations. `generateUniqueSlug()` retries on collision up to 5 times; the unique index remains the actual guarantee, and a `P2002` violation is caught and returned as a `409`.
- **Reserved slugs.** `api`, `dashboard`, `_next`, `favicon.ico`, `robots.txt`, `sitemap.xml`, and anything starting with `_` are blocked so a short link can never shadow a real route.
- **Rate limiting is in-memory.** The budget is per-process, so it resets on deploy and is not shared across instances — the real ceiling is 10 × instances. Production would move this to Redis (`INCR` with `EXPIRE`, or a sorted set per key).
- **The Prisma client is a `globalThis` singleton**, cached only when `NODE_ENV !== "production"`, so hot reload in development doesn't open a new connection pool on every edit.
- **Consistent error envelopes.** Every handler returns `{ error: { code, message, details? } }` with a matching status, which lets the UI act on `code` — a `409` on a taken slug highlights the slug field specifically instead of showing a generic banner.

## Running locally

**Prerequisites:** Node.js 20+ and a PostgreSQL 15+ database.

### 1. Create a Neon database

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. From the project dashboard, copy the **pooled** connection string — it looks like
   `postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`.
   The pooled endpoint (the one containing `-pooler`) is the right choice for serverless, where many short-lived invocations each want a connection.

Any PostgreSQL 15+ instance works, including a local one; Neon is just what the live demo runs on.

### 2. Configure environment variables

```bash
cp .env.example .env
```

```ini
# PostgreSQL connection string. Requires PostgreSQL >= 15.
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# Origin that short links are built against, e.g. http://localhost:3000
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

`NEXT_PUBLIC_BASE_URL` is the public origin printed in short URLs. Leave it empty and the app falls back to the origin of the incoming request, which is usually what you want in development.

Note that Prisma 7 no longer reads the connection URL from `schema.prisma`. The CLI gets it from `prisma.config.ts` (which loads `.env` via `dotenv`), and the runtime passes it to the `@prisma/adapter-pg` driver adapter in `src/lib/prisma.ts`.

### 3. Install, migrate, and run

```bash
npm install          # postinstall runs `prisma generate`
npx prisma db push   # create the Link and Click tables
npm run dev
```

Open http://localhost:3000.

To inspect the data directly:

```bash
npx prisma studio
```

## What I built and learned

I built this end to end: schema, API layer, redirect handler, and UI.

**A floating promise is not a background job.** The instinct for "log this without blocking the response" is to skip the `await`. On serverless that is a silent data-loss bug — the invocation can be frozen as soon as the response is flushed. `after()` exists precisely because the intuitive version is wrong, and the failure mode is invisible enough that you would probably ship it without noticing.

**Redirect status codes are a product decision.** `301` is the "correct" answer for a permanent redirect and the wrong answer here, because browser caching would make the analytics — the entire feature — quietly under-report. Choosing `302` is trading a request per visit for data that is actually true.

**A Suspense boundary can override your HTTP status.** `notFound()` in the per-link analytics page was returning `200` with a 404 body. The cause was a `loading.tsx` one level up: a parent loading file wraps the whole subtree, so the shell streamed and committed a `200` before `notFound()` ran. I isolated it against control routes and scoped the skeleton to the list page with a `(overview)` route group. Streaming has real consequences for anything that has to be decided before the first byte.

**Module boundaries decide what ships to the browser.** The build failed because a client component imported the Zod schemas, which imported the slug helpers, which imported Prisma — dragging the Postgres driver into the browser bundle. One DB-touching function in an otherwise pure module was enough. Splitting `generateUniqueSlug()` into `slug-server.ts` fixed it, and the import graph is now the thing that keeps server code on the server.

**Compound indexes are ordered, and the order encodes the query.** `[linkId, clickedAt]` works for the analytics query because the leading column is the equality filter and the second is the range. Reversed, it would be close to useless for the same question.

I also worked against a Prisma major version whose CLI and client differ substantially from earlier releases — no `url` in the schema, a required driver adapter — which was a good reminder to read the installed version's own documentation instead of trusting what I remembered about the library.
