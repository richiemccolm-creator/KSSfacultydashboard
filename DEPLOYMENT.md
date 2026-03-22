# Deployment Guide — Curriculum Design and Report Builder

## Prerequisites

1. **Supabase account** — [supabase.com](https://supabase.com)
2. **Vercel account** — [vercel.com](https://vercel.com)
3. **GitHub account** (optional, for Vercel Git integration)

---

## Step 1: Create Supabase Project

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. **Important:** Choose a UK/EU region (e.g. `eu-west-1`) for GDPR data residency
4. Wait for the project to be ready

### Run the database migrations

1. In Supabase Dashboard, go to **SQL Editor**
2. Run each migration in order:
   - `supabase/migrations/20250318000000_initial_schema.sql`
   - `supabase/migrations/20250318100000_allowed_emails.sql`
   - `supabase/migrations/20250318100001_admin_and_shared_calendar.sql`
   - `supabase/migrations/20250322000000_audit_log.sql`

### Disable public sign-up (recommended)

1. Go to **Authentication → Providers → Email**
2. Turn **OFF** "Enable email signups"
3. Users can only sign in if invited or if you add them to the allowlist (see below)

### Allowlist and admin setup

1. Go to **Table Editor** → `allowed_emails`
2. Add rows for each user who may log in:
   - **email** — the user's email (must match Supabase Auth)
   - **display_name** — optional display name
   - **is_admin** — `true` for Faculty Head / admin, `false` for staff
3. **Admin users** can:
   - Load all staff tracker data in the Faculty Head Dashboard ("Load from cloud")
   - Add and edit shared calendar events (visible to everyone)
4. **Non-admin users** see only their own data and cannot edit shared calendar events

### Shared calendar

- Admin-added events in the Academic Calendar are stored in `shared_calendar_events` and appear for all users
- Personal events are stored per user in `pupil_data.academicCalendarEvents`
- To seed default Glasgow term dates: log in as admin, open the Academic Calendar, and add events (or run a one-off SQL insert into `shared_calendar_events`)

### Enable authentication providers

1. Go to **Authentication → Providers**
2. **Email:** Enable Email/Password
3. **Google:** Add Google provider (create OAuth credentials in Google Cloud Console)
4. **Microsoft:** Add Azure AD provider (for Microsoft 365 schools)

### Get your credentials

1. Go to **Project Settings → API**
2. Copy **Project URL** and **anon public** key

### Deploy the GDPR delete-user Edge Function

The app uses an Edge Function for full account deletion (auth + profiles + pupil_data). Deploy it from your project root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy delete-user
```

Or use the Supabase Dashboard: **Edge Functions** → create function `delete-user` and paste the code from `supabase/functions/delete-user/index.ts`.

---

## Step 2: Configure the app

1. Open `config.js`
2. Replace the placeholder values:

```javascript
window.SUPABASE_URL = 'https://your-project-ref.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key';
```

---

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import your Git repository, or upload the project folder
4. **Framework Preset:** Other
5. **Root Directory:** leave as `.` (or the folder containing the project)
6. **Build Command:** leave empty (static site)
7. **Output Directory:** `.`
8. Click **Deploy**

### Option B: Deploy via Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts. When asked for build settings, leave them empty.

---

## Step 4: Configure Supabase redirect URLs

After deployment, add your Vercel URL to Supabase:

1. Supabase Dashboard → **Authentication → URL Configuration**
2. Add to **Redirect URLs:**
   - `https://your-app.vercel.app/login.html`
   - `https://your-app.vercel.app/**`
3. Set **Site URL** to `https://your-app.vercel.app`

---

## Step 5: OAuth setup (Google / Microsoft)

### Google

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorised redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase → Authentication → Providers → Google

### Microsoft (Azure AD)

1. [Azure Portal](https://portal.azure.com) → App registrations → New registration
2. Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
3. Create client secret
4. Copy Application (client) ID and secret to Supabase → Authentication → Providers → Azure

---

## Environment variables (optional)

If you prefer not to store credentials in `config.js`, you can use a build step to inject them. This requires adding a simple build script (e.g. with Node.js) that reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Vercel env vars and writes them into `config.js` at build time. For a static site without a build step, editing `config.js` directly is the simplest approach.

---

## Post-deployment checklist

- [ ] Run all Supabase migrations (initial, allowed_emails, admin + shared calendar, audit_log)
- [ ] Deploy the `delete-user` Edge Function (required for GDPR account deletion)
- [ ] Add your email to `allowed_emails` with `is_admin = true`
- [ ] Disable email signups in Supabase Auth (if using allowlist-only access)
- [ ] Update `config.js` with real credentials
- [ ] Add redirect URLs in Supabase
- [ ] **GDPR:** Sign or confirm Data Processing Agreement with Supabase (Dashboard → Settings → Infrastructure)
- [ ] **GDPR:** Verify Supabase project is in UK/EU region (e.g. eu-west-1)
- [ ] Test sign in (email/password)
- [ ] Test OAuth (if configured)
- [ ] Test data save/load in a tracker
- [ ] Test Faculty Head Dashboard "Load from cloud" (admin only)
- [ ] Test shared calendar (admin adds event, staff sees it)
- [ ] Test Privacy Policy: Export my data and Delete my account (full erasure)

---

## Custom domain

In Vercel: Project → Settings → Domains → Add your school domain. Update DNS as instructed. Then add the new domain to Supabase redirect URLs.
