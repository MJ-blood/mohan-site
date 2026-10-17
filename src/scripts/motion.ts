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
  motionToggle.title = reducedMotion.matches ? '已跟随系统减少动态效果' : '减少页面入场、插画与交互的动态效果';
  motionToggle.textContent = reducedMotion.matches ? '已跟随系统减少动效' : '减少动效';
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

// Keyboard focus must land on a stable, visible element.
document.addEventListener('focusin', event => {
  [...animations].forEach(animation => {
    if (animation.effect instanceof KeyframeEffect && animation.effect.target instanceof Element && event.target instanceof Node && animation.effect.target.contains(event.target)) animation.finish();
  });
});

