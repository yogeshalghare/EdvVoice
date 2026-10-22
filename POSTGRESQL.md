# Moving to PostgreSQL

**Do not do this the night before a demo.** SQLite works; this is for after.

Nothing here deletes your SQLite file. It is read, copied, and left alone, so
you can switch back by changing one line.

---

## 1. Get a PostgreSQL database

**Option A — Neon (free, nothing to install, recommended)**

1. neon.tech → sign up → create a project
2. Copy the connection string. It looks like:
   `postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb`

**Option B — PostgreSQL on your laptop**

1. postgresql.org/download/windows → installer → remember the password you set
2. Open pgAdmin or psql and create the database:

```sql
CREATE DATABASE grievance_system;
```

3. Your URL is:
   `postgresql://postgres:YOUR_PASSWORD@localhost:5432/grievance_system`

---

## 2. Copy your data across

From `backend`, with the environment active:

```
python migrate_to_postgres.py "YOUR_CONNECTION_STRING"
```

It creates the tables, copies every row in dependency order, and resets the
PostgreSQL sequences so the next complaint does not collide with a copied id.

It stops if the target already has data, so you cannot duplicate everything by
running it twice. `--force` overrides that if you mean it.

Expected output:

```
  students                        3 row(s)
  admins                          1 row(s)
  complaints                      7 row(s)
  complaint_attachments           9 row(s)
  complaint_status_history       11 row(s)
```

---

## 3. Point the app at it

In `backend/.env`:

```
DATABASE_URL=postgresql://user:password@host:5432/grievance_system
```

Restart the server. Check http://localhost:8000/api/health — `"database"`
should now say `postgresql`.

Sign in and confirm your complaints are there.

`postgres://`, `postgresql://` and `postgresql+psycopg://` are all accepted —
the app rewrites them, so paste whatever your provider gives you.

---

## Going back

Change `DATABASE_URL` in `.env` back to:

```
DATABASE_URL=sqlite:///./edvvoice.db
```

Restart. Everything is exactly as it was — the file was never modified.

---

## If something goes wrong

**"Could not reach PostgreSQL"** — wrong host, port or password, or the
service is not running. On Windows check "postgresql-x64" in Services.

**"password authentication failed"** — wrong password. On a local install it
is the one set during setup, not your Windows password.

**"relation does not exist"** after switching — the tables were never created.
The app creates them on startup, so restart the server once.

**Neon connection drops when idle** — free Neon databases sleep after a few
minutes. The first request wakes it, taking a second or two. `pool_pre_ping`
is already enabled, so this is handled.

---

## For your teammate

The schema matches `grievance_system.sql`. If they are managing the database
themselves, they should apply `backend/schema_additions.sql` to it — that adds
the password columns, priority, notes, attachment metadata, the status history
table and the reset token table, all without touching their original design.
