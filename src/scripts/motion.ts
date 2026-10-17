import { required } from './dom';
const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionToggle = required<HTMLButtonElement>('.motion-toggle');
const animations = new Set<Animation>();
const motionKey = 'mohan-motion-paused';
let paused = false;
try { paused = localStorage.getItem(motionKey) === 'true'; } catch { /* Storage is optional. */ }
root.classList.add('js');

export const canAnimate = () => !paused && !reducedMotion.matches && !document.hidden && typeof Element.prototype.animate === 'function';
export const animate = (element: Element, frames: Keyframe[], options: KeyframeAnimationOptions = {}) => {
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
    if (animation.effect instanceof KeyframeEffect && animation.effect.target instanceof Element && event.target instanceof Node && animation.effect.target.contains(event.target)) animation.finish();
  });
});

