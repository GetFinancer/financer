<p align="center">
  <a href="https://getfinancer.com">
    <img src="https://raw.githubusercontent.com/GetFinancer/images/70648e7f78e51804b7f1e1d4751edf590e25776d/logo.png" alt="Financer logo">
  </a>
</p>

<p align="center">
    <a href="https://github.com/getfinancer/financer/actions"><img alt="CI Status" src="https://github.com/getfinancer/financer/actions/workflows/ci.yml/badge.svg"></a>
    <a href="https://github.com/getfinancer/financer/releases"><img alt="Release" src="https://img.shields.io/github/v/release/getfinancer/financer?include_prereleases=false"></a>
    <a href="https://github.com/getfinancer/financer/blob/main/docker-compose.yml"><img alt="Docker Ready" src="https://img.shields.io/badge/docker-ready-blue"></a>
</p>

<h1 align="center">Financer - Your #1 personal financer tracker</h1>

# Financer

A self or cloud-hosted Progressive Web App (PWA) for personal finance management.

## Features

- Track income and expenses 
- Manage multiple accounts (bank, cash, credit cards, savings)
- Categorize transactions
- Dashboard with monthly overview and charts
- Simple password protection (single-user)
- Mobile-friendly PWA (installable on phone)
- Offline-capable
- Docker deployment ready


### Links

- [Home](https://getfinancer.com) — Financer project homepage
- [Bugs/Features](https://financer.getbugio.com) — If you find a bug or want to request a new Feature
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
- **Database**: SQLite (file-based, no separate server needed)s
- **Auth**: Session-based with bcrypt password hashing

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `SESSION_SECRET` | - | Secret for session encryption (required in production) |
| `WEB_PORT` | 3000 | Web server port |
| `API_PORT` | 4000 | API server port |

## Data Persistence

All data is stored in a SQLite database file.

## Financer Cloud

If you don´t want to self host an instance feel free to visit - [Cloud version](https://getfinancer.com) 

## Installation

# Pre Requeistes
**Docker and Docker Compose must be installed**

# Installation Process

```bash
# Clone Repository
git clone https://github.com/GetFinancer/financer.git

# Create you .env file
cp .env.example .env

# Create Session Secret
openssl rand -base64 32

# Edit Parameters and create session secret with 
nano .env

# Create Datafolder and tenant folder. What you choose as tenant name will be than user.yourdomain.com
mkdir data && cd data && mkdir "your tenant name"

#Start Container
docker compose up -d
```
Call user.yourdomain.com in your browser

### Updating Financer

```bash
# Change into Financer directory
cd /path-on-your-server/financer

# run script
./update.sh
```
Script will ask you to keep your Backups. Your decision ;)

## Roadmap and releases

coming soon

## Contributing

You want to contribute to this repository? This is so great!
The best way to start is to [open a new ticket](https://financer.getbugio.com) for bugs or feature requests or a discussion.

In case you want to contribute, but you wouldn't know how, here are some suggestions:

- Spread the word: Please [write a testimonial](...review Link coming soon) , vote for Financer on any software platform, you can toot or tweet about it, share it on LinkedIn, Reddit and any other social media platform!
- Translate Financer into your language, or help to improve the existing translations, many languages look for a contributor
- Answer questions: You know the answer to another user's problem? Share your knowledge.
- Something can be done better? An essential feature is missing? Create a [feature request](https://financer.getbugio.com)
- Report [bugs](https://financer.getbugio.com) makes Financer better for everyone.
- You don't have to be programmer, the documentation and translation could always use some attention.
- Sponsor the project: free software costs money to create!

There is one simple rule in our "Code of conduct": Don't be an ass!

