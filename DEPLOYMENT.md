# Publish NovelRead on your domain

## Cloudflare Pages

1. Create a GitHub repository and upload this project.
2. In Cloudflare: Workers & Pages → Create application → Pages → Connect to Git.
3. Select the repository.
4. Use Framework preset `None`, leave Build command empty, and use `/` as the output directory.
5. Deploy and open the temporary `pages.dev` address.
6. Open the project → Custom domains → Set up a domain.
7. Enter your domain and follow the DNS instructions. A root domain may require moving nameservers to Cloudflare; a `www` subdomain uses the CNAME Cloudflare provides.

Cloudflare Pages supports custom domains and HTTPS on its free plan.

## Supabase backend

1. Create a Supabase project on the Free plan.
2. Open the SQL Editor and run `supabase/schema.sql` from this project.
3. Enable Google under Authentication → Providers.
4. Add these URLs under Authentication → URL Configuration:
   - Site URL: `https://YOUR_DOMAIN`
   - Redirect URL: `https://YOUR_DOMAIN/account.html`
   - Remove any old `http://localhost:3000` entries when testing the production site.
5. For the pseudonym/password flow, disable email confirmation. The pseudonym flow uses a private synthetic auth address and never exposes an email address.
6. Copy `supabase-config.example.js` to `supabase-config.js`.
7. Replace its URL and anon key with values from Supabase → Project Settings → API.
8. Commit and redeploy. The Supabase anon key is public by design; never commit a service-role key.

The public anon key is safe to use in the browser. Never put a Supabase service-role key in this site.

## Make yourself the author

After creating your reader account, run this in Supabase SQL Editor, replacing the email with the account email:

```sql
update public.reader_profiles
set is_author = true
where id = (select id from auth.users where email = 'YOUR_AUTH_EMAIL');
```

The author studio is then protected by the `is_author` policy. Published books and chapters are public; drafts remain author-only.

## Production checklist

- Confirm `supabase/schema.sql` ran successfully.
- Add the author profile flag.
- Create published book and chapter rows before opening the reader.
- Keep manuscript exports independent of the live database.
- Monitor Supabase Free quotas and inactivity pausing.
