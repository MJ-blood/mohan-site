import { globSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { isInside, readPosts, postRoute } from '../src/lib/post-source';

type Node = DefaultTreeAdapterMap['node'];
export function inspectHtml(html: string) {
  const ids = new Set<string>();
  const references: string[] = [];
  const errors: string[] = [];
  let h1 = 0, main = 0, title = false, description = false, lang = false;
  function walk(node: Node) {
    if ('tagName' in node) {
      const attributes = Object.fromEntries(node.attrs.map(attribute => [attribute.name, attribute.value]));
      if (attributes.id) {
        if (ids.has(attributes.id)) errors.push(`duplicate id: ${attributes.id}`);
        ids.add(attributes.id);
      }
      if (node.tagName === 'h1') h1++;
      if (node.tagName === 'main') main++;
      if (node.tagName === 'title') title = true;
      if (node.tagName === 'html' && attributes.lang === 'zh-CN') lang = true;
      if (node.tagName === 'meta' && attributes.name === 'description' && attributes.content) description = true;
      if (node.tagName === 'img' && !('alt' in attributes)) errors.push('image without alt');
      for (const attribute of ['href', 'src']) if (attributes[attribute]) references.push(attributes[attribute]);
    }
    if ('childNodes' in node) node.childNodes.forEach(walk);
  }
  walk(parse(html));
  if (h1 !== 1 || main !== 1 || !title || !description || !lang) errors.push('invalid document structure or metadata');
  return { ids, references, errors };
}

export function checkSite(root = process.cwd()) {
  const dist = path.join(root, 'dist');
  const posts = readPosts(root).filter(post => !post.metadata.draft);
  const expected = new Set([...globSync('**/*.astro', { cwd: path.join(root, 'src/pages') })]
    .filter(file => !file.includes('['))
    .map(file => file.split(path.sep).join('/').replace(/\.astro$/, '').replace(/(?:^|\/)index$/, '') )
    .map(route => route === '404' ? '404.html' : route ? `${route}/index.html` : 'index.html'));
  for (const post of posts) expected.add(`writing/${post.slug}/index.html`);
  const files = [...globSync('**/*', { cwd: dist })].filter(file => statSync(path.join(dist, file)).isFile());
  const pages = new Map(files.filter(file => file.endsWith('.html')).map(file => [path.resolve(dist, file), inspectHtml(readFileSync(path.join(dist, file), 'utf8'))]));
  const errors: string[] = [];
  if (pages.size !== expected.size || [...expected].some(file => !pages.has(path.resolve(dist, file)))) errors.push('Missing or unexpected page routes');
  let references = 0;
  const referencedAssets = new Set<string>();
  for (const [file, page] of pages) {
    errors.push(...page.errors.map(error => `${path.relative(dist, file)}: ${error}`));
    for (const reference of page.references) {
      references++;
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) continue;
      const url = new URL(reference, `https://local.test/${path.relative(dist, file).split(path.sep).join('/')}`);
      let target = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`);
      if (existsSync(target) && statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!isInside(dist, target) || !existsSync(target)) errors.push(`${path.relative(dist, file)}: missing target ${reference}`);
      else if (url.hash && pages.has(target) && !pages.get(target)!.ids.has(decodeURIComponent(url.hash.slice(1)))) errors.push(`${path.relative(dist, file)}: missing fragment ${reference}`);
      referencedAssets.add(target);
    }
  }
  const archive = pages.get(path.join(dist, 'writing/index.html'));
  for (const post of posts) {
    if (archive?.references.filter(link => link === postRoute(post.slug)).length !== 1) errors.push(`Expected one archive entry: ${post.slug}`);
  }
  for (const file of files) {
    const normalized = file.split(path.sep).join('/');
    if (normalized.startsWith('media/') && !referencedAssets.has(path.resolve(dist, file))) errors.push(`Unreferenced public attachment: ${file}`);
    if (/\.(?:md|py|ts|json|ya?ml)$/.test(normalized) || /^(?:docs|content|scripts|tests)\//.test(normalized)) errors.push(`Private/source file in build: ${file}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`PASS: ${pages.size} pages, ${posts.length} Markdown posts, ${references} references; routes, metadata, assets and anchors.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkSite();
