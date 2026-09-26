# StockSense

Inventory management frontend and Express API backed by PostgreSQL and Prisma. Authentication uses a signed JWT in an HTTP-only cookie. New accounts must verify their email with a one-time code sent through Gmail before they can sign in.

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer
- A Gmail account with 2-Step Verification enabled and a Google App Password

## Configure

From this directory, create a database named `stocksense` in PostgreSQL, then create your local environment file if you do not already have one:

```powershell
Copy-Item .env.example .env
```

Update `DATABASE_URL` in `.env` with your PostgreSQL username and password. Generate a session signing key with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Put the generated value in `SESSION_SECRET`. In your Google Account, enable 2-Step Verification, create an App Password, and set `GMAIL_USER` and `GMAIL_APP_PASSWORD`. Do not use your normal Gmail password or commit `.env`.

## Install and run

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open <http://127.0.0.1:5173>. The development command starts the Vite frontend and Express API together; Vite proxies `/api` requests to port 4000. The API checks PostgreSQL connectivity before it starts listening.

New signups receive a six-digit email verification code, valid for ten minutes. Codes are stored hashed, can be resent once per minute, and are single-use. Password reset uses the same Gmail delivery and code lifetime. JWT sessions expire after seven days and are stored in an HTTP-only, same-site cookie.

For production, set `NODE_ENV=production`, use HTTPS and a strong unique `SESSION_SECRET`, configure production PostgreSQL/Gmail credentials, and deploy migrations with `npx prisma migrate deploy`.
