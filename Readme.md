<p align="center">
  <a href="https://getfinancer.com">
    <img src="https://raw.githubusercontent.com/GetFinancer/images/70648e7f78e51804b7f1e1d4751edf590e25776d/logo.png" alt="Financer logo">
  </a>
</p>

<p align="center">
    <a href="https://github.com/getfinancer/financer/actions"><img alt="CI Status" src="https://github.com/getfinancer/financer/actions/workflows/ci.yml/badge.svg"></a>
    <a href="https://github.com/getfinancer/financer/releases">
      <img alt="Release" 
          src="https://img.shields.io/github/v/release/getfinancer/financer">
    </a>
    <a href="https://github.com/getfinancer/financer/blob/main/docker-compose.yml"><img alt="Docker Ready" src="https://img.shields.io/badge/docker-ready-blue"></a>
</p>

<h1 align="center">Financer - Your #1 personal financer tracker</h1>

# Financer

A self or cloud-hosted Progressive Web App (PWA) for personal finance management.

## Features

- Track income and expenses
- Manage multiple accounts (bank, cash, credit cards, savings)
- Credit card billing cycles with automatic period calculation
- Recurring transactions
- Categorize transactions
- Dashboard with monthly overview, analytics and charts
- Shared accounts (invite via join link)
- Multi-language UI (German, English)
- Simple password protection (single-user)
- Admin dashboard for user/tenant management
- Mobile-friendly PWA (installable on phone)
- Offline-capable
- Docker deployment ready


### Links

- [Home](https://getfinancer.com) — Financer project homepage
- [Bugs/Features](https://bugsfinancer.itwtserv.ovh) — If you find a bug or want to request a new Feature
- [Documentation](https://doc.getfinancer.com) — Learn how to use Financer

## Project Structure

```
financer/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Express backend
├── packages/
│   └── shared/       # Shared TypeScript types
├── docker/           # Dockerfiles
└── docker-compose.yml
```

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: SQLite (file-based, no separate server needed)
- **Auth**: Session-based with bcrypt password hashing
- **Monorepo**: pnpm workspaces (Node.js >= 20, pnpm >= 9)

## Deployment Modes

Financer supports two deployment modes controlled by the `DEPLOYMENT_MODE` environment variable:

### Self-Hosted (`selfhosted` — default)

Single-tenant mode for running on your own server. No subdomain routing, no trial system, no Stripe billing. The admin dashboard is available but hides billing-related features.

### Cloud-Hosted (`cloudhost`)

Multi-tenant SaaS mode with subdomain routing (`tenant.yourdomain.tld`), trial system, Stripe billing, and tenant registration.

## Configuration

### Core Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEPLOYMENT_MODE` | No | `selfhosted` | `selfhosted` or `cloudhost` |
| `SESSION_SECRET` | **Yes** | — | Secret for session encryption. Generate: `openssl rand -base64 32` |
| `DEFAULT_TENANT` | No | `default` | Tenant name for the database |
| `ADMIN_TOKEN` | No | — | Token for admin dashboard at `/admin`. Generate: `openssl rand -base64 32` |
| `WEB_PORT` | No | `3000` | Web server port |
| `API_PORT` | No | `4000` | API server port |

### Cloud-Host Only Variables

Only needed when `DEPLOYMENT_MODE=cloudhost`:

| Variable | Description |
|---|---|
| `BASE_DOMAIN` | Base domain for subdomain routing (e.g. `getfinancer.com`) |
| `ALLOW_AUTO_PROVISION` | Auto-create tenant databases on first subdomain access |
| `STRIPE_SECRET_KEY` | Stripe API key for billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Stripe price ID for the subscription product |

### Email / SMTP (optional)

Required for admin password reset via email. Without SMTP configured, password reset is disabled.

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | SMTP port (`587` STARTTLS, `465` SSL) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password / app password |
| `SMTP_FROM` | Optional, defaults to `SMTP_USER` |
| `APP_URL` | Optional if `BASE_DOMAIN` is set, used in password reset email links |

## Data Persistence

All data is stored in SQLite database files at `./data/<tenant>/financer.db`.

## Financer Cloud

If you don't want to self-host, visit the [Cloud version](https://getfinancer.com).

## Installation (Self-Hosted)

### Prerequisites
- Docker and Docker Compose

### Setup

```bash
# Clone Repository
git clone https://github.com/GetFinancer/financer.git
cd financer

# Create .env file
cp .env.example .env

# Generate secrets
openssl rand -base64 32  # Use for SESSION_SECRET
openssl rand -base64 32  # Use for ADMIN_TOKEN

# Edit .env with your values
nano .env

# Start
docker compose -f docker-compose.selfhosted.yml up -d
```

The app will be available at `http://localhost:3000`.
The admin dashboard is at `http://localhost:3000/admin`.

### Updating Financer

```bash
# Change into Financer directory
cd /path-on-your-server/financer

# run script
./update.sh
```
Script will ask you to keep your Backups. Your decision ;)

## Roadmap and releases

See [Releases](https://github.com/getfinancer/financer/releases) for the current changelog.

## Contributing

You want to contribute to this repository? This is so great!
The best way to start is to [open a new ticket](https://bugsfinancer.itwtserv.ovh) for bugs or feature requests or a discussion.

In case you want to contribute, but you wouldn't know how, here are some suggestions:

- Spread the word: vote for Financer on any software platform, toot or tweet about it, share it on LinkedIn, Reddit and any other social media platform!
- Translate Financer into your language, or help to improve the existing translations, many languages look for a contributor
- Answer questions: You know the answer to another user's problem? Share your knowledge.
- Something can be done better? An essential feature is missing? Create a [feature request](https://bugsfinancer.itwtserv.ovh)
- Report [bugs](https://bugsfinancer.itwtserv.ovh) makes Financer better for everyone.
- You don't have to be programmer, the documentation and translation could always use some attention.
- Sponsor the project: free software costs money to create!

There is one simple rule in our "Code of conduct": Don't be an ass!

