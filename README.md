# NovelRead

NovelRead is a multi-page author showcase and reading experience.

## Current pages

- `index.html` — author landing page
- `browse.html` — book library
- `read.html?book=low-tide` — chapter reader, table of contents, progress, and comments
- `account.html` — pseudonym reader identity and progress
- `Super Interesting/` — the Markdown manuscript imported into the reader

Without Supabase credentials, the pages fall back to a local preview mode. With `supabase-config.js` present, the site connects to the live Supabase backend and reads books, chapters, comments, progress, analytics, and reader identities from Postgres/Auth.

## Production connection

Run `supabase/schema.sql` in the Supabase SQL editor before deploying. It creates the data model, author-only policies, comment moderation, progress storage, analytics events, and the auth trigger that creates a private reader profile. Configure Google as an OAuth provider in Supabase. Keep password hashing and sessions inside Supabase Auth; never move them into client-side storage in production.

If the Supabase project already has the starter data, run `supabase/import-super-interesting.sql` as well. The reader uses the five Markdown chapters in `Super Interesting/` as a local content fallback while the database chapter bodies are being uploaded.

The free-tier deployment target is Cloudflare Pages with Pages Functions or Workers for server-side operations. Supabase's free plan is suitable for an early personal site but can pause inactive projects and does not provide automatic backups, so manuscript exports should remain an independent scheduled backup.
