# SlugSync

SlugSync is a campus event calendar app built with Vite, React, Supabase, and
Supabase Edge Functions. It supports personal events, community events, friend
and group sharing, profile setup, avatar uploads, UCSC event imports, source
parsing, and AI-powered schedule summaries.

## Tech Stack

- React 18
- Vite
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Edge Functions
- Google Gemini API
- FullCalendar
- Tailwind CSS v4
- Vitest and React Testing Library

## Prerequisites

Install these before running the project:

- Git
- Node.js and npm, preferably Node 18 or newer

For full backend/function development, also install:

- Supabase CLI
- Docker, if you want to run Supabase locally

## Getting Started

Clone the repo, then move into the app directory:

```bash
git clone <repo-url>
cd slugsync/SlugSync
```

Install frontend dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Fill in the Supabase values in `.env`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Start the Vite development server:

```bash
npm run dev
```

Vite will print the local URL in your terminal, usually:

```text
http://localhost:5173/
```

## Environment Variables

Frontend variables are stored in `.env`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

These come from your Supabase project settings.

Supabase Edge Functions also require this secret:

```bash
GEMINI_API_KEY=
```

Set it in Supabase, not in the frontend `.env` file:

```bash
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
```

Without the Gemini key, the app can still run, but AI features will fail.

## Supabase Setup

The app needs a Supabase project with Auth, Postgres, Storage, and Edge
Functions enabled.

Database SQL files live in:

```text
src/lib/supabase/
supabase/sources.sql
```

Apply the SQL files to your Supabase project before using the app fully. They
define tables, policies, and helper functions for:

- profiles
- events
- groups
- group members
- shared group events
- friendships
- user preferences
- event sources
- visibility and privacy rules

The profile avatar flow also expects a Supabase Storage bucket for avatars.

## Supabase Edge Functions

Edge Functions live in:

```text
supabase/functions/parse-event
supabase/functions/parse-source
supabase/functions/daily-digest
```

These functions power:

- parsing pasted event text
- parsing events from a webpage/source URL
- generating schedule digests
- answering schedule questions

Deploy them with the Supabase CLI:

```bash
supabase functions deploy parse-event
supabase functions deploy parse-source
supabase functions deploy daily-digest
```

## Available Scripts

Run the local development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview a production build:

```bash
npm run preview
```

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Project Structure

```text
src/
  App.jsx
  components/
  context/
  data/
  hooks/
  lib/
  pages/
  test/
  main.jsx
  index.css

supabase/
  config.toml
  functions/
  sources.sql
```

## Quick Setup Summary

For a new developer using an existing configured Supabase project:

```bash
git clone <repo-url>
cd slugsync/SlugSync
npm install
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

That is enough to start the app locally. Full functionality also requires the
Supabase database schema, storage bucket, deployed Edge Functions, and the
`GEMINI_API_KEY` function secret.
