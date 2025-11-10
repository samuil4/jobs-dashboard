# Jobs Dashboard

Manufacturing jobs dashboard built with Vue 3 + Vite. Tracks production targets, captures history of completed parts, supports archiving and localization (English, Bulgarian, Ukrainian), and persists data in Supabase.

## Features

- Create, edit and archive jobs with name, target quantity, produced quantity and assignee (`Samuil`, `Oleksii`, `Veselin`).
- Incremental production updates with confirmation when exceeding the remaining quantity.
- Automatic completion state when produced equals required.
- History timeline for every job update.
- Filter/search by status, archived state or keyword.
- Simple username/password login (Supabase auth), plus logout.
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

3. Create at least one Supabase auth user. The app expects usernames without domain; during login the username is transformed into an email using `VITE_SUPABASE_AUTH_EMAIL_DOMAIN` (default `example.com`). For example, username `operator` → Supabase email `operator@example.com`.

## Environment Variables

Create a `.env.local` file in the project root:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
# Optional: change the email domain used to map usernames to Supabase email addresses
VITE_SUPABASE_AUTH_EMAIL_DOMAIN=example.com
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

### Build for Production

```bash
npm run build
```

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
