# EdvVoice Portal

Voice-Based Complaint Registration & Grievance Management System.

Group 3 · Department of Information Technology · GHRCE Nagpur · 2026–27

React + Vite + Tailwind on the front, FastAPI + SQLAlchemy behind it, Web
Speech API for voice input, Cloudinary for evidence, Resend for email.

---

## Running it

You need **two terminals**. Use Command Prompt on Windows, not PowerShell.

### Terminal 1 — backend

```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

On macOS or Linux use `source .venv/bin/activate` and `cp` instead of `copy`.

Python 3.12 is the safest version. On 3.13 or newer, some packages have no
prebuilt build yet and pip tries to compile them from source, which fails
without a Rust toolchain. If `pip install` errors on pydantic-core, see the
troubleshooting section in DEPLOYMENT.md.

Check http://localhost:8000/api/health — it reports which services are
configured. API docs are at http://localhost:8000/docs.

### Terminal 2 — frontend

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in **Chrome or Edge**. Firefox has no Web Speech
API, so live transcription will not work there.

### Accounts

Students register themselves through the app. Staff accounts are **not**
self-service — there is no sign-up route for them:

```
cd backend
.venv\Scripts\activate
python create_admin.py "Student Cell Head" admin@ghrce.edu.in
```

It asks for a password, then that account signs in at the normal login page
and lands on the admin dashboard. One login page serves both roles.

---

## The database

The schema comes from `grievance_system.sql` — same table names, same column
names, so moving to PostgreSQL is a connection string change:

```
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/grievance_system
```

then `pip install "psycopg[binary]"`. SQLite is used locally so nothing needs
installing first.

### Additions to the original schema

`backend/schema_additions.sql` holds them. Every statement is additive —
nothing dropped, nothing renamed, every new column nullable or defaulted — so
the original dump still loads:

| Addition | Why |
| --- | --- |
| `students.password_hash`, `admins.password_hash` | The original tables had no password column, so nobody could sign in |
| `complaints.priority` | The NLP layer works out urgency; the admin queue needs somewhere to put it |
| `complaints.notes` | The optional "room number, time of day" field |
| `complaint_attachments.file_type`, `.file_size` | The evidence viewer needs to know image vs video before rendering |
| `complaint_status_history` table | The original keeps only the current status, so the progress timeline had nowhere to live |
| `password_reset_tokens` table | Supports the reset emails |

Apply them with:

```
psql -d grievance_system -f backend/schema_additions.sql
```

**No role column.** Which table an account lives in *is* the role — students
authenticate against `students`, admins against `admins`. That follows the
original design rather than bolting a flag onto it.

**No stored tracking ID.** The `GRV1021` students quote is derived as
`'GRV' || (1020 + complaint_id)`. It is stable because `complaint_id` never
changes, and it saves keeping a second column in sync.

---

## The NLP engine

`backend/services/nlp.py`. Three jobs:

**1. `validate()` — is this actually a complaint?**

Stops test recordings, greetings and background noise reaching the queue.
It catches empty input, one or two word recordings, test phrases ("testing
one two three", "can you hear me"), a single word repeated, gibberish with no
vowels, and text with no problem described at all.

It errs towards **accepting** on purpose. Wrongly rejecting a real grievance
is a far worse failure than letting a junk one through, because a student who
gets turned away may never report the problem again. So a short but specific
complaint — "wifi is very slow", "projector broken in lab 2" — is accepted
even though it falls under the usual word count, because it names a thing and
says what is wrong with it.

Every rejection returns a reason written for the student, saying what to add
rather than just refusing.

**2. `classify()` — which department, and how urgent?**

Keyword scoring across five categories. If a student picks "Academic" but
describes a broken hostel tap, it is filed under Hostel. Priority comes from
signal words: "electric shock" or "ragging" becomes Urgent, "for three days"
or "no response" becomes High, "just a suggestion" becomes Low.

**3. `summarise()` — a short title** for lists and tables.

### The trained classifier

`backend/ml/` trains a TF-IDF + LinearSVC model that takes over the category
decision. It learns from 600 synthetic complaints and is measured on 69
hand-written ones it never sees:

| Measure | Score |
| --- | --- |
| Held-out hand-written test set | 87.0% |
| Rule-engine baseline, same data | 72.5% |

```
cd backend/ml
pip install scikit-learn pandas joblib
python generate_dataset.py
python train_model.py
```

The model is **optional**. `services/nlp.py` loads it if the file exists and
scikit-learn is installed, and runs on keyword rules otherwise, so the API
never fails to start because of it. Below 0.25 confidence the rules are kept,
since a confident keyword match beats an uncertain prediction.

Priority and `validate()` stay rule-based: urgency comes from signal words
that need no training data, and the validator has to explain its refusals to
the student in words.

Full method, caveats and how to improve it: `backend/ml/README.md`.

### Where validation happens

Twice, deliberately. The browser checks as the student types, so unusable
input is caught while it can still be fixed. The server checks again on
submit, because the browser check can be bypassed.

---

## How a complaint flows

1. Student records. The Web Speech API transcribes live in the browser —
   free, instant, no server involved.
2. As they finish, `POST /api/complaints/validate` says whether it reads as a
   real complaint, and which department it looks like. The category selection
   updates to match.
3. Photos and videos upload to Cloudinary via `POST /api/uploads`.
4. `POST /api/complaints` validates again, classifies, and saves. The voice
   recording is attached too, so the original speech stays on the record.
5. The student gets a tracking ID and a confirmation email.
6. Admin opens it, reviews the evidence, changes the status. That assigns the
   complaint to them, emails the student, and is written to the history table.

---

## API

All routes under `/api`. Everything except the auth endpoints needs an
`Authorization: Bearer <token>` header.

| Method | Route | Who |
| --- | --- | --- |
| POST | `/auth/register` · `/auth/login` | Anyone |
| GET | `/auth/me` | Signed in |
| POST | `/auth/forgot-password` · `/auth/reset-password` | Anyone |
| GET | `/auth/reset-password/verify` | Anyone |
| POST | `/complaints/validate` | Signed in |
| POST | `/complaints` | Students only |
| GET | `/complaints` | Own complaints; admins see all |
| GET | `/complaints/{ref}` | Owner or admin |
| GET | `/complaints/stats` | Signed in |
| GET | `/complaints/breakdown` | Admin |
| PATCH | `/complaints/{ref}/status` | Admin |
| POST | `/uploads` | Signed in |

Security worth knowing, since it will come up in your viva:

- Passwords are bcrypt hashed, never stored or logged in plain text.
- Login gives the same error for a wrong password and an unknown email, so it
  cannot be used to discover who is registered.
- Forgot-password always replies identically, for the same reason.
- A student requesting someone else's complaint gets 404, not 403 — a 403
  would confirm the ID exists.
- Reset tokens are single use and expire in 30 minutes.
- Admins cannot file complaints; students cannot reach admin endpoints.

---

## Configuration

`backend/.env`. Everything is optional except the database — the app runs
without any keys, and the features that need them say so clearly.

| Setting | Needed for | Where to get it |
| --- | --- | --- |
| `DATABASE_URL` | Everything | Already set to SQLite |
| `JWT_SECRET` | Sign in | Generate your own (command is in the file) |
| `RESEND_API_KEY` | Reset + notification emails | resend.com/api-keys |
| `CLOUDINARY_*` | Evidence uploads | console.cloudinary.com |

**Never commit `backend/.env` or paste its contents anywhere.** It is
gitignored. If a key leaks, revoke it in the provider's dashboard and make a
new one.

Resend only sends from `onboarding@resend.dev` to *your own* signup address
until you verify a domain. Test with your own email.

---

## PostgreSQL

SQLite is the default and needs nothing installed. When you are ready to move
to PostgreSQL, see `POSTGRESQL.md` — `backend/migrate_to_postgres.py` copies
your data across and the switch is one line in `.env`. Your SQLite file is
only read, so you can switch back at any time.

---

## Deploying

See `DEPLOYMENT.md`. Frontend on Vercel, backend and database on Render, both
free. Two things to know before you start: Render's free Postgres is deleted
30 days after creation, so make it close to when you need it; and Render free
services sleep after 15 minutes idle, so the first request after a quiet spell
takes about a minute.

---

## Project layout

```
edvvoice/
  frontend/              React + Vite + Tailwind
    public/              Logo and icons
    src/
      components/        Layouts, voice recorder, evidence uploader/viewer, UI kit
      lib/api.js         Every backend call lives here
      lib/auth.jsx       JWT session handling
      pages/             Auth, student screens, admin screens
  DEPLOYMENT.md          Vercel + Render walkthrough
  POSTGRESQL.md          Moving from SQLite to PostgreSQL
  backend/               FastAPI + SQLAlchemy
    main.py              App entry
    models.py            Maps onto grievance_system.sql
    schemas.py           Request/response shapes
    schema_additions.sql ALTER TABLE statements for the Postgres database
    create_admin.py      Creates staff accounts
    migrate_to_postgres.py  Copies SQLite data into PostgreSQL
    render.yaml          Render Blueprint — API and database
    routers/             auth, complaints, uploads
    services/            nlp, email (Resend), storage (Cloudinary)
    ml/                  Complaint classifier
      generate_dataset.py  Builds the synthetic training set
      train_model.py       Trains and evaluates it
      data/                complaints_train.csv (generated),
                           complaints_test.csv (hand-written)
      model/               classifier.joblib
```
