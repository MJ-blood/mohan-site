import { animate, canAnimate } from './motion';

// Content is visible by default; animation is only an enhancement.
const reveals = document.querySelectorAll<HTMLElement>('[data-reveal]');
if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const element = entry.target as HTMLElement;
      if (!element.contains(document.activeElement)) {
        animate(element, [
          { opacity: 0, transform: 'translateY(18px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 620, delay: Number(element.dataset.revealDelay ?? 0), fill: 'backwards' });
      }
      reveal.unobserve(element);
    }
  }, { threshold: .08 });
  reveals.forEach(element => reveal.observe(element));

  const ambient = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('is-in-view', entry.isIntersecting));
  });
  document.querySelectorAll('[data-ambient]').forEach(element => ambient.observe(element));
}

// Pointer movement belongs to the illustration, keeping the text and page stable.
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
document.querySelectorAll<HTMLElement>('[data-tilt]').forEach(element => {
  let frame = 0;
  const reset = () => {
    cancelAnimationFrame(frame);
    element.style.removeProperty('--tilt-x');
    element.style.removeProperty('--tilt-y');
  };
  element.addEventListener('pointermove', event => {
    if (!finePointer.matches || !canAnimate()) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const bounds = element.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      element.style.setProperty('--tilt-x', `${-y * 3}deg`);
      element.style.setProperty('--tilt-y', `${x * 3}deg`);
    });
  });
  element.addEventListener('pointerleave', reset);
  element.addEventListener('focusin', reset);
  finePointer.addEventListener('change', reset);
});