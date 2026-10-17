import { required } from './dom';
import { animate } from './motion';
const compactArticle = window.matchMedia('(max-width: 800px)');
const article = document.querySelector('.article-body');
const progress = document.querySelector<HTMLElement>('.reading-progress');
if (article && progress) {
  progress.hidden = false;
  let scheduled = false;
  const updateProgress = () => {
    const bounds = article.getBoundingClientRect();
    const offset = required('.site-header').getBoundingClientRect().height;
    progress.style.top = `${offset}px`;
    const distance = bounds.height - window.innerHeight + offset;
    const fraction = distance > 0 ? Math.min(1, Math.max(0, (offset - bounds.top) / distance)) : 1;
    required('span', progress).style.transform = `scaleX(${fraction})`;
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

const articleToc = document.querySelector<HTMLDetailsElement>('.article-toc');
if (articleToc) {
  let tocAnimation: Animation | null;
  let targetOpen = !compactArticle.matches;
  articleToc.open = targetOpen;
  const nav = required('nav', articleToc);
  const setToc = (open: boolean) => {
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
  required('summary', articleToc).addEventListener('click', event => { event.preventDefault(); setToc(!targetOpen); });
  compactArticle.addEventListener('change', () => {
    tocAnimation?.cancel();
    targetOpen = !compactArticle.matches;
    articleToc.open = targetOpen;
    articleToc.style.overflow = '';
    nav.inert = !targetOpen;
  });
}
