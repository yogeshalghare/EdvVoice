# Deploying EdvVoice

Frontend on Vercel, backend and database on Render. Both free.

Do it in this order — the frontend needs the backend's URL, and the backend
needs the frontend's.

---

## Before you start

**Push to GitHub first.** Both platforms deploy from a repository.

Check `backend/.env` is **not** in the repo:

```
git status --porcelain backend/.env
```

That must print nothing. If it lists the file, your keys are about to go
public — remove it with `git rm --cached backend/.env` and commit before
pushing.

**One timing decision.** Render's free Postgres is deleted 30 days after it
is created, with a 14-day grace period. Create it close to your seminar, not
months ahead. If it does expire, point `DATABASE_URL` at a free Neon database
instead — that is the only change needed.

---

## 1. Backend and database on Render

`backend/render.yaml` describes both services, so Render can create them
together.

1. render.com → **New** → **Blueprint**
2. Connect your repository, pick the branch
3. Render reads `render.yaml` and shows the API plus the database. Apply.

It will ask for the values marked `sync: false`. Fill in what you have:

| Variable | Value |
| --- | --- |
| `APP_URL` | Leave blank for now — you get it in step 2 |
| `CORS_ORIGINS` | Same, fill in after step 2 |
| `RESEND_API_KEY` | From resend.com/api-keys |
| `CLOUDINARY_CLOUD_NAME` · `_API_KEY` · `_API_SECRET` | From your Cloudinary dashboard |
| `ADMIN_EMAIL` | The staff account to create, e.g. `admin@ghrce.edu.in` |
| `ADMIN_PASSWORD` | A real password — you sign in with this |

`JWT_SECRET` and `DATABASE_URL` are filled in automatically.

The first build takes five to ten minutes. When it finishes, open
`https://your-api.onrender.com/api/health`. You should see `"ok": true` and
`"database": "postgresql"`.

### The admin account

Render's free tier has no shell, so `create_admin.py` cannot be run against
the deployed database. `ADMIN_EMAIL` and `ADMIN_PASSWORD` exist for exactly
this: the account is created on first startup.

**Delete `ADMIN_PASSWORD` from the Render environment once you have signed in
successfully.** Leaving a password sitting in environment variables is not
something to keep around, and the account already exists by then.

---

## 2. Frontend on Vercel

1. vercel.com → **Add New** → **Project**, import the same repository
2. Set **Root Directory** to `frontend`. Framework preset: Vite
3. Add one environment variable:

```
VITE_API_URL = https://your-api.onrender.com/api
```

Note the `/api` on the end. Without it every request 404s.

4. Deploy. You get a URL like `https://edvvoice.vercel.app`.

`frontend/vercel.json` is already in the repo. It makes every path serve
`index.html`, so React Router handles routing. Without it, opening a password
reset link — `/reset-password?token=…` — returns a 404, which is the one
thing guaranteed to get tested.

---

## 3. Join the two halves

Back in Render, set both:

```
APP_URL      = https://edvvoice.vercel.app
CORS_ORIGINS = https://edvvoice.vercel.app
```

`APP_URL` is also what reset links in emails point at, so a wrong value sends
students to a dead address.

Render redeploys automatically. Once it is up, open your Vercel URL and
register an account.

---

## Checking it worked

1. `/api/health` on the Render URL shows `"ok": true` and `postgresql`
2. Register a student on the Vercel URL
3. Record a complaint and submit it
4. Sign out, sign in with `ADMIN_EMAIL` — you land on the admin dashboard
5. Open the complaint, view the evidence, change the status
6. Hard-refresh on a complaint detail page. It should load, not 404 — that
   proves the rewrite rule works

---

## A note on the Python version

`backend/.python-version` pins Python 3.12.7, and `render.yaml` sets
`PYTHON_VERSION` to the same.

Both are there on purpose. Render reads **only** those two — it ignores
`runtime.txt`, which is a Heroku convention. Without a pin, Render picks its
own default, and on the newest Python releases some packages have no prebuilt
build yet, so pip tries to compile from Rust source and the build fails.

---

## If pip fails on your machine

Two errors come up, both from version mismatches rather than anything wrong
with the project:

**"No matching distribution found"** — a pinned version no longer exists for
your Python. The requirements file is unpinned now, so this should not
happen; if it does, drop the `==` pin on whatever package it names.

**"Failed building wheel for pydantic-core"** on Python 3.13 or newer — there
is no prebuilt package for your Python yet, so pip tried to compile it from
Rust source. Either install Python 3.12 (which is what Render uses), or run
pip with no version pins at all:

```
pip install fastapi "uvicorn[standard]" python-multipart "pydantic[email]" pydantic-settings sqlalchemy pyjwt bcrypt httpx cloudinary python-dotenv "psycopg[binary]"
```

---

## Things that will catch you out

**The first request after idle takes about a minute.** Render free services
spin down after 15 minutes of inactivity. The browser will look frozen.
Open the site a few minutes before any demo so it is already awake.

**Emails only reach your own address.** Until a domain is verified in Resend,
`onboarding@resend.dev` delivers only to the address you signed up with.
Other students get no reset links and no notifications. Nothing errors — the
mail silently goes nowhere. Worth saying out loud in your presentation rather
than having someone discover it.

**Voice input needs HTTPS and Chrome.** Vercel gives HTTPS automatically, so
this works. Firefox has no Web Speech API, so the microphone will not
transcribe there.

**The database disappears at day 30.** Back it up before your demo:

```
pg_dump "YOUR_RENDER_EXTERNAL_DATABASE_URL" > backup.sql
```

**Changing the schema wipes nothing, but nothing migrates either.** Tables
are created on startup if missing; existing ones are left alone. If you add a
column later, add it with SQL yourself — see `backend/schema_additions.sql`
for the pattern.

---

## Moving the database to Neon later

If the Render database expires, or you want one that does not:

1. neon.tech → new project → copy the connection string
2. Run `backend/schema_additions.sql` against it, plus your teammate's
   `grievance_system.sql`
3. Change `DATABASE_URL` in Render to the Neon string

The backend accepts `postgres://`, `postgresql://` and
`postgresql+psycopg://` and rewrites them as needed, so paste whatever the
provider gives you.
