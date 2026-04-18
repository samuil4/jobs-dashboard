# Jobs Dashboard

Manufacturing jobs dashboard built with Vue 3 + Vite. Tracks production targets, captures history of completed parts, supports archiving and localization (English, Bulgarian, Ukrainian), and persists data in Supabase.

## Features

- Create, edit and archive jobs with name, optional **purchase order (PO)** (shown as `PO: …` before the job name on staff cards and in the client portal only when set), optional **invoice** (staff job form only; in the client portal it appears after the status badge on the job row when set), target quantity, produced quantity, assignee (`Samuil`, `Oleksii`, `Veselin`), and priority (`Low`, `Normal`, `High`, `Urgent`) with color-coded badges.
- Assign each job to a client, or leave it unassigned.
- Manage clients from a dedicated staff page with add, edit, delete, and calculated workload totals.
- Client portal with separate login, client-only routing, and client-only job visibility: jobs table with status color accent (active blue, completed green, archived gray), columns **Requested / Produced / Delivered / Ready for pickup** (produced minus delivered), PO before the job name when present, invoice after the status badge when set, progress under the name, fixed ordering (in-progress jobs first by priority, then completed, then archived; ties by `created_at` newest first), and search by job name, PO, or invoice.
- Header actions grouped into a dropdown menu, including navigation to the clients page.
- Incremental production updates with confirmation when exceeding the remaining quantity.
- Automatic completion state when produced equals required.
- History timeline for every job update.
- Filter/search by status, archived state or keyword.
- Real-time in-app notifications when parts are produced, delivered, or failed (Supabase Realtime).
- Optional push notifications when the app is minimized or closed (Web Push via Edge Function), including client-scoped notifications in the client portal.
- Client share links: password-protected read-only job view at `/share/:jobId` for non-registered users (parts needed, parts produced, parts ready for delivery). Access TTL 72 hours.
- Simple username/password login (Supabase auth) for staff, plus a separate client login flow and logout.
- CSV seeding script to bootstrap data from `reference/uchet_izdeliy.csv`.
- i18n-ready UI with runtime language switcher (English default).

## Prerequisites

- Node.js 20.19+ (or 22.12+)
- Supabase project (free tier is sufficient)

## Supabase Setup

1. Create a new Supabase project and note the **Project URL**, **Anon key**, and **Service role key**.
2. In the SQL editor run the following migration to create tables:

```sql
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parts_needed integer not null,
  parts_produced integer not null default 0,
  parts_overproduced integer not null default 0,
  notes text default null,
  delivered integer not null default 0,
  archived boolean not null default false,
  status text not null default 'active' check (status in ('active','completed','archived')),
  assignee text not null check (assignee in ('Samuil','Oleksii','Veselin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.job_updates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  delta integer not null,
  update_type text not null default 'production' check (update_type in ('production','delivery')),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.jobs enable row level security;
alter table public.job_updates enable row level security;

create policy "jobs are readable by authenticated users"
  on public.jobs for select
  using (auth.role() = 'authenticated');

create policy "jobs are writable by authenticated users"
  on public.jobs for all
  using (auth.role() = 'authenticated');

create policy "job updates are readable by authenticated users"
  on public.job_updates for select
  using (auth.role() = 'authenticated');

create policy "job updates are writable by authenticated users"
  on public.job_updates for all
  using (auth.role() = 'authenticated');
```

2.1. If you have an existing database (created before overproduction support was added), run this migration:

```sql
-- Add parts_overproduced column to jobs table
ALTER TABLE public.jobs
ADD COLUMN parts_overproduced INTEGER NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.jobs.parts_overproduced IS 'Number of parts produced beyond the requested amount (parts_needed)';
```

2.2. If you have an existing database (created before notes and delivered support was added), run this migration:

```sql
ALTER TABLE public.jobs
ADD COLUMN notes TEXT DEFAULT NULL,
ADD COLUMN delivered INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.jobs.notes IS 'Optional notes for the job';
COMMENT ON COLUMN public.jobs.delivered IS 'Number of parts delivered';
```

2.3. If you have an existing database (created before delivery history support was added), run this migration:

```sql
ALTER TABLE public.job_updates
ADD COLUMN update_type TEXT NOT NULL DEFAULT 'production'
  CHECK (update_type IN ('production','delivery'));

COMMENT ON COLUMN public.job_updates.update_type IS 'production = parts produced, delivery = parts delivered';
```

2.4. Add the atomic `add_production` function (runs UPDATE jobs + INSERT job_updates in a single transaction):

```sql
CREATE OR REPLACE FUNCTION public.add_production(
  p_job_id uuid,
  p_delta integer,
  p_updated_by uuid,
  p_created_at timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  inserted_row json;
BEGIN
  IF p_delta <= 0 THEN
    RAISE EXCEPTION 'Delta must be positive: %', p_delta;
  END IF;

  UPDATE public.jobs
  SET
    parts_produced = LEAST(
      parts_needed,
      parts_produced + COALESCE(parts_overproduced, 0) + p_delta
    ),
    parts_overproduced = GREATEST(
      0,
      parts_produced + COALESCE(parts_overproduced, 0) + p_delta - parts_needed
    ),
    status = CASE
      WHEN archived THEN 'archived'
      WHEN LEAST(
        parts_needed,
        parts_produced + COALESCE(parts_overproduced, 0) + p_delta
      ) >= parts_needed THEN 'completed'
      ELSE 'active'
    END,
    updated_at = p_created_at
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;

  INSERT INTO public.job_updates (job_id, delta, update_type, updated_by, created_at)
  VALUES (p_job_id, p_delta, 'production', p_updated_by, p_created_at)
  RETURNING * INTO rec;

  inserted_row := row_to_json(rec);
  RETURN inserted_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_production(uuid, integer, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_production(uuid, integer, uuid, timestamptz) TO service_role;
```

2.5. Add the atomic `add_delivery` function (runs UPDATE jobs + INSERT job_updates in a single transaction):

```sql
CREATE OR REPLACE FUNCTION public.add_delivery(
  p_job_id uuid,
  p_delta integer,
  p_updated_by uuid,
  p_created_at timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  inserted_row json;
BEGIN
  UPDATE public.jobs
  SET delivered = delivered + p_delta, updated_at = p_created_at
  WHERE id = p_job_id
    AND (delivered + p_delta) <= (parts_produced + parts_overproduced);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or delivered would exceed total parts produced: %', p_job_id;
  END IF;

  INSERT INTO public.job_updates (job_id, delta, update_type, updated_by, created_at)
  VALUES (p_job_id, p_delta, 'delivery', p_updated_by, p_created_at)
  RETURNING * INTO rec;

  inserted_row := row_to_json(rec);
  RETURN inserted_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_delivery(uuid, integer, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_delivery(uuid, integer, uuid, timestamptz) TO service_role;
```

2.6. Add client share functionality (password-protected share links). Share passwords are hashed with bcrypt $2b$ (frontend uses bcryptjs); the backend verifies via pgcrypto `extensions.crypt`:

```sql
-- Add share_password_hash column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS share_password_hash text;

-- Enable pgcrypto extension for bcrypt (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- RPC: Verify job share password and return job data if valid
-- Stored hashes are bcrypt $2b$; uses schema-qualified extensions.crypt for verification
CREATE OR REPLACE FUNCTION public.verify_job_share_password(p_job_id uuid, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hash text;
  v_result jsonb;
BEGIN
  SELECT share_password_hash INTO v_hash FROM jobs WHERE id = p_job_id;
  IF v_hash IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'no_share_password');
  END IF;
  IF extensions.crypt(p_password, v_hash) != v_hash THEN
    RETURN jsonb_build_object('valid', false);
  END IF;
  SELECT jsonb_build_object(
    'valid', true,
    'job', jsonb_build_object(
      'id', id, 'name', name, 'parts_needed', parts_needed,
      'parts_produced', parts_produced, 'parts_overproduced', COALESCE(parts_overproduced, 0),
      'delivered', COALESCE(delivered, 0)
    )
  ) INTO v_result
  FROM jobs WHERE id = p_job_id;
  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.verify_job_share_password(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_job_share_password(uuid, text) TO authenticated;
```

**Note:** Share password verification uses an Edge Function (`verify-job-share-password`) instead of the RPC above, because the frontend hashes passwords with bcryptjs ($2b$) and pgcrypto's `crypt()` does not reliably verify those hashes in Supabase. Deploy the Edge Function:

```bash
supabase functions deploy verify-job-share-password --no-verify-jwt
```

The function requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (set as secrets or provided by Supabase). It is invoked with `--no-verify-jwt` so anonymous users can call it from the share view.

2.6. Add clients, client/job access control, and client-scoped push subscriptions by running `supabase/migrations/0007_clients_and_client_access.sql`.

This migration adds:

- `public.clients` linked to `auth.users`
- `jobs.client_id`
- role-aware helper functions and RLS policies
- client-only access to assigned jobs and job history
- `client_push_subscriptions` for client portal notifications

2.7. Add job priority support by running `supabase/migrations/0009_job_priority.sql`:

```sql
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

ALTER TABLE public.jobs
ADD CONSTRAINT jobs_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

COMMENT ON COLUMN public.jobs.priority IS 'Job priority level: low, normal, high, or urgent.';
```

Existing jobs default to `normal`. The priority badge is displayed next to the status badge on each job card and in the client portal.

2.8. Add optional purchase order on jobs by running `supabase/migrations/0010_job_purchase_order.sql`:

```sql
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS purchase_order text NULL;
```

Staff set or clear PO from the job create/edit modal. Empty values are stored as `NULL` and are not shown in the UI.

2.9. Add optional invoice on jobs by running `supabase/migrations/0011_job_invoice.sql`:

```sql
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS invoice text NULL;
```

Staff set or clear invoice from the job create/edit modal. When set, clients see **Invoice:** _value_ after the status badge on the portal job row.

3. Create at least one Supabase auth user for staff. The app expects usernames without domain; during login the username is transformed into an email using `VITE_SUPABASE_AUTH_EMAIL_DOMAIN` (default `example.com`). For example, username `operator` becomes Supabase email `operator@example.com`.

4. Deploy the staff-only Edge Function used by the clients page to create, update, and delete client auth users:

```bash
supabase functions deploy manage-client-users
```

The function requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It uses the caller's JWT to verify that only staff users can manage client accounts.

### Manufacturing Notifications (Optional)

The app shows real-time in-app toasts when parts are produced, delivered, or failed. When the app is minimized, OS-level push notifications are supported.

**In-app notifications (Realtime):** Run the migration `supabase/migrations/0004_realtime_job_updates.sql` to enable Supabase Realtime on `job_updates`.

**Push notifications (when app is minimized):**

1. Run migration `supabase/migrations/0005_push_subscriptions.sql`.
2. Generate VAPID keys: `npm run vapid-keys` (or `node scripts/generate-vapid-keys.mjs`). No Deno needed — uses npx deno internally. Saves the JSON output and the application server key.
3. Set secrets:
   - `VAPID_KEYS_JSON`: the full JSON output (for the Edge Function).
   - Add `VITE_VAPID_PUBLIC_KEY` to your client env (the application server key from stderr).
4. Deploy the Edge Function: `supabase functions deploy send-manufacturing-push --no-verify-jwt`
5. Create a Database Webhook in Supabase Dashboard: **Database Webhooks** → Create webhook on `public.job_updates` INSERT → Target Edge Function `send-manufacturing-push`.

This staff notification flow now excludes client users. Client users subscribe through the client portal and receive notifications only for jobs assigned to their own client account.

**Share view (real-time updates, web push, PWA install):**

1. Run migration `supabase/migrations/0006_share_tokens_and_push.sql`.
2. Deploy Edge Functions (share flow uses anon key, no JWT):
   - `supabase functions deploy get-job-share-data --no-verify-jwt`
   - `supabase functions deploy register-share-push --no-verify-jwt`
3. `verify-job-share-password` must be redeployed (returns share token). `send-manufacturing-push` must be redeployed (sends to share recipients).

### Clients And Client Portal

After applying migration `0007_clients_and_client_access.sql` and deploying `manage-client-users`, the app supports:

- a staff-only `Clients` page for creating and managing clients
- assigning one client per job from the job form
- a separate client login at `/client/login`
- a client jobs page at `/client/jobs`
- route protection so clients cannot navigate to staff pages
- client-scoped search (job name, PO, or invoice) and archived-job toggling in the client portal
- editable **notes** on jobs in the completed and archived drawer (same behavior as active job cards)

Client credentials are stored in Supabase Auth. Client usernames are converted internally to emails using the fixed domain `clients.jobs-dashboard.local`, so client accounts should be created through the app's clients page rather than manually in the Auth dashboard.

## Environment Variables

Create a `.env.local` file in the project root:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
# Optional: change the email domain used to map usernames to Supabase email addresses
VITE_SUPABASE_AUTH_EMAIL_DOMAIN=example.com
# Optional: for push notifications when app is minimized (see Manufacturing Notifications)
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key-base64url
```

For seeding you also need (can be placed in shell env):

```
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Install & Run

```bash
npm install
npm run dev
```

## What Still Needs To Be Done

If the code is already pulled locally, the remaining setup to make the new client functionality work in a real environment is:

1. Apply `supabase/migrations/0007_clients_and_client_access.sql`.
2. Apply `supabase/migrations/0009_job_priority.sql` to add the priority column.
3. Apply `supabase/migrations/0010_job_purchase_order.sql` for the optional `purchase_order` column (required for current app versions that read/write this field).
4. Apply `supabase/migrations/0011_job_invoice.sql` for the optional `invoice` column when using app versions that read/write this field.
5. Deploy `manage-client-users`.
6. Redeploy `send-manufacturing-push` so it includes client portal subscriptions.
7. Ensure `SUPABASE_SERVICE_ROLE_KEY` is available to the deployed Edge Functions.
8. Create at least one staff account in Supabase Auth.
9. Sign in as staff and create client accounts from the new clients page instead of creating them manually in the Supabase Auth dashboard.

Recommended manual verification after setup:

1. Staff can open the dashboard and clients pages.
2. Staff can create, edit, and delete clients.
3. Staff can assign a client to a job.
4. Staff can set and change job priority (low, normal, high, urgent) when creating or editing a job.
5. Priority badges display with correct colors next to the status badge on job cards and in the client portal.
6. Client can sign in at `/client/login`.
7. Client can only access `/client/jobs` and is redirected away from staff routes.
8. Client only sees jobs assigned to that client.
9. Archived client jobs stay hidden until explicitly requested.
10. Staff can set an optional PO on a job; it appears before the job name when present.
11. Staff can edit notes on jobs in the completed/archived column.
12. Client portal list order and columns match the behavior described under **Features** (including **Ready for pickup**).
13. Staff can set an optional invoice; clients see it after the status on the portal row when present.

### Build for Production

```bash
npm run build
```

### Deploy to Vercel

1. Push this repository to GitHub (or another Git provider supported by Vercel).
2. In the Vercel dashboard choose **Add New Project** → **Import Git Repository** and select your repo.
3. When prompted for build settings:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install`
   - **Output Directory:** `dist`
4. Define the required environment variables under **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - (optional) `VITE_SUPABASE_AUTH_EMAIL_DOMAIN`
5. Deploy. Subsequent pushes to the default branch (and PR branches) will trigger automatic builds.

The included `vercel.json` ensures history-based routes (e.g. `/jobs/active`) fall back to `index.html`, so client-side routing works for direct URL visits.

### Lint

```bash
npm run lint
```

## Seed Supabase from CSV

You can populate the database using the provided reference CSV:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:csv
```

The script will assign assignees in a round-robin order and convert history timestamps into ISO values.

## Internationalization

Translations live under `src/locales/`. English is the default, with Bulgarian and Ukrainian provided. The language switcher persists the selection in `localStorage`.

To add another language:

1. Create a new locale file in `src/locales`.
2. Register it in `src/i18n/index.ts` and in `AVAILABLE_LOCALES`.
3. Add translated strings matching the existing keys.
