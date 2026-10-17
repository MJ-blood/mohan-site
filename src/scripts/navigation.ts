import { required } from './dom';
const mobile = window.matchMedia('(max-width: 700px)');
const menuButton = required<HTMLButtonElement>('.menu-button');
const navigation = required('.primary-nav');
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
navigation.addEventListener('click', event => { if (event.target instanceof Element && event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') closeMenu(true);
});
document.addEventListener('click', event => { if (event.target instanceof Element && !event.target.closest('.site-header')) closeMenu(); });
mobile.addEventListener('change', () => closeMenu());
window.addEventListener('pageshow', () => closeMenu());
closeMenu();

