(function () {
  const key = 'novelread-demo';
  const readState = () => JSON.parse(localStorage.getItem(key) || '{}');
  const writeState = (state) => localStorage.setItem(key, JSON.stringify(state));
  const hash = async (value) => { const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); };
  const toast = (message) => { let el = document.querySelector('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.append(el); } el.textContent = message; el.classList.add('show'); clearTimeout(window.__novelToast); window.__novelToast = setTimeout(() => el.classList.remove('show'), 2600); };
  const getIdentity = () => readState().identity || null;
  const setIdentity = (identity) => { const state = readState(); state.identity = identity; writeState(state); window.dispatchEvent(new Event('novelread:changed')); };
  const saveProgress = (bookId, chapterNumber) => { const state = readState(); state.progress = { ...(state.progress || {}), [bookId]: chapterNumber }; writeState(state); };
  const getProgress = (bookId) => (readState().progress || {})[bookId] || 1;
  const commentsFor = (chapterId) => (readState().comments || {})[chapterId] || [];
  const addComment = (chapterId, text) => { const state = readState(); state.comments = state.comments || {}; state.comments[chapterId] = [...(state.comments[chapterId] || []), { text, author: getIdentity()?.name || 'Reader', at: new Date().toLocaleDateString() }]; writeState(state); };
  window.NovelRead = { readState, writeState, hash, getIdentity, setIdentity, saveProgress, getProgress, commentsFor, addComment, toast };

  async function connectBackend() {
    try {
      const config = await import('./supabase-config.js');
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const values = config.default || window.SUPABASE_CONFIG;
      if (!values?.url || values.url.includes('YOUR_PROJECT') || !values.anonKey || values.anonKey.includes('YOUR_PUBLIC')) {
        if (location.pathname.endsWith('account.html')) toast('Supabase is not connected. Add your real project URL and anon key to supabase-config.js.');
        return null;
      }
      const client = createClient(values.url, values.anonKey);
      window.NovelRead.supabase = client;
      window.dispatchEvent(new CustomEvent('novelread:connected', { detail: client }));
      await updateAccountStatus(client);
      await hydrateFromSupabase(client);
      return client;
    } catch (error) {
      window.NovelRead.backendError = error;
      return null;
    }
  }

  function createAccountStatus() {
    const actions = document.querySelector('.header-actions');
    if (!actions || actions.querySelector('[data-account-status]')) return;
    const link = document.createElement('a');
    link.className = 'account-status';
    link.dataset.accountStatus = 'true';
    link.href = 'account.html';
    link.title = 'Reader account';
    link.innerHTML = '<span class="account-avatar guest">○</span><span class="status-label">Sign in</span>';
    actions.prepend(link);
  }

  async function updateAccountStatus(client) {
    createAccountStatus();
    const link = document.querySelector('[data-account-status]');
    if (!link) return;
    let user = null;
    let profile = null;
    if (client) {
      const session = await client.auth.getSession();
      user = session.data.session?.user || null;
      if (user) {
        const result = await client.from('reader_profiles').select('display_name,is_author').eq('id', user.id).maybeSingle();
        profile = result.data;
      }
    }
    if (!user && getIdentity()) {
      link.href = 'account.html';
      link.title = 'Reader account';
      link.innerHTML = `<span class="account-avatar">${escapeHtml(getIdentity().name.slice(0, 1).toUpperCase())}</span><span class="status-label">${escapeHtml(getIdentity().name)}</span>`;
      return;
    }
    if (!user) {
      link.href = 'account.html';
      link.title = 'Not signed in — open reader account';
      link.innerHTML = '<span class="account-avatar guest">○</span><span class="status-label">Sign in</span>';
      return;
    }
    const name = profile?.display_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'Reader';
    link.href = profile?.is_author ? 'admin.html' : 'account.html';
    link.title = profile?.is_author ? 'Author account' : 'Reader account';
    link.innerHTML = `<span class="account-avatar signed-in">${escapeHtml(name.slice(0, 1).toUpperCase())}</span><span class="status-label">${escapeHtml(name)}</span>`;
  }

  async function hydrateFromSupabase(client) {
    const page = location.pathname.split('/').pop() || 'index.html';
    if (page === 'browse.html') await renderLiveLibrary(client);
    if (page === 'read.html') await renderLiveReader(client);
    if (page === 'account.html') await wireLiveAccount(client);
    if (page === 'admin.html') await renderLiveStudio(client);
  }

  async function renderLiveLibrary(client) {
    const { data, error } = await client.from('books').select('*').eq('published', true).order('created_at', { ascending: false });
    if (error || !data?.length) return;
    const list = document.querySelector('#bookList');
    if (!list) return;
    list.innerHTML = data.map((book) => `<article class="book-card"><div class="book-cover ${book.cover_class || 'cover-tide'}"><span>${book.type || 'Book'} · Published</span><strong>${book.title}</strong><small>ZRAFF KORAZON</small></div><div class="book-meta"><div><h3>${escapeHtml(book.title)}</h3><p>${escapeHtml(book.type || 'Book')}</p></div><span class="status">Published</span></div><p class="book-summary">${escapeHtml(book.synopsis || '')}</p><a class="read-link" href="read.html?book=${encodeURIComponent(book.slug)}">Open book <span>↗</span></a></article>`).join('');
  }

  async function renderLiveReader(client) {
    const slug = new URLSearchParams(location.search).get('book');
    if (!slug) return;
    const { data: book } = await client.from('books').select('*').eq('slug', slug).eq('published', true).maybeSingle();
    if (!book) return;
    const { data: chapters } = await client.from('chapters').select('*').eq('book_id', book.id).eq('status', 'published').order('number');
    if (!chapters?.length) return;
    const number = Number(new URLSearchParams(location.search).get('chapter')) || 1;
    const chapter = chapters.find((item) => item.number === number) || chapters[0];
    const text = chapter.body_markdown || '';
    document.querySelector('#bookType').textContent = `${book.type || 'Book'} · Published`;
    document.querySelector('#bookTitle').textContent = book.title;
    document.querySelector('#bookSynopsis').textContent = book.synopsis || '';
    document.querySelector('#warnings').innerHTML = (book.content_warnings || []).length ? `<div class="warning-box"><span>Content notes</span>${book.content_warnings.join(' · ')}</div>` : '';
    document.querySelector('#toc').innerHTML = chapters.map((item) => `<li class="${item.id === chapter.id ? 'selected' : ''}"><a href="?book=${encodeURIComponent(book.slug)}&chapter=${item.number}">Chapter ${String(item.number).padStart(2, '0')}<strong>${escapeHtml(item.title)}</strong></a></li>`).join('');
    document.querySelector('#progressLabel').textContent = `${book.title} · ${chapter.number} / ${chapters.length}`;
    document.querySelector('#chapterContent').innerHTML = `<p class="eyebrow">Chapter ${String(chapter.number).padStart(2, '0')}</p><h2>${escapeHtml(chapter.title)}</h2>${text.split(/\n\s*\n/).map((paragraph, index) => `<p class="${index === 0 ? 'dropcap' : ''}">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('')}`;
    document.querySelector('#prevChapter').onclick = () => navigateChapter(book.slug, chapters, chapter.number - 1);
    document.querySelector('#nextChapter').onclick = () => navigateChapter(book.slug, chapters, chapter.number + 1);
    const { data: { user } } = await client.auth.getUser();
    if (user) {
      await client.from('reading_progress').upsert({ user_id: user.id, book_id: book.id, chapter_id: chapter.id, last_read_at: new Date().toISOString() });
      const { data: comments } = await client.from('comments').select('body,created_at,reader_profiles(display_name)').eq('chapter_id', chapter.id).eq('hidden', false).order('created_at');
      document.querySelector('#commentHint').textContent = 'Commenting with your private reader identity.';
      document.querySelector('#commentList').innerHTML = (comments || []).map((comment) => `<div class="comment"><strong>${escapeHtml(comment.reader_profiles?.display_name || 'Reader')}</strong><span>${new Date(comment.created_at).toLocaleDateString()}</span><p>${escapeHtml(comment.body)}</p></div>`).join('');
      document.querySelector('#commentForm').onsubmit = async (event) => { event.preventDefault(); const body = document.querySelector('#commentText').value.trim(); if (!body) return; const result = await client.from('comments').insert({ chapter_id: chapter.id, user_id: user.id, body }); if (result.error) toast(result.error.message); else location.reload(); };
    } else {
      document.querySelector('#commentForm').innerHTML = '<a class="button button-dark" href="account.html">Sign in to comment <span>↗</span></a>';
    }
    await client.from('analytics_events').insert({ book_id: book.id, chapter_id: chapter.id, event_type: 'chapter_view' });
  }

  function navigateChapter(slug, chapters, number) { const next = chapters.find((item) => item.number === number); if (next) location.href = `read.html?book=${encodeURIComponent(slug)}&chapter=${number}`; else toast('You reached the end of this book.'); }

  async function wireLiveAccount(client) {
    const { data: { session } } = await client.auth.getSession();
    const signIn = async () => { const result = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } }); if (result.error) toast(result.error.message); };
    const google = document.querySelector('#googleButton'); if (google) google.onclick = signIn;
    const form = document.querySelector('#pseudonymForm');
    if (form) form.onsubmit = async (event) => { event.preventDefault(); const name = document.querySelector('#name').value.trim(); const password = document.querySelector('#password').value; const alias = `pseudonym-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@auth.zraffkorazon.invalid`; const result = await client.auth.signUp({ email: alias, password, options: { data: { display_name: name, provider: 'pseudonym' } } }); if (result.error) toast(result.error.message); else location.reload(); };
    if (!session) return;
    document.querySelector('#loggedOut').hidden = true; document.querySelector('#loggedIn').hidden = false;
    const { data: profile } = await client.from('reader_profiles').select('display_name').eq('id', session.user.id).maybeSingle();
    document.querySelector('[data-identity-name]').textContent = profile?.display_name || session.user.user_metadata?.display_name || 'Reader';
    const { data: progress } = await client.from('reading_progress').select('chapter_id,books(title,slug),chapters(number)').eq('user_id', session.user.id);
    document.querySelector('#progressList').innerHTML = (progress || []).map((item) => `<div class="progress-row"><span>${escapeHtml(item.books?.title || 'Book')}</span><strong>Chapter ${item.chapters?.number || 1}</strong><a href="read.html?book=${encodeURIComponent(item.books?.slug || '')}&chapter=${item.chapters?.number || 1}">Read ↗</a></div>`).join('') || '<p class="muted">Start reading to build your progress.</p>';
  }

  async function renderLiveStudio(client) {
    const { data: { user } } = await client.auth.getUser();
    if (!user) { toast('Author sign-in is required for the studio.'); setTimeout(() => { location.href = 'author.html'; }, 900); return; }
    const { data: profile } = await client.from('reader_profiles').select('is_author').eq('id', user.id).maybeSingle();
    if (!profile?.is_author) { toast('This account is not marked as the author.'); setTimeout(() => { location.href = 'author.html'; }, 900); return; }
    const { data: books } = await client.from('books').select('title,status,updated_at').order('updated_at', { ascending: false });
    if (books?.length) document.querySelectorAll('.manuscript-row').forEach((row, index) => { const book = books[index]; if (book) row.querySelector('strong').textContent = book.title; });
  }

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[match])); }
  document.addEventListener('DOMContentLoaded', () => {
    document.title = document.title.replace(/Mara Ellery/g, 'Zraff Korazon');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const textNodes = []; while (walker.nextNode()) textNodes.push(walker.currentNode); textNodes.forEach((node) => { node.nodeValue = node.nodeValue.replace(/Mara Ellery|MARA ELLERY|Mara/g, (match) => match === 'MARA ELLERY' ? 'ZRAFF KORAZON' : 'Zraff Korazon'); });
    document.querySelectorAll('[data-identity-name]').forEach((el) => { const identity = getIdentity(); el.textContent = identity ? identity.name : 'Anonymous reader'; });
    document.querySelectorAll('[data-signout]').forEach((button) => button.addEventListener('click', async () => { if (window.NovelRead.supabase) await window.NovelRead.supabase.auth.signOut(); const state = readState(); delete state.identity; writeState(state); location.reload(); }));
    document.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => { document.body.classList.toggle('dark-reader'); localStorage.setItem('novelread-theme', document.body.classList.contains('dark-reader') ? 'dark' : 'light'); }));
    if (localStorage.getItem('novelread-theme') === 'dark') document.body.classList.add('dark-reader');
    createAccountStatus();
    connectBackend();
  });
})();
