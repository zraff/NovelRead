const readerDialog = document.querySelector('#readerDialog');
const loginDialog = document.querySelector('#loginDialog');
const toast = document.querySelector('#toast');
const openReader = () => readerDialog.showModal();
document.querySelectorAll('[data-open-reader]').forEach((button) => button.addEventListener('click', openReader));
document.querySelector('#closeReader').addEventListener('click', () => readerDialog.close());
document.querySelector('#readerLogin').addEventListener('click', () => loginDialog.showModal());
document.querySelector('#closeLogin').addEventListener('click', () => loginDialog.close());
document.querySelector('#themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-reader');
  showToast('Theme preference saved for this session.');
});
document.querySelector('#readerTheme').addEventListener('click', () => document.body.classList.toggle('dark-reader'));
let readerSize = 19;
document.querySelector('#fontUp').addEventListener('click', () => { readerSize = Math.min(readerSize + 2, 25); document.querySelector('.reader-content').style.fontSize = `${readerSize}px`; });
document.querySelector('#fontDown').addEventListener('click', () => { readerSize = Math.max(readerSize - 2, 15); document.querySelector('.reader-content').style.fontSize = `${readerSize}px`; });
document.querySelector('#nextChapter').addEventListener('click', () => showToast('Chapter navigation will connect to your published manuscript.'));
document.querySelector('#supportButton').addEventListener('click', (event) => { event.preventDefault(); showToast('Donation page coming soon.'); });
document.querySelectorAll('.note-grid a').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); showToast('Notebook archive coming soon.'); }));
function showToast(message) { toast.textContent = message; toast.classList.add('show'); window.clearTimeout(showToast.timeout); showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2800); }
