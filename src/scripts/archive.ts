import { required } from './dom';
import { animate } from './motion';
const archive = document.querySelector('[data-archive]');
if (archive) {
  const index = JSON.parse(required('#article-search-index').textContent ?? '{}') as Record<string, { text: string; tags: string[] }>;
  const input = required<HTMLInputElement>('#article-search', archive);
  const buttons = [...archive.querySelectorAll<HTMLButtonElement>('[data-topic]')];
  const rows = [...archive.querySelectorAll<HTMLElement>('[data-post]')];
  const groups = [...archive.querySelectorAll<HTMLElement>('[data-year]')];
  const picker = required<HTMLDetailsElement>('.topic-picker', archive);
  const panel = required('.topic-filters', picker);
  const summary = required('summary', picker);
  const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase();
  Object.values(index).forEach(post => { post.text = normalize(post.text); });
  let topic = '';
  let pickerAnimation: Animation | null;
  let pickerOpen = false;
  const setPicker = (open: boolean, restoreFocus = false) => {
    pickerOpen = open;
    pickerAnimation?.cancel();
    if (restoreFocus) summary.focus();
    if (open) picker.open = true;
    panel.inert = !open;
    const frames = open
      ? [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }]
      : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-4px)' }];
    pickerAnimation = animate(panel, frames, { duration: 160 });
    const finish = () => { picker.open = open; };
    if (pickerAnimation) pickerAnimation.addEventListener('finish', finish, { once: true });
    else finish();
  };
  summary.addEventListener('click', event => { event.preventDefault(); setPicker(!pickerOpen); });
  document.addEventListener('click', event => { if (pickerOpen && event.target instanceof Node && !picker.contains(event.target)) setPicker(false); });
  picker.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); setPicker(false, true); }
  });
  const update = (writeUrl = true) => {
    const words = normalize(input.value.trim()).split(/\s+/).filter(Boolean);
    let count = 0;
    rows.forEach(row => {
      const post = index[row.dataset.post!];
      const visible = (!topic || post.tags.includes(topic)) && words.every(word => post.text.includes(word));
      row.hidden = !visible;
      if (visible) count++;
    });
    groups.forEach(group => { group.hidden = ![...group.querySelectorAll<HTMLElement>('[data-post]')].some(row => !row.hidden); });
    buttons.forEach(button => {
      const active = button.dataset.topic === topic;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    required('[data-topic-label]', archive).textContent = topic || '全部';
    required('#result-count', archive).textContent = `共 ${count} 篇`;
    required('.archive-empty', archive).hidden = count > 0;
    if (writeUrl) {
      const url = new URL(location.href);
      input.value.trim() ? url.searchParams.set('q', input.value.trim()) : url.searchParams.delete('q');
      topic ? url.searchParams.set('topic', topic) : url.searchParams.delete('topic');
      history.replaceState(null, '', url);
    }
  };
  const restore = () => {
    const params = new URLSearchParams(location.search);
    input.value = params.get('q') || '';
    topic = params.get('topic') || '';
    update(false);
  };
  required('.archive-tools', archive).hidden = false;
  required('.search-form', archive).addEventListener('submit', event => { event.preventDefault(); update(); });
  input.addEventListener('input', () => update());
  buttons.forEach(button => button.addEventListener('click', () => {
    topic = button.dataset.topic ?? '';
    setPicker(false, true);
    update();
  }));
  required('[data-clear-search]', archive).addEventListener('click', () => {
    input.value = '';
    topic = '';
    update();
    input.focus();
  });
  window.addEventListener('popstate', restore);
  window.addEventListener('pageshow', restore);
  restore();
}

