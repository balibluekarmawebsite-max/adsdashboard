# Deployment — Bluehost cPanel / AlmaLinux 9

This is the copy-paste runbook to put the dashboard live at
**`https://ads.bluekarmasecrets.com`** on your existing Bluehost **dedicated**
server (cPanel/WHM on AlmaLinux 9) **without touching `bluekarmasecrets.com`**.

We deliberately **do not use Docker** (unsupported alongside cPanel). Instead:

```
Internet ──HTTPS──► Apache (cPanel vhost + AutoSSL)
                       │  reverse proxy
                       ▼
                 Next.js app (PM2, 127.0.0.1:3001)  ──►  PostgreSQL 16 (localhost)
                       │
                  in-process daily sync (node-cron)
```

Everything for the dashboard is isolated: its own subdomain vhost, its own
PostgreSQL instance, its own PM2 process. Your live site and its MySQL are untouched.

Throughout, replace the placeholders:

- `<CPUSER>` — the cPanel account username that will own the subdomain
- `<SERVER_IP>` — your server's public IP (from the Bluehost Hosting panel)
- `<DB_PASSWORD>` — a strong password you generate for the app's DB role

> Commands that change the system (installing packages, PostgreSQL, `pm2 startup`,
> the userdata includes) need **root** (WHM → Terminal, or `ssh root@<SERVER_IP>`).
> App commands run as `<CPUSER>`.

---

## 1. Prerequisites

- WHM/root access (WHM → Terminal works) and SSH access as `<CPUSER>`.
- Ability to add a DNS record for `ads.bluekarmasecrets.com` (in cPanel if your
  domain uses the server's nameservers, otherwise wherever your DNS lives).
- This repo pushed to GitHub (it is).

---

## 2. DNS + subdomain

1. **cPanel → Domains → Create A New Domain** → `ads.bluekarmasecrets.com`.
   Note the **document root** it creates (e.g. `~/ads.bluekarmasecrets.com` or
   `~/public_html/ads.bluekarmasecrets.com`) — you'll need it for the proxy.
2. **DNS:** if your domain uses the server's nameservers, cPanel already added the
   A record. If DNS is elsewhere (e.g. Cloudflare), add:
   `ads` → `A` → `<SERVER_IP>` (DNS-only / grey cloud for the initial AutoSSL).
3. Confirm it resolves: `dig +short ads.bluekarmasecrets.com` → `<SERVER_IP>`.

---

## 3. Install server packages (root)

```bash
# Node.js 22 (NodeSource) + PM2 + git
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs git
npm install -g pm2

# PostgreSQL 16 (PGDG)
dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
dnf -qy module disable postgresql
dnf install -y postgresql16-server postgresql16
/usr/pgsql-16/bin/postgresql-16-setup initdb
systemctl enable --now postgresql-16
```

Make the PG16 client tools available on PATH (for `psql` / `pg_dump`):

```bash
echo 'export PATH=/usr/pgsql-16/bin:$PATH' > /etc/profile.d/pgsql.sh
```

---

## 4. Create the database (root)

```bash
sudo -u postgres psql <<SQL
CREATE ROLE ads WITH LOGIN PASSWORD '<DB_PASSWORD>';
CREATE DATABASE adsdashboard OWNER ads;
SQL
```

Ensure password auth over loopback. Edit `/var/lib/pgsql/16/data/pg_hba.conf` and
confirm these two lines use `scram-sha-256` (change from `ident`/`peer` if needed):

```
host    all    all    127.0.0.1/32    scram-sha-256
host    all    all    ::1/128         scram-sha-256
```

Then reload and test:

```bash
systemctl reload postgresql-16
PGPASSWORD='<DB_PASSWORD>' psql -h 127.0.0.1 -U ads -d adsdashboard -c '\conninfo'
```

---

## 5. Get the app onto the server (as `<CPUSER>`)

Give the server **read-only** pull access to the private repo with a deploy key:

```bash
ssh-keygen -t ed25519 -C "adsdashboard-deploy" -f ~/.ssh/adsdashboard_deploy -N ""
cat ~/.ssh/adsdashboard_deploy.pub
```

Add that public key in **GitHub → repo → Settings → Deploy keys → Add** (read-only).
Then point git at it and clone into `~/apps/adsdashboard`:

```bash
cat >> ~/.ssh/config <<'CFG'
Host github-adsdashboard
  HostName github.com
  User git
  IdentityFile ~/.ssh/adsdashboard_deploy
  IdentitiesOnly yes
CFG
chmod 600 ~/.ssh/config

mkdir -p ~/apps
git clone git@github-adsdashboard:balibluekarmawebsite-max/adsdashboard.git ~/apps/adsdashboard
cd ~/apps/adsdashboard
git checkout main   # merge your feature branch into main first (see §12)
```

> First time only, before `main` exists you can deploy the feature branch:
> `git checkout claude/ads-dashboard-review-lw8a27` and set `DEPLOY_BRANCH` to it.

---

## 6. Configure `.env` (as `<CPUSER>`)

Create `~/apps/adsdashboard/.env` (never committed). Generate the secrets:

```bash
cd ~/apps/adsdashboard
echo "AUTH_SECRET=$(openssl rand -base64 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

```dotenv
# Database
DATABASE_URL=postgresql://ads:<DB_PASSWORD>@127.0.0.1:5432/adsdashboard?schema=public

# Auth (paste the generated values)
AUTH_SECRET=...
AUTH_URL=https://ads.bluekarmasecrets.com
ALLOW_PUBLIC_REGISTRATION=false

# Token encryption at rest (paste the generated value)
ENCRYPTION_KEY=...

# Google Ads (fill when connecting real data — see §14)
GOOGLE_DEVELOPER_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_LOGIN_CUSTOMER_ID=
GOOGLE_OAUTH_REDIRECT_URI=https://ads.bluekarmasecrets.com/api/auth/google/callback

# Meta (fill when connecting real data — see §14)
META_SYSTEM_USER_TOKEN=
META_APP_ID=
META_GRAPH_API_VERSION=v25.0
META_CONVERSION_ACTIONS=

# Sync engine
SYNC_TIMEZONE=Asia/Makassar
SYNC_ROLLING_DAYS=21
CRON_ENABLED=true
SYNC_CRON=30 2 * * *
```

`chmod 600 .env`.

---

## 7. First build, migrate, seed, start (as `<CPUSER>`)

```bash
cd ~/apps/adsdashboard
npm ci
npx prisma migrate deploy      # creates the tables
npx prisma db seed             # once: seeds the 4 properties
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 status                     # ads-dashboard should be "online"
curl -sI http://127.0.0.1:3001 | head -1   # HTTP/1.1 200 OK
```

### Keep it running across reboots (root once)

```bash
pm2 startup systemd -u <CPUSER> --hp /home/<CPUSER>   # prints a command…
# …run the printed `sudo env … pm2 …` command as root, then as <CPUSER>:
pm2 save
```

---

## 8. Reverse proxy the subdomain → the app

**Option A — `.htaccess` (simplest, no root).** Copy the contents of
`deploy/htaccess-proxy.txt` into an `.htaccess` at the subdomain's document root
(from §2). If Apache reports it can't proxy, enable `mod_proxy`, `mod_proxy_http`,
`mod_rewrite`, `mod_headers` in **WHM → EasyApache 4**.

**Option B — cPanel userdata include (robust, survives rebuilds, needs root).**
Use `deploy/apache-proxy-ssl.conf` and `deploy/apache-proxy-std.conf` — each file's
header has the exact install commands (paths + `ensure_vhost_includes` +
`rebuildhttpdconf` + restart).

Both keep `/.well-known/` local so AutoSSL can still validate.

---

## 9. HTTPS (AutoSSL)

**cPanel → SSL/TLS Status** → select `ads.bluekarmasecrets.com` → **Run AutoSSL**
(or WHM → Manage AutoSSL → Run for the user). Within a few minutes it issues a
free cert. Verify: `curl -sSI https://ads.bluekarmasecrets.com | head -1`.

---

## 10. Verify

- Visit `https://ads.bluekarmasecrets.com` → landing page over HTTPS.
- Go to `/register` and create the **first** account → it becomes **ADMIN** and
  lands on the dashboard. (Registration is then locked; `ALLOW_PUBLIC_REGISTRATION=false`.)
- The dashboard shows empty widgets until data is synced (§14).

---

## 11. CI/CD — auto-deploy on push to `main`

The workflow `.github/workflows/deploy.yml` SSHes in and runs
`scripts/server-deploy.sh` (pull → `npm ci` → `prisma migrate deploy` → build →
`pm2 reload`). Add these **repo → Settings → Secrets and variables → Actions**:

| Secret     | Value                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| `SSH_HOST` | `<SERVER_IP>` (or `ads.bluekarmasecrets.com`)                               |
| `SSH_USER` | `<CPUSER>`                                                                  |
| `SSH_KEY`  | a **private** key whose public half is in `~/<CPUSER>/.ssh/authorized_keys` |
| `SSH_PORT` | your SSH port (optional; defaults to 22)                                    |

Create the CI key (locally or on the server), then authorize it on the server:

```bash
ssh-keygen -t ed25519 -C "github-actions" -f gha_key -N ""
# put gha_key (private) into the SSH_KEY secret; append gha_key.pub to the server:
#   cat gha_key.pub >> ~/.ssh/authorized_keys   (as <CPUSER>)
```

Then **merge your feature branch into `main`** — that push triggers the deploy.

---

## 12. Nightly backups + a tested restore

```bash
cd ~/apps/adsdashboard
chmod +x scripts/backup-db.sh scripts/server-deploy.sh
./scripts/backup-db.sh                       # writes ~/backups/adsdashboard/*.sql.gz
crontab -e
# add:
30 3 * * * /home/<CPUSER>/apps/adsdashboard/scripts/backup-db.sh >> /home/<CPUSER>/backups/backup.log 2>&1
```

**Test the restore** (do this once, so you trust it) into a scratch DB:

```bash
sudo -u postgres createdb -O ads adsdashboard_restore
gunzip -c ~/backups/adsdashboard/adsdashboard-YYYYMMDD-HHMMSS.sql.gz \
  | PGPASSWORD='<DB_PASSWORD>' psql -h 127.0.0.1 -U ads -d adsdashboard_restore
# verify, then drop:
sudo -u postgres dropdb adsdashboard_restore
```

---

## 13. Connect Google & Meta (real data)

1. Put the real credentials in `.env` (§6), then `pm2 reload ecosystem.config.cjs --update-env`.
2. **Google:** as the ADMIN, open
   `https://ads.bluekarmasecrets.com/api/auth/google` and complete consent — the
   refresh token is captured and **encrypted** into the DB. (Ensure the redirect
   URI in Google Cloud matches `GOOGLE_OAUTH_REDIRECT_URI`.)
3. **Meta:** `npm run connect:meta` stores the System User token encrypted (or just
   leave `META_SYSTEM_USER_TOKEN` in `.env`).
4. Add your ad accounts to the `ad_accounts` table (property, platform, external id,
   currency) — via `npx prisma studio` over an SSH tunnel, or a small seed.
5. Pull now: `npm run sync:all` — then confirm rows and that the daily cron runs:
   `psql … -c "SELECT platform, status, started_at, rows_written FROM sync_logs ORDER BY started_at DESC LIMIT 10;"`

---

## 14. Operations & troubleshooting

| Symptom                             | Check                                                                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **502 Bad Gateway**                 | App down: `pm2 status`, `pm2 logs ads-dashboard`. Restart: `pm2 reload ecosystem.config.cjs`.                                                      |
| **AutoSSL won't issue**             | DNS not pointing yet, or `/.well-known/` is being proxied — confirm the exclusion is in place; re-run AutoSSL.                                     |
| **`next build` runs out of memory** | Add swap, or build with `NODE_OPTIONS=--max-old-space-size=1536 npm run build`.                                                                    |
| **Daily sync didn't run**           | `pm2 logs` for `[cron]`; check `sync_logs`. For restart-proof scheduling, set `CRON_ENABLED=false` and add a host cron calling `npm run sync:all`. |
| **DB auth fails**                   | `pg_hba.conf` must be `scram-sha-256` for `127.0.0.1`; `systemctl reload postgresql-16`.                                                           |
| **Env change not applied**          | `pm2 reload ecosystem.config.cjs --update-env` (and rebuild if code changed).                                                                      |

Useful:

```bash
pm2 logs ads-dashboard --lines 100
pm2 monit
systemctl status postgresql-16
```
