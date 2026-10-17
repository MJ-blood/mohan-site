import { required } from './dom';

type Theme = 'light' | 'dark';
const root = document.documentElement;
const system = window.matchMedia('(prefers-color-scheme: dark)');
const button = required<HTMLButtonElement>('.theme-toggle');
const key = 'mohan-theme';
const validTheme = (value: string | null | undefined): Theme | null => value === 'light' || value === 'dark' ? value : null;
let choice = validTheme(root.dataset.theme);
const currentTheme = (): Theme => choice ?? (system.matches ? 'dark' : 'light');

function updateTheme() {
  if (choice) root.dataset.theme = choice;
  else delete root.dataset.theme;
  const dark = currentTheme() === 'dark';
  required('[data-theme-label]', button).textContent = dark ? '开灯' : '关灯';
  button.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
  button.querySelector('.theme-sun')?.toggleAttribute('hidden', !dark);
  button.querySelector('.theme-moon')?.toggleAttribute('hidden', dark);
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
    meta.content = dark ? '#101512' : '#faf9f6';
  });
  button.hidden = false;
}

function restoreTheme() {
  try { choice = validTheme(localStorage.getItem(key)); } catch { /* Retain the current-page choice. */ }
  updateTheme();
}
button.addEventListener('click', () => {
  choice = currentTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(key, choice); } catch { /* The button still works for this page. */ }
  updateTheme();
});
system.addEventListener('change', updateTheme);
window.addEventListener('pageshow', restoreTheme);
window.addEventListener('storage', event => { if (event.key === key || event.key === null) restoreTheme(); });
restoreTheme();
