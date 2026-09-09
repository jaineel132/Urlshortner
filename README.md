URL Shortener API

Features
- User registration and login (JWT access + refresh tokens)
- Shorten URLs (authenticated, owned by the creating user)
- Custom aliases
- Expiration
- Click tracking
- List your own URLs
- Ownership-protected deletion

Tech
- Node.js
- Express
- PostgreSQL
- JWT (jsonwebtoken)
- bcrypt

Endpoints

Public
POST   /auth/register
POST   /auth/login
GET    /health
GET    /:shortcode

Authenticated (Authorization: Bearer <access_token>)
POST   /shorten
GET    /urls
DELETE /:shortcode