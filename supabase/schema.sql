create extension if not exists pgcrypto;

create table if not exists public.reader_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 32),
  provider text not null default 'pseudonym' check (provider in ('pseudonym','google')),
  is_author boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  type text not null default 'Novel',
  synopsis text not null default '',
  cover_class text not null default 'cover-tide',
  content_warnings text[] not null default '{}',
  published boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','scheduled')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  number integer not null check (number > 0),
  title text not null,
  body_markdown text not null default '',
  status text not null default 'draft' check (status in ('draft','published','scheduled')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id, number)
);

create table if not exists public.reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key(user_id, book_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_blocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  book_id uuid references public.books(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('book_view','chapter_view','chapter_complete')),
  created_at timestamptz not null default now()
);

create table if not exists public.backup_exports (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_reader() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.reader_profiles (id, display_name, provider)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Reader'), coalesce(new.raw_user_meta_data->>'provider', 'google'))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_reader();

alter table public.reader_profiles enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.reading_progress enable row level security;
alter table public.comments enable row level security;
alter table public.moderation_blocks enable row level security;
alter table public.analytics_events enable row level security;
alter table public.backup_exports enable row level security;

create policy "published books are public" on public.books for select using (published = true or exists (select 1 from public.reader_profiles where id = auth.uid() and is_author));
create policy "published chapters are public" on public.chapters for select using (status = 'published' or exists (select 1 from public.reader_profiles where id = auth.uid() and is_author));
create policy "profiles are private" on public.reader_profiles for select using (id = auth.uid() or exists (select 1 from public.reader_profiles where id = auth.uid() and is_author));
create policy "readers update own profile" on public.reader_profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "own progress" on public.reading_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "visible comments are public" on public.comments for select using (hidden = false or user_id = auth.uid() or exists (select 1 from public.reader_profiles where id = auth.uid() and is_author));
create policy "readers create comments" on public.comments for insert with check (user_id = auth.uid() and not exists (select 1 from public.moderation_blocks where user_id = auth.uid()));
create policy "readers delete own comments" on public.comments for delete using (user_id = auth.uid() or exists (select 1 from public.reader_profiles where id = auth.uid() and is_author));
create policy "author manages blocks" on public.moderation_blocks for all using (exists (select 1 from public.reader_profiles where id = auth.uid() and is_author));
create policy "author sees analytics" on public.analytics_events for select using (exists (select 1 from public.reader_profiles where id = auth.uid() and is_author));
create policy "anyone records analytics" on public.analytics_events for insert with check (true);
create policy "author manages books" on public.books for all using (exists (select 1 from public.reader_profiles where id = auth.uid() and is_author));
create policy "author manages chapters" on public.chapters for all using (exists (select 1 from public.reader_profiles where id = auth.uid() and is_author));
create policy "author manages backups" on public.backup_exports for all using (exists (select 1 from public.reader_profiles where id = auth.uid() and is_author));

insert into public.books (slug, title, type, synopsis, cover_class, content_warnings, published, status)
values ('super-interesting', 'Super Interesting', 'Novel', 'Sven Kruse has lost his nobility, his savings, and any hope that the law will protect his family. When a stolen magic potion draws danger to his door, survival becomes a matter of wit.', 'cover-tide', array['Fantasy violence', 'Threats', 'Mature themes'], true, 'published')
on conflict (slug) do nothing;

insert into public.chapters (book_id, number, title, status, published_at)
select id, number, title, 'published', now()
from public.books cross join (values
  (1, 'Nearer, Yet Farther'),
  (2, 'Even Justice Has a Price'),
  (3, 'Veiled Intentions'),
  (4, 'Entrapment'),
  (5, 'Redemption')
) as manuscript(number, title)
where books.slug = 'super-interesting'
on conflict (book_id, number) do nothing;
