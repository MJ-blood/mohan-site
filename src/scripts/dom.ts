export function required<T extends HTMLElement = HTMLElement>(selector: string, parent: ParentNode = document): T {
  const element = parent.querySelector<T>(selector);
  if (!element) throw new Error('Missing page element: ' + selector);
  return element;
}
