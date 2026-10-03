# URL Shortener API — V5

A backend URL shortening service built with Node.js, Express, PostgreSQL, and Redis caching and rate limiting.

**V1** shortens URLs with custom aliases, expiration, and click tracking. 
**V2** adds user accounts: registration, login, bcrypt password hashing, JWT access + refresh tokens, JWT authentication middleware, protected routes, and per-user URL ownership. 
**V3** adds **Redis caching** for the public redirect (`GET /:shortcode`) using a cache-aside pattern — PostgreSQL remains the source of truth. 
**V4** adds **Redis-backed rate limiting** (fixed-window) for login, register, authenticated actions, and public redirects — with fail-open behavior when Redis is down.
**V5** adds **asynchronous click analytics** using BullMQ + Redis + a separate worker process — every successful redirect enqueues an analytics job with event metadata (user agent, referrer, timestamp) that is persisted to PostgreSQL with idempotent deduplication and retry/backoff.

## Features

- Create short URLs
- Custom aliases
- URL expiration
- Click counting
- Public short URL redirects
- User registration
- Secure password hashing (bcrypt)
- User login
- JWT access token
- JWT refresh token
- Protected URL creation
- User-specific URL listing
- User-specific URL deletion
- URL ownership isolation
- PostgreSQL persistence
- Redis cache-aside caching for public redirects
- Cache invalidation on URL deletion
- Graceful fallback to PostgreSQL when Redis is unavailable
- Layered backend architecture
- Redis-backed rate limiting (fixed-window)
- 429 responses with Retry-After header
- Asynchronous click analytics via BullMQ worker
- Idempotent analytics event persistence with retry/backoff

## Architecture

```
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Repository / cache layer
  ↓
Redis / PostgreSQL
```

| Layer | Responsibility |
|---|---|
| **Route** | Maps HTTP paths to middleware + controllers (`src/routes/`) |
| **Middleware** | Cross-cutting request checks: input validation, JWT authentication, rate limiting (`src/middleware/`) |
| **Controller** | Reads request data, calls the service, builds HTTP responses, forwards errors to the global error handler (`src/controllers/`) |
| **Service** | Business logic — shortcode collision retries, expiry checks, cache-aside orchestration, password hashing/comparison, error mapping (`src/services/`) |
| **Repository / cache layer** | Raw parameterized SQL (`src/repositories/`) plus Redis cache operations (`src/cache/`) |
| **Redis** | Cache for URL lookups (`src/cache/redisClient.js`, `src/cache/urlCache.js`) |
| **PostgreSQL** | The database — source of truth (pg `Pool` in `src/db/connection.js`) |

Token generation (access + refresh JWTs) is centralized in `src/services/tokenService.js`.

## Caching (Redis)

`GET /:shortcode` (public redirect) is the only route served through the cache. `POST /shorten` does **not** warm the cache — the first redirect populates it through a normal cache miss.

Cache-aside flow:

```
GET /:shortcode
      ↓
Redis GET "url:<shortcode>"
      ↓
   ┌───┴────┐
  HIT      MISS
   ↓         ↓
parse      PostgreSQL
JSON         ↓
   ↓      URL found?
   │       ↓
   │   JSON.stringify
   │       ↓
   │   Redis SET + TTL
   │       ↓
   └───────┬───────┘
           ↓
     expiration check
           ↓
     click count update
           ↓
        redirect
```

Details:

- **Key format** — `url:<shortcode>` (e.g. `url:abc123`, `url:HW8VKl`). The bare shortcode is never used as the key.
- **Cached data** — only `{ original_url, expires_at }`, the minimum `GET /:shortcode` needs. Password hashes, tokens, and user data are never cached.
- **TTL** — 60 seconds (`CACHE_TTL_SECONDS` in `src/cache/urlCache.js`), applied with Redis key expiration. This is the cache lifetime only; it is **not** the URL's business expiration.
- **`expires_at` is authoritative** — a cached URL only redirects if `expires_at` is `NULL` or still in the future. A stale (expired) cached entry is invalidated and returns **410**, like V2.
- **Cache hit** — no PostgreSQL lookup; `expires_at` is checked from the cached value, `click_count` is still incremented in PostgreSQL, then redirect.
- **Cache miss** — PostgreSQL lookup. Missing shortcode → **404** (no Redis entry created). Expired shortcode → **410** (no cache entry, no click increment). Valid → JSON-serialized and stored with a 60s TTL, `click_count` incremented, redirect.
- **Click counting is preserved** — every successful, non-expired redirect increments `click_count` in PostgreSQL, whether served from cache or from a miss.
- **Delete invalidation** — `DELETE /:shortcode` removes `url:<shortcode>` from Redis **only after** the ownership-aware PostgreSQL delete succeeds; a zero-row delete still returns **404** and does not touch another user's cache entry.
- **Malformed cached JSON** — if a cached value cannot be parsed or lacks the required fields, it is treated as a cache miss, the bad key is removed, and the request falls back to PostgreSQL.
- **Redis unavailable** — Redis is an optimization, not the source of truth. If it is down or a Redis operation fails, the error is logged, Redis is skipped, and the request is served from PostgreSQL with normal V2 behavior (no 500s).

Cache code lives in `src/cache/`:

- `src/cache/redisClient.js` — the shared Redis connection (created once, connected at startup, reused for all requests — never connected/quit per request).
- `src/cache/urlCache.js` — `getCachedURL`, `setCachedURL`, `invalidateCachedURL` + TTL and key-format constants.

## Rate Limiting (V4)

API routes are rate limited with a Redis-backed fixed-window algorithm. Counters live in Redis; the middleware factory is `src/middleware/rateLimiter.js` and all limit configuration is centralized in `src/config/rateLimits.js`. There is no API-key limiting and no sliding-window / token-bucket implementation.

**Algorithm** — each request groups itself into a window with `windowId = Math.floor(Date.now() / 1000 / windowSeconds)`. A single atomic Lua script runs `INCR` on the key and, only when the count is `1` (window just opened), applies `EXPIRE` with the window size — so the TTL is set once when the window starts and is never reset by later requests. When `current > limit` the request gets **429** with a `Retry-After` header and `{ "error": "Too many requests", "retryAfterSeconds": ... }`.

**Key format** — `rate:<scope>:<identifier>:<windowId>`

| Scope | Identity | Routes | Limit | Window |
|---|---|---|---|---|
| `rate:login` | `req.ip` | `POST /auth/login` | 10 | 60s |
| `rate:register` | `req.ip` | `POST /auth/register` | 5 | 3600s |
| `rate:user` | `req.user.id` (JWT) | `POST /shorten`, `GET /urls`, `DELETE /:shortcode` | 30 | 60s |
| `rate:redirect` | `req.ip` | `GET /:shortcode` | 100 | 60s |

Limits are per-window and adjustable in one place, `src/config/rateLimits.js`.

**Identity strategy** — public scopes key on `req.ip`; the authenticated scope keys on the verified JWT's user id. Separate `login` / `register` scopes mean a login flood can never burn the register budget or vice versa. The `user` scope is shared across all three authenticated routes, so a burst of URL creation counts against listing and deletion too.

IP-based limits use `req.ip`. When deployed behind a trusted reverse proxy/load balancer, Express trust-proxy configuration must be set correctly so the client IP is identified safely.

**Middleware ordering** — the limiter runs inside each route's pipeline; on authenticated routes it sits after `authMiddleware` (so the user id exists) and before validation, meaning malformed/brute-force attempts still consume budget:

```
POST /auth/register  → registerLimiter → validate → controller
POST /auth/login     → loginLimiter → validate → controller
POST /shorten        → authMiddleware → userLimiter → validate → controller
GET /urls            → authMiddleware → userLimiter → controller
DELETE /:shortcode   → authMiddleware → userLimiter → controller
GET /:shortcode      → redirectLimiter → controller
```

`/health` is not rate limited.

**Fail-open** — the limiter reuses the shared `redisClient`. If Redis is not ready (`isReady !== true`) or the operation throws, the error is logged and the request proceeds. Rate limiting never produces a 500; when Redis comes back the counters restart from zero.

## Analytics (V5)

Every successful `GET /:shortcode` redirect enqueues an analytics job to a BullMQ queue backed by Redis. A separate worker process consumes these jobs and persists analytics events to PostgreSQL.

### Algorithm

1. After a valid, non-expired redirect (cache HIT or MISS), the controller builds an analytics event:
   - `eventId`: `crypto.randomUUID()` (unique per click)
   - `shortCode`: from the route parameter
   - `clickedAt`: ISO timestamp of the redirect
   - `userAgent`: from `req.headers["user-agent"]`
   - `referrer`: from `req.headers["referer"]`
2. The event is enqueued via `analyticsQueue.add("record-click", event, { attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: { age: 3600, count: 1000 }, removeOnFail: false })`.
3. Enqueue is **best-effort**: failures are logged but never break the redirect (fail-open).
3. The worker (separate process) consumes `record-click` jobs, inserts the event into `analytics_events` with `ON CONFLICT (event_id) DO NOTHING` — duplicate `event_id` is treated as success (idempotent).
4. On DB error the job throws → BullMQ retries with exponential backoff (1s, 2s, 4s... up to 3 attempts). Failed jobs are preserved in Redis for investigation.

### Database

Table: `analytics_events`

| Column | Type | Notes |
|---|---|---|
| `event_id` | `TEXT` | PRIMARY KEY |
| `short_code` | `TEXT` | NOT NULL |
| `clicked_at` | `TIMESTAMPTZ` | NOT NULL |
| `user_agent` | `TEXT` | Nullable |
| `referrer` | `TEXT` | Nullable |

Index: `(short_code, clicked_at DESC)` for time-series queries per URL.

No foreign key to `urls.short_code` (analytics survives URL deletion). No `click_count` column (authoritative count remains in `urls.click_count`). No BullMQ job-status columns.

### Queue & Worker

- **Queue**: `src/analytics/analyticsQueue.js` — BullMQ `Queue("analytics")` with fail-fast Redis connection (rejects immediately when Redis is down, so redirect never blocks).
- **Worker**: `src/analytics/analyticsWorker.js` — BullMQ `Worker("analytics")` with its own Redis connection (blocking, auto-reconnects). Run with `npm run worker`.
- **Repository**: `src/repositories/analyticsRepository.js` — idempotent `INSERT ... ON CONFLICT (event_id) DO NOTHING`.
- **Retry policy**: 3 attempts, exponential backoff starting at 1s. Failed jobs are preserved (`removeOnFail: false`); completed jobs auto-pruned after 1h or 1000 entries.

### Idempotency

`event_id` is the PRIMARY KEY. The `ON CONFLICT (event_id) DO NOTHING` clause means:
- Same event processed twice → second insert returns `rowCount = 0` → treated as success.
- Worker crashes mid-job and BullMQ retries → same `event_id` → no duplicate row.
- No separate deduplication table or job-status column needed.

### Fail-open

- Enqueue failures (Redis down, timeout) are logged and the redirect proceeds normally.
- Worker DB failures throw → BullMQ retries; after exhaustion the job stays in the failed set for manual inspection.
- Analytics never turns a successful redirect into a 500.

## Authentication Flow

**Registration**
```
POST /auth/register
  ↓
validate input
  ↓
bcrypt hash(password)
  ↓
INSERT INTO users
```

**Login**
```
POST /auth/login
  ↓
find user by email
  ↓
bcrypt.compare(password, password_hash)
  ↓
generate access + refresh JWTs
  ↓
return tokens
```

**Authenticated request**
```
Authorization: Bearer <access_token>
  ↓
authMiddleware
  ↓
jwt.verify(token, JWT_SECRET)
  ↓
req.user = { id: payload.sub }
  ↓
protected route
```

Token details:

- Access token — signed with `JWT_SECRET`, expires in **15 minutes**.
- Refresh token — signed with `JWT_REFRESH_SECRET`, expires in **7 days**. Issued at login only; **no refresh endpoint is implemented**.
- `password` / `password_hash` are never returned in responses or embedded in tokens.

## URL Ownership

`users 1 ───── many urls`

`urls.user_id` references `users.id`. The authenticated user's identity comes only from the verified JWT:

```
JWT payload.sub
  ↓
req.user.id
  ↓
repository ownership query
```

| Endpoint | Ownership behavior |
|---|---|
| `POST /shorten` | Creates a URL owned by the authenticated user |
| `GET /urls` | Returns only the authenticated user's URLs |
| `DELETE /:shortcode` | Deletes only if the shortcode belongs to the authenticated user (404 otherwise) |
| `GET /:shortcode` | Stays public — redirects regardless of authentication |

Client-supplied `user_id` (in the request body, query, or path) is never trusted.

## API Endpoints

### Public

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create an account |
| `POST` | `/auth/login` | Log in, returns access + refresh tokens |
| `GET` | `/health` | Health check |
| `GET` | `/:shortcode` | Public redirect to the original URL (cache-aside for speed) |

`GET /urls` is declared before `GET /:shortcode` in the router so `urls` is not treated as a shortcode.

All endpoints except `/health` are rate limited — see [Rate Limiting (V4)](#rate-limiting-v4).

### Authenticated

All protected endpoints require the header:

```
Authorization: Bearer <access_token>
```

| Method | Path | Description |
|---|---|---|
| `POST` | `/shorten` | Create a short URL owned by you |
| `GET` | `/urls` | List your URLs |
| `DELETE` | `/:shortcode` | Delete your own short URL |

All endpoints except `/health` are rate limited — see [Rate Limiting (V4)](#rate-limiting-v4).

### Examples

**Register**

```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "MyPassword123"
}
```

```
201 Created
{
  "id": 1,
  "email": "user@example.com",
  "created_at": "2026-09-07T13:14:54.937Z"
}
```

**Login**

```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "MyPassword123"
}
```

```
200 OK
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}
```

**Create a short URL (authenticated)**

```
POST /shorten
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "original_url": "https://example.com",
  "custom_alias": "my-link"
}
```

```
201 Created
{
  "short_url": "http://localhost:3000/my-link",
  "expires_at": null
}
```

## Database

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | `SERIAL` | Primary key |
| `email` | `TEXT` | **UNIQUE**, NOT NULL |
| `password_hash` | `TEXT` | NOT NULL, bcrypt hash |
| `created_at` | `TIMESTAMP` | Default `NOW()`, NOT NULL |

### `urls`

| Column | Type | Notes |
|---|---|---|
| `id` | `SERIAL` | Primary key |
| `original_url` | `TEXT` | NOT NULL |
| `short_code` | `TEXT` | **UNIQUE**, NOT NULL |
| `created_at` | `TIMESTAMP` | Default `NOW()`, NOT NULL |
| `expires_at` | `TIMESTAMP` | Nullable |
| `click_count` | `INTEGER` | Default `0`, NOT NULL |
| `user_id` | `INTEGER` | **NOT NULL**, references `users(id)` |

Constraints: `users.email` is UNIQUE, `urls.short_code` is UNIQUE, and `urls.user_id` is NOT NULL and references `users(id)`.

### `analytics_events`

| Column | Type | Notes |
|---|---|---|
| `event_id` | `TEXT` | PRIMARY KEY |
| `short_code` | `TEXT` | NOT NULL |
| `clicked_at` | `TIMESTAMPTZ` | NOT NULL |
| `user_agent` | `TEXT` | Nullable |
| `referrer` | `TEXT` | Nullable |

Index: `(short_code, clicked_at DESC)`.

No foreign key to `urls.short_code`. Analytics events survive URL deletion. `click_count` remains authoritative in `urls`.

PostgreSQL holds the authoritative state (URLs, ownership, `expires_at`, `click_count`, analytics events). Redis is only a cache of `{ original_url, expires_at }` for public redirects and the BullMQ queue backend.

## Environment Variables

| Variable | Purpose |
|---|---|
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port |
| `DB_USER` | PostgreSQL user |
| `DB_PASSWORD` | PostgreSQL password |
| `DB_NAME` | PostgreSQL database name |
| `PORT` | HTTP port the server listens on |
| `BASE_URL` | Public base URL prefixing generated short URLs |
| `REDIS_URL` | Redis connection URL (defaults to `redis://localhost:6379` if unset) |
| `JWT_SECRET` | Secret used to sign access tokens |
| `JWT_REFRESH_SECRET` | Secret used to sign refresh tokens |

- `.env` holds the real values locally and is ignored by Git.
- `.env.example` contains placeholders only (`change-me`, `change-me-too`).
- Real secrets must never be committed.

## Setup / Running

1. **Install dependencies**

   ```
   npm install
   ```

2. **Configure environment**

   ```
   cp .env.example .env
   ```

   Fill in database credentials, `BASE_URL`, and generate two strong random `JWT_SECRET` / `JWT_REFRESH_SECRET` values. `REDIS_URL` already defaults to `redis://localhost:6379`.

3. **Create the PostgreSQL database** (adjust to your local setup)

   ```
   psql -U postgres -c "CREATE DATABASE url_shortener;"
   ```

4. **Start Redis** (e.g. with Docker)

   ```
   docker run --name urlshortener-redis -p 6379:6379 -d redis
   ```

   The app connects to `REDIS_URL` at startup. Redis is optional at runtime — if it is unreachable the server starts anyway and redirects are served from PostgreSQL (the cache is skipped).

5. **Apply the migrations** (in order; there is no migration runner — apply with `psql`):

    ```
    psql -U postgres -d url_shortener -f src/db/migrations/create_urls_table.sql
    psql -U postgres -d url_shortener -f src/db/migrations/create_users_table.sql
    psql -U postgres -d url_shortener -f src/db/migrations/add_user_id_to_urls.sql
    psql -U postgres -d url_shortener -f src/db/migrations/create_analytics_events_table.sql
    ```

    - `create_urls_table.sql` — the V1 `urls` table (id, original_url, short_code, created_at, expires_at, click_count).
    - `create_users_table.sql` — the `users` table.
    - `add_user_id_to_urls.sql` — adds `user_id`, removes rows without an owner (V1 rows predate ownership), and enforces `NOT NULL` with a foreign key to `users(id)`.
    - `create_analytics_events_table.sql` — the V5 `analytics_events` table (event_id PK, short_code, clicked_at, user_agent, referrer) + index.

6. **Start the server**

    ```
    node server.js
    ```

    The server verifies the PostgreSQL and Redis connections on startup and reports whether each is reachable.

7. **Start the analytics worker** (in a separate terminal)

    ```
    npm run worker
    ```

    The worker consumes analytics jobs from the BullMQ queue and persists events to PostgreSQL. It runs as a separate process; if it is not running, analytics events are enqueued but not processed until the worker starts (jobs wait in Redis).

## Testing

The project has no automated test framework — behavior was verified manually against the live server with `curl` / REST requests.

**V2 cases (regression):**

- Registration (success + duplicate email → 409)
- Login (success, wrong password → 401, unknown email → 401)
- Missing / invalid / expired access token → 401
- Refresh token rejected when used as an access token → 401
- Authenticated URL creation is stored with the JWT's `sub` as owner
- `GET /urls` returns only the authenticated user's URLs
- Deletion is ownership-protected (`DELETE ... WHERE short_code = $1 AND user_id = $2`)
- Cross-user deletion attempts are rejected and leave the target row intact
- Public `GET /:shortcode` redirect works without authentication

**V3 cases (caching):**

- Cache miss: first redirect reads from PostgreSQL and creates `url:<shortcode>` in Redis
- Cache hit: repeat redirect is served from Redis without a PostgreSQL lookup
- TTL: `url:<shortcode>` gets a finite expiry (~60s)
- Expired URL (`expires_at` in the past): returns 410, `click_count` does not increase, stale cache entries are invalidated and cannot redirect
- Nonexistent shortcode: returns 404 and creates no Redis entry
- Delete invalidation: deleting a URL removes both the PostgreSQL row and `url:<shortcode>`, and a later redirect returns 404
- Cross-user delete: a non-owner's attempt returns 404 and leaves the owner's DB row and cached entry intact
- Redis down: with the Redis container stopped, redirects still work from PostgreSQL and return no 500s; behavior recovers when Redis is restarted
- Click counting: every valid redirect increments `click_count` (cache hits included); expired redirects never increment

**V4 cases (rate limiting):**

- Fixed window: after `limit` requests within a window, further requests return 429 with a `Retry-After` header and a `retryAfterSeconds` body field
- Separate counters: login and register increments do not share a budget; a `/shorten` flood does not affect another user's budget
- Shared user budget: `/shorten`, `/urls`, and `DELETE /:shortcode` consume the same `rate:user:<id>` counter
- TTL is set once on the first hit of a window and is not reset by later requests (fixed window, not sliding)
- `/health` is never rate limited
- Redis fail-open: with the Redis container stopped, rate-limited endpoints still respond (no 429s, no 500s) and limiting resumes after the container is restarted

**V5 cases (analytics):**

- Valid redirect (cache HIT or MISS) → analytics job enqueued with unique `eventId`, `shortCode`, `clickedAt`, `userAgent`, `referrer`
- 404 (nonexistent shortcode) → no analytics event
- 410 (expired URL) → no analytics event
- Cache HIT and cache MISS both produce analytics events
- BullMQ worker processes job → inserts `analytics_events` row with idempotent `ON CONFLICT (event_id) DO NOTHING`
- Duplicate `event_id` (worker crash + retry) → single row, no error
- Worker DB failure → BullMQ retries with exponential backoff (1s, 2s, 4s up to 3 attempts); job succeeds on restore
- Enqueue failure (Redis down) → logged, redirect still 302, no 500
- Redis down → jobs wait in BullMQ queue; processed when worker + Redis recover
- Exactly one `analytics_events` row per unique `event_id`

## Security Notes

- Passwords are hashed with **bcrypt** (raw passwords or hashes are never returned or logged)
- Login failures return a single generic message (`Invalid email or password`) — user enumeration is not possible
- All queries use **parameterized SQL** (no string-concatenated input)
- Access tokens are verified with **`jwt.verify` + `JWT_SECRET`**; `jwt.decode` is never used for authentication
- Access and refresh tokens use **separate secrets**
- URL operations are protected and ownership is enforced inside the SQL queries
- Only URL redirect data (`original_url`, `expires_at`) is cached — never passwords, password hashes, tokens, or user records
- Cache-busting on delete prevents one user's cached URL from surviving after another user's actions
- Secrets are stored in environment variables (`.env` is git-ignored)
- Rate limiting protects login/register from credential-stuffing floods, bounds per-user API use, and caps public redirect traffic
- Rate limit counters are keyed on the verified JWT user id (authenticated routes) or `req.ip` (public routes), never on client-supplied ids
- Analytics events contain only `short_code`, timestamp, user agent, referrer — no PII, no tokens, no passwords
- Analytics `event_id` is a UUID (v4) — not predictable, not derived from user data
- BullMQ queue and worker use dedicated Redis connections; queue connection fails fast so redirect latency is never affected

---

This README documents **URL Shortener V5**.
