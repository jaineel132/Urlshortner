# URL Shortener API — V2

A backend URL shortening service built with Node.js, Express, and PostgreSQL.

V1 shortens URLs with custom aliases, expiration, and click tracking. **V2** adds user accounts on top of that: registration, login, bcrypt password hashing, JWT access + refresh tokens, JWT authentication middleware, protected routes, and per-user URL ownership — each user manages only their own links.

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
- Layered backend architecture

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
Repository
  ↓
PostgreSQL
```

| Layer | Responsibility |
|---|---|
| **Route** | Maps HTTP paths to middleware + controllers (`src/routes/`) |
| **Middleware** | Cross-cutting request checks: input validation, JWT authentication (`src/middleware/`) |
| **Controller** | Reads request data, calls the service, builds HTTP responses, forwards errors to the global error handler (`src/controllers/`) |
| **Service** | Business logic — shortcode collision retries, expiry checks, password hashing/comparison, error mapping (`src/services/`) |
| **Repository** | Raw parameterized SQL only (`src/repositories/`) |
| **PostgreSQL** | The database (pg `Pool` in `src/db/connection.js`) |

Token generation (access + refresh JWTs) is centralized in `src/services/tokenService.js`.

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
| `GET` | `/:shortcode` | Public redirect to the original URL |

`GET /urls` is declared before `GET /:shortcode` in the router so `urls` is not treated as a shortcode.

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

   Fill in database credentials, `BASE_URL`, and generate two strong random `JWT_SECRET` / `JWT_REFRESH_SECRET` values.

3. **Create the PostgreSQL database** (adjust to your local setup)

   ```
   psql -U postgres -c "CREATE DATABASE url_shortener;"
   ```

4. **Apply the schema**

   The `urls` table was created manually in V1 and has no migration file in this repo; recreate it with the schema shown in the [Database](#database) section:

   ```sql
   CREATE TABLE IF NOT EXISTS urls (
     id SERIAL PRIMARY KEY,
     original_url TEXT NOT NULL,
     short_code TEXT UNIQUE NOT NULL,
     created_at TIMESTAMP DEFAULT NOW() NOT NULL,
     expires_at TIMESTAMP,
     click_count INTEGER DEFAULT 0 NOT NULL
   );
   ```

   Then run the shipped migrations in order (there is no migration runner — apply with `psql`):

   ```
   psql -U postgres -d url_shortener -f src/db/migrations/create_users_table.sql
   psql -U postgres -d url_shortener -f src/db/migrations/add_user_id_to_urls.sql
   ```

   `add_user_id_to_urls.sql` adds `user_id`, removes rows without an owner (V1 rows predate ownership), and enforces `NOT NULL` with a foreign key to `users(id)`.

5. **Start the server**

   ```
   node server.js
   ```

   The server verifies the database connection on startup.

## Testing

The project has no automated test framework — behavior was verified manually against the live server with `curl` / REST requests. Verified cases:

- Registration (success + duplicate email → 409)
- Login (success, wrong password → 401, unknown email → 401)
- Missing / invalid / expired access token → 401
- Refresh token rejected when used as an access token → 401
- Authenticated URL creation is stored with the JWT's `sub` as owner
- `GET /urls` returns only the authenticated user's URLs
- Destruction is ownership-protected (`DELETE ... WHERE short_code = $1 AND user_id = $2`)
- Cross-user deletion attempts are rejected and leave the target row intact
- Public `GET /:shortcode` redirect works without authentication

## Security Notes

- Passwords are hashed with **bcrypt** (raw passwords or hashes are never returned or logged)
- Login failures return a single generic message (`Invalid email or password`) — user enumeration is not possible
- All queries use **parameterized SQL** (no string-concatenated input)
- Access tokens are verified with **`jwt.verify` + `JWT_SECRET`**; `jwt.decode` is never used for authentication
- Access and refresh tokens use **separate secrets**
- URL operations are protected and ownership is enforced inside the SQL queries
- Secrets are stored in environment variables (`.env` is git-ignored)

---

This README documents **URL Shortener V2**.