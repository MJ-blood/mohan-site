const root = document.documentElement;
const mobile = window.matchMedia('(max-width: 700px)');
const compactArticle = window.matchMedia('(max-width: 800px)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionToggle = document.querySelector('.motion-toggle');
const animations = new Set();
const motionKey = 'mohan-motion-paused';
let paused = false;
try { paused = localStorage.getItem(motionKey) === 'true'; } catch { /* Storage is optional. */ }
root.classList.add('js');

const canAnimate = () => !paused && !reducedMotion.matches && !document.hidden && typeof Element.prototype.animate === 'function';
const animate = (element, frames, options = {}) => {
  if (!canAnimate()) return null;
  const animation = element.animate(frames, { duration: 220, easing: 'cubic-bezier(.22, 1, .36, 1)', ...options });
  animations.add(animation);
  const clear = () => animations.delete(animation);
  animation.addEventListener('finish', clear, { once: true });
  animation.addEventListener('cancel', clear, { once: true });
  return animation;
};
const updateMotion = () => {
  root.classList.toggle('motion-enabled', !paused && !reducedMotion.matches);
  root.classList.toggle('motion-background-paused', document.hidden);
  // Finish state changes as well as entrances, so a paused disclosure remains usable.
  if (!canAnimate()) [...animations].forEach(animation => animation.finish());
  motionToggle.hidden = false;
  motionToggle.disabled = reducedMotion.matches;
  motionToggle.setAttribute('aria-pressed', String(paused || reducedMotion.matches));
  motionToggle.setAttribute('aria-label', reducedMotion.matches ? '已跟随系统减少动效' : paused ? '播放动效' : '暂停动效');
  motionToggle.textContent = reducedMotion.matches ? '动效：减' : paused ? '动效：关' : '动效：开';
};
const restoreMotion = () => {
  try { paused = localStorage.getItem(motionKey) === 'true'; } catch { /* Keep the in-memory choice. */ }
  updateMotion();
};
motionToggle.addEventListener('click', () => {
  paused = !paused;
  try { localStorage.setItem(motionKey, String(paused)); } catch { /* Current-page controls still work. */ }
  updateMotion();
});
reducedMotion.addEventListener('change', updateMotion);
document.addEventListener('visibilitychange', updateMotion);
window.addEventListener('pageshow', restoreMotion);
window.addEventListener('storage', event => { if (event.key === motionKey || event.key === null) restoreMotion(); });
updateMotion();

const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.primary-nav');
menuButton.hidden = false;
function closeMenu(restoreFocus = false) {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
  navigation.inert = mobile.matches;
  if (restoreFocus) menuButton.focus();
}
menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  navigation.classList.toggle('is-open', !isOpen);
  navigation.inert = isOpen;
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') closeMenu(true);
});
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
mobile.addEventListener('change', () => closeMenu());
window.addEventListener('pageshow', () => closeMenu());
closeMenu();

const article = document.querySelector('.article-body');
const progress = document.querySelector('.reading-progress');
if (article && progress) {
  progress.hidden = false;
  let scheduled = false;
  const updateProgress = () => {
    const bounds = article.getBoundingClientRect();
    const offset = document.querySelector('.site-header').getBoundingClientRect().height;
    progress.style.top = `${offset}px`;
    const distance = bounds.height - window.innerHeight + offset;
    const fraction = distance > 0 ? Math.min(1, Math.max(0, (offset - bounds.top) / distance)) : 1;
    progress.firstElementChild.style.transform = `scaleX(${fraction})`;
    scheduled = false;
  };
  const schedule = () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateProgress); }
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  updateProgress();
}

// One entrance per content group. Article headers/body and archive rows never wait to appear.
if ('IntersectionObserver' in window) {
  const hero = document.querySelector('.hero-layout');
  if (hero) animate(hero, [{ opacity: .65, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320 });
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      if (!entry.target.contains(document.activeElement)) {
        animate(entry.target, [{ opacity: .5, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320 });
      }
      observer.unobserve(entry.target);
    });
  }, { threshold: .06 });
  document.querySelectorAll('.home-writing .article-list, .work-grid, .loop-panel, .now-grid').forEach(group => {
    if (group.getBoundingClientRect().top >= innerHeight) observer.observe(group);
  });
  const loopObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('is-in-view', entry.isIntersecting));
  });
  document.querySelectorAll('.loop-panel').forEach(panel => loopObserver.observe(panel));
}
// Keyboard focus must land on a stable, visible element.
document.addEventListener('focusin', event => {
  [...animations].forEach(animation => {
    if (animation.effect.target.contains(event.target)) animation.finish();
  });
});

const archive = document.querySelector('[data-archive]');
if (archive) {
  const index = JSON.parse(document.getElementById('article-search-index').textContent);
  const input = archive.querySelector('#article-search');
  const buttons = [...archive.querySelectorAll('[data-topic]')];
  const rows = [...archive.querySelectorAll('[data-post]')];
  const groups = [...archive.querySelectorAll('[data-year]')];
  const picker = archive.querySelector('.topic-picker');
  const panel = picker.querySelector('.topic-filters');
  const summary = picker.querySelector('summary');
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase();
  Object.values(index).forEach(post => { post.text = normalize(post.text); });
  let topic = '';
  let pickerAnimation;
  let pickerOpen = false;
  let rowAnimations = [];
  const setPicker = (open, restoreFocus = false) => {
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
  document.addEventListener('click', event => { if (pickerOpen && !picker.contains(event.target)) setPicker(false); });
  picker.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); setPicker(false, true); }
  });
  const update = (writeUrl = true, motion = true) => {
    const elements = [...rows, ...groups.map(group => group.querySelector('h2'))];
    const before = new Map(elements.filter(element => element.getClientRects().length).map(element => [element, element.getBoundingClientRect().top]));
    rowAnimations.forEach(animation => animation.cancel());
    rowAnimations = [];
    const words = normalize(input.value.trim()).split(/\s+/).filter(Boolean);
    let count = 0;
    rows.forEach(row => {
      const post = index[row.dataset.post];
      const visible = (!topic || post.tags.includes(topic)) && words.every(word => post.text.includes(word));
      row.hidden = !visible;
      if (visible) count++;
    });
    groups.forEach(group => { group.hidden = ![...group.querySelectorAll('[data-post]')].some(row => !row.hidden); });
    buttons.forEach(button => {
      const active = button.dataset.topic === topic;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    archive.querySelector('[data-topic-label]').textContent = topic || '全部';
    archive.querySelector('#result-count').textContent = `共 ${count} 篇`;
    archive.querySelector('.archive-empty').hidden = count > 0;
    if (motion && canAnimate()) elements.forEach(element => {
      if (!element.getClientRects().length) return;
      const previous = before.get(element);
      const delta = previous === undefined ? 6 : previous - element.getBoundingClientRect().top;
      if (previous !== undefined && Math.abs(delta) < .5) return;
      const animation = animate(element, [
        { transform: `translateY(${delta}px)`, opacity: previous === undefined ? .3 : 1 },
        { transform: 'none', opacity: 1 },
      ]);
      if (animation) rowAnimations.push(animation);
    });
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
    update(false, false);
  };
  archive.querySelector('.archive-tools').hidden = false;
  archive.querySelector('.search-form').addEventListener('submit', event => { event.preventDefault(); update(); });
  input.addEventListener('input', () => update());
  buttons.forEach(button => button.addEventListener('click', () => {
    topic = button.dataset.topic;
    setPicker(false, true);
    update();
  }));
  archive.querySelector('[data-clear-search]').addEventListener('click', () => {
    input.value = '';
    topic = '';
    update();
    input.focus();
  });
  window.addEventListener('popstate', restore);
  window.addEventListener('pageshow', restore);
  restore();
}

const articleToc = document.querySelector('.article-toc');
if (articleToc) {
  let tocAnimation;
  let targetOpen = !compactArticle.matches;
  articleToc.open = targetOpen;
  const nav = articleToc.querySelector('nav');
  const setToc = open => {
    targetOpen = open;
    const start = articleToc.getBoundingClientRect().height;
    tocAnimation?.cancel();
    articleToc.style.overflow = 'hidden';
    articleToc.open = open;
    const end = articleToc.getBoundingClientRect().height;
    articleToc.open = true;
    nav.inert = !open;
    tocAnimation = animate(articleToc, [{ height: `${start}px` }, { height: `${end}px` }], { duration: 200 });
    const finish = () => { articleToc.open = open; articleToc.style.overflow = ''; };
    if (tocAnimation) tocAnimation.addEventListener('finish', finish, { once: true });
    else finish();
  };
  articleToc.querySelector('summary').addEventListener('click', event => { event.preventDefault(); setToc(!targetOpen); });
  compactArticle.addEventListener('change', () => {
    tocAnimation?.cancel();
    targetOpen = !compactArticle.matches;
    articleToc.open = targetOpen;
    articleToc.style.overflow = '';
    nav.inert = !targetOpen;
  });
}
