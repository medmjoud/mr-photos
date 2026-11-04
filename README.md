# SOURA · صورة — Mauritania, seen by its own people

SOURA is a gallery of photographs of Mauritania. Photographers create a profile
and submit photos; **every photo is reviewed by a human before it can appear
publicly**; visitors browse and search, then contact the photographer directly
(WhatsApp or email) to arrange any use. Originals are never downloadable and
photographers keep all their rights. The service is free (the data model keeps
room for paid plans later).

- Languages: **French (default), Arabic (full RTL), English** — `/fr`, `/ar`, `/en`
- Design system: [`DESIGN.md`](./DESIGN.md) · Moderation runbook: [`docs/MODERATION.md`](./docs/MODERATION.md)

---

## Stack — and why not Cloudflare Workers

| Layer | Choice |
|---|---|
| Framework | **TanStack Start** (React 19, TanStack Router, Vite 8, Nitro `node-server` preset), TypeScript strict |
| Styling | Tailwind CSS v4 with the design-token `@theme` (no default palette) |
| Database | **SQLite via libSQL + Drizzle ORM** (local file or Turso). Same SQL dialect as Cloudflare D1 |
| Storage | Private object storage behind one interface: local filesystem (dev / single server) or **any S3-compatible bucket — Cloudflare R2 recommended** |
| Images | **sharp / libvips** on the server |
| i18n | `use-intl` (ICU messages), locale-prefixed URLs, no locale cookie |
| Email | Console (dev) or Resend |
| AI pre-check | Provider interface: `none`, `mock` (tests), OpenAI `omni-moderation` |
| Tests | Vitest (unit), Playwright + axe-core (e2e, a11y) |

**Cloudflare Workers was evaluated first and rejected for the app server:**
authentication works on Workers (Web Crypto PBKDF2), but **server-side image
processing does not fit**: `sharp`/libvips is a native addon that cannot run in
Workers, and decoding camera originals in WASM exceeds the 128 MB isolate memory
limit (one 24 MP image is ~96 MB of RGBA before resizing). The only
Cloudflare-native option is the separately billed Cloudflare Images service,
which could not be verified without an account. The simplest reliable
alternative is a small Node container. Cloudflare stays useful: **R2** for
storage, and Cloudflare DNS/CDN in front of the container. The schema uses the
D1-compatible SQLite dialect and storage/email/AI/rate-limit code sits behind
interfaces, so a later move is mostly a driver swap.

---

## Quick start (development)

Requirements: Node.js ≥ 22.12, npm.

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

`npm run dev` applies migrations and starts <http://localhost:3000> (redirects
to `/fr`). Without any configuration the app uses a local SQLite file
(`.data/soura.db`), local private storage (`.data/storage`) and writes emails
to `.data/mail/*.json` — open the newest file to click verification links.

### Create the first admin

```bash
npm run admin:create -- --email you@example.org --name "Your Name"
```

Without `--password`, a strong temporary password is generated and printed
once; change it with “Forgot password”. Running the command for an existing
account promotes it to admin. Admins are only ever created from the command
line (never through the web UI). The admin area is at `/fr/admin`.

### Demo content (local only)

```bash
ALLOW_DEMO_SEED=true npm run seed:demo
```

```bash
ALLOW_DEMO_SEED=true npm run seed:demo:remove
```

The seed generates abstract landscape images procedurally (no third-party
photos, so nothing to license), creates obviously fictitious "Photographe démo"
accounts, flags everything `is_demo`, and the site shows a **“Demo content”**
banner while any demo photo exists. It refuses to run when `APP_ENV` is
`production`/`staging`, against a non-local database, or without
`ALLOW_DEMO_SEED=true`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Migrate + dev server |
| `npm run build` / `npm start` | Production build / start (`.output/server/index.mjs`, loads `.env` if present) |
| `npm run typecheck` · `npm run lint` | TypeScript (strict) · ESLint |
| `npm test` | Unit tests (permissions, moderation rules, AI provider, image pipeline, i18n, security) |
| `npm run test:e2e` | Playwright e2e against the production build (run `npm run build` first) |
| `npm run db:generate` · `npm run db:migrate` | Create / apply Drizzle migrations |
| `npm run admin:create -- --email …` | Create or promote an admin |
| `npm run jobs:cleanup` | Daily maintenance (retention deletes, expired sessions) |
| `npm run map:build` | Regenerate the region map from Natural Earth data |

The e2e suite starts its own isolated server (`scripts/e2e-server.ts`: fresh
database, storage and mail folder under `.data/e2e`, mock AI provider). It
covers: admin-only approval (including replaying the admin RPC as a
photographer, anonymously, and cross-site), private pending files and
originals, EXIF/GPS-free public images, AI failure keeping photos pending,
content-based upload validation, contact details absent from page source,
report auto-hide, the child-safety procedure, WCAG 2.2 AA (axe) on key pages
in both themes and languages, RTL and mobile layout.

---

## Configuration

Everything is configured through environment variables — see
[`.env.example`](./.env.example) for the full, commented list. The essentials:

| Variable | Production value |
|---|---|
| `APP_ENV` | `production` (enables strict checks, forbids demo seeding) |
| `APP_URL` | `https://your-domain` (HTTPS enables `__Host-` Secure cookies and HSTS) |
| `SESSION_SECRET` | 32+ random characters (`openssl rand -base64 48`) — **required** |
| `DATABASE_URL` | `file:/app/.data/soura.db` (volume) or `libsql://…` + `DATABASE_AUTH_TOKEN` (Turso) |
| `STORAGE_DRIVER=s3` + `S3_*` | A **private** Cloudflare R2 bucket (no public access) |
| `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`, `EMAIL_FROM` | Verified sender domain |
| `MODERATION_PROVIDER` | `openai` + `OPENAI_API_KEY`, or `none` (everything is still reviewed by a human) |
| `TRUST_PROXY` | `cloudflare` behind Cloudflare (uses `CF-Connecting-IP` for rate limits) |
| `CRON_SECRET` | Random token for `POST /api/cron/cleanup` |
| `MODERATION_ALERT_EMAIL` | Who gets an immediate email on urgent reports |

Never commit `.env` (it is git-ignored). No secret is ever exposed to the
client: server code reads configuration per request and the build fails if
server-only modules leak into the client bundle (TanStack import protection).

---

## How it works

### Upload → moderation → publication
1. `POST /api/photos/upload` (multipart). The file type is detected **from its
   bytes** (magic numbers + a full decode), then size, pixel budget, minimum
   resolution, per-user/IP rate limits and a pending-queue cap are enforced.
   Required declarations: rights, consent of identifiable people, content
   rules, plus “identifiable people?” and “minor present?”.
2. The original is stored **privately**; the photo row starts **`pending`**.
3. A background job renders every derivative with sharp: AVIF + WebP
   thumbnails (480/960/1280, small credit), **visibly watermarked previews**
   (long edge 1600 px), an Open Graph card, a blur placeholder and a private
   review copy. **All metadata (EXIF, GPS, XMP, IPTC, ICC) is stripped**;
   orientation is baked in.
4. The **AI pre-check** runs on a downscaled, metadata-free copy. It can only
   *add flags* for moderators — it never changes a photo's status. Unavailable,
   error or timeout ⇒ the photo simply stays pending.
5. An admin approves (French alt text required, Arabic/English optional) or
   rejects with a reason shown to the photographer. Rejected files are
   deleted after `REJECTED_RETENTION_DAYS`.

### Public access rules
- One definition of *publicly visible* (approved, processed, not hidden, not
  locked, owner active) is used by every listing, the sitemap and
  `/media/p/:id/:token/:file`, which re-checks it on every request. Pending or
  hidden photos, wrong tokens and private variants all return the same 404.
- Private files are only reachable through short-lived signed URLs (HMAC for
  local storage, S3 pre-signed URLs for R2), generated only for the owner or an
  admin — and never for material under the child-safety lock.
- Media URLs embed a token that rotates whenever a photo is hidden (plus an
  optional Cloudflare cache purge).
- Right-click is not disabled; protection comes from watermarked,
  size-limited derivatives.

### Contact and analytics
- Pages only know *whether* WhatsApp/email exist. The details are revealed by a
  rate-limited endpoint after a click, so they never appear in page HTML.
- Views, profile visits and contact clicks are counted first-party and
  **cookieless**: one event per visitor per day, using a hash with a random
  daily salt that is deleted after two days. Photographers see their totals
  in their dashboard. The only cookie is the signed-in session.

### Security summary
Server-side role checks on every protected server function and route
(`requireUser` / `requireAdmin`); scrypt password hashes; hashed DB sessions in
`HttpOnly`, `SameSite=Lax`, `__Host-` cookies with rotation; email
verification by explicit POST (link scanners cannot verify or sign in);
enumeration-safe sign-up/reset; Origin-based CSRF check on every non-GET
request; strict CSP with per-request nonces; security headers; SQLite-backed
rate limiting; input validation with zod; path-traversal-safe storage keys.

---

## Deployment

The app is a single Node container (`Dockerfile`), with SQLite on a persistent
volume (or Turso) and files in a private R2 bucket. Any Docker host works
(a small VPS, Fly.io with a volume, Railway, Render…). 1 vCPU / 1 GB RAM is
enough to start; image processing runs one job at a time.

```bash
docker compose up -d --build
```

```bash
docker compose exec soura node_modules/.bin/tsx scripts/create-admin.ts --email you@example.org
```

Migrations run automatically when the container starts. Health check:
`GET /api/health`.

**Schedule the daily cleanup** (retention deletes, expired sessions) from any
scheduler (cron, Cloudflare Cron Trigger calling the URL, GitHub Actions…):

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/cleanup
```

**Backups:** back up the SQLite file (volume snapshot, or
[Litestream](https://litestream.io) to R2) and the R2 bucket. With Turso,
backups are managed by Turso.

**Scaling note:** the rate limiter, job queue and SQLite file are designed for
one instance. To scale horizontally, switch to Turso (shared DB) and move the
job runner to a queue — the interfaces are already isolated.

### Exact steps to go live

1. **Domain + Cloudflare**: point DNS to your host through Cloudflare (proxied).
   Set `TRUST_PROXY=cloudflare`. Optionally create an API token with “Cache
   Purge” and set `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_API_TOKEN`.
2. **R2**: create a **private** bucket and an S3 API token scoped to it; set
   `STORAGE_DRIVER=s3`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`,
   `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
3. **Email**: create a Resend account, verify your sending domain, set
   `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, and
   `MODERATION_ALERT_EMAIL`.
4. **AI pre-check (optional)**: create an OpenAI API key (the moderation
   endpoint is free) and set `MODERATION_PROVIDER=openai`, `OPENAI_API_KEY`.
   Mention the provider in the privacy policy.
5. **Secrets**: `APP_ENV=production`, `APP_URL=https://…`, a fresh
   `SESSION_SECRET`, a fresh `CRON_SECRET`.
6. **Deploy** the container with a persistent volume for `/app/.data`, then
   create the first admin.
7. **Schedule** the daily cleanup call.
8. **Legal**: have a lawyer review and complete the Terms, Privacy policy and
   takedown texts (`src/content/*.ts`, marked as drafts on the site) and the
   child-safety procedure in [`docs/MODERATION.md`](./docs/MODERATION.md);
   fill in the publisher identity and contact addresses.
9. **Smoke test** on the live domain: sign up, verify, upload, approve as admin,
   view the photo page, reveal a contact, report a photo.

---

## Project layout

```
src/
  routes/            File routes: /$locale/* pages, /api/*, /media/*, /files/*, sitemap, robots
  functions/         Server functions (RPC) — auth enforced with middleware
  server/            Server-only code: db, auth, storage, images, moderation, jobs, email
  components/        UI (design-system components in components/ui)
  lib/               Isomorphic helpers: permissions, moderation rules, regions, text, SEO
  i18n/, content/    Messages (fr/ar/en) and long-form page content
drizzle/             SQL migrations
scripts/             migrate, create-admin, seed-demo, cleanup, build-map, e2e-server
tests/unit, e2e/     Vitest and Playwright suites
```

## Credits and licences
Fonts (SIL Open Font License): Fraunces, Schibsted Grotesk, Markazi Text,
IBM Plex Sans Arabic — self-hosted via Fontsource; licences in
`assets/fonts/` and `src/assets/fonts/`. Region boundaries: Natural Earth
(public domain).
