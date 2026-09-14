-- Run this after schema.sql if your Supabase project already contains the starter book.
-- The chapter text remains in the repository's Markdown files and is also used as a local fallback.

insert into public.books (slug, title, type, synopsis, cover_class, content_warnings, published, status)
values ('super-interesting', 'Super Interesting', 'Novel', 'Sven Kruse has lost his nobility, his savings, and any hope that the law will protect his family. When a stolen magic potion draws danger to his door, survival becomes a matter of wit.', 'cover-tide', array['Fantasy violence', 'Threats', 'Mature themes'], true, 'published')
on conflict (slug) do update set title = excluded.title, synopsis = excluded.synopsis, content_warnings = excluded.content_warnings, published = true, status = 'published', updated_at = now();

insert into public.chapters (book_id, number, title, status, published_at)
select id, manuscript.number, manuscript.title, 'published', now()
from public.books cross join (values
  (1, 'Nearer, Yet Farther'),
  (2, 'Even Justice Has a Price'),
  (3, 'Veiled Intentions'),
  (4, 'Entrapment'),
  (5, 'Redemption')
) as manuscript(number, title)
where books.slug = 'super-interesting'
on conflict (book_id, number) do update set title = excluded.title, status = 'published', published_at = now(), updated_at = now();
