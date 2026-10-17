import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { postMarkdown } from '../src/lib/markdown';
import { metadataSchema, readPost, readPosts } from '../src/lib/post-source';

function fixture(t: { after(fn: () => void): void }) {
  const base = path.resolve('.tmp/tests');
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(path.join(base, 'content-'));
  mkdirSync(path.join(root, 'content/posts'), { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (name: string, content: string) => {
    const file = path.join(root, 'content/posts', name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
    return file;
  };
  const options = postMarkdown(root);
  const renderer = options.processor.createRenderer({ syntaxHighlight: options.syntaxHighlight });
  const render = async (file: string) => (await renderer).render(readPost(file).body, { fileURL: pathToFileURL(file) });
  return { root, write, render };
}

test('普通中文 Markdown 自动派生标题、摘要、目录和正文搜索', async t => {
  const f = fixture(t);
  const result = await f.render(f.write('中文文章.md', '# 标题\n\n第一段摘要。\n\n## 章节 {#stable}\n\n自动**构建**，使用 `code` 工具。\n\n## 重复\n\n一\n\n## 重复\n\n二'));
  assert.equal(result.metadata.frontmatter.title, '标题');
  assert.equal(result.metadata.frontmatter.summary, '第一段摘要。');
  assert.equal(result.metadata.frontmatter.slug, '中文文章');
  assert.match(result.code, /id="stable"/);
  assert.match(result.code, /id="重复-2"/);
  assert.doesNotMatch(result.code, /<h1/);
  assert.match(result.metadata.frontmatter.search, /自动构建/);
});

test('支持表格、嵌套列表、代码、删除线和模板字符', async t => {
  const f = fixture(t);
  const result = await f.render(f.write('format.md', '# 格式\n\n- A\n  - B\n\n> 引用\n\n~~删除~~\n\n```ts\nconst value = "$title / $content";\n```\n\n| 左 | 右 |\n| --- | --- |\n| A | B |'));
  for (const fragment of ['<ul>', '<blockquote>', '<del>', 'language-ts', '$title / $content', 'table-scroll', '<table>']) assert.ok(result.code.includes(fragment), fragment);
});

test('正文 HTML 和脚本地址不执行，摘要保持文字', async t => {
  const f = fixture(t);
  const result = await f.render(f.write('safe.md', '# 安全\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n<img src=x onerror=alert(1)>'));
  assert.doesNotMatch(result.code, /<script|<img|href="javascript:/);
  assert.match(result.code, /(?:&lt;|&#x3C;)script/);
});

test('元数据严格校验日期、布尔值、未知字段与重复键', t => {
  const f = fixture(t);
  for (const metadata of ['title: a\ntitle: b', 'tags: nope', 'date: 2026-02-31', 'date: 2026-01-01\nupdated: 2025-01-01', 'draft: "false"', 'unknown: true', 'slug: ../escape', 'title: [bad]']) {
    assert.throws(() => readPost(f.write('bad.md', `---\n${metadata}\n---\n\n正文`)), /bad.md/);
  }
  assert.throws(() => readPost(f.write('bad.md', '---\ntitle: 缺少结束')));
  assert.equal(metadataSchema.parse({ date: '2024-02-29' }).date, '2024-02-29');
});

test('重复地址、正文一级标题和重复锚点报错', async t => {
  const f = fixture(t);
  f.write('one.md', '---\nslug: same\n---\n\n正文');
  f.write('two.md', '---\nslug: same\n---\n\n正文');
  assert.throws(() => readPosts(f.root), /地址重复/);
  await assert.rejects(f.render(f.write('heading.md', '正文\n\n# 二次标题\n\n正文')), /##/);
  await assert.rejects(f.render(f.write('anchor.md', '## 一 {#same}\n\n正文\n\n## 二 {#same}')), /锚点重复/);
});

test('只收集被引用附件，相对文章链接使用目标 slug', async t => {
  const f = fixture(t);
  f.write('target.md', '---\nslug: 固定地址\n---\n\n正文\n\n## 章节 {#section}');
  f.write('images/example.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
  f.write('unused.pdf', 'not public');
  const result = await f.render(f.write('source.md', '# 来源\n\n![图][image]\n\n[阅读](target.md#section)\n\n[image]: images/example.svg\n\n[unused]: unused.pdf'));
  assert.match(result.code, /\/media\/posts\/images\/example.svg/);
  assert.ok(result.code.includes('/writing/%E5%9B%BA%E5%AE%9A%E5%9C%B0%E5%9D%80/#section'));
  assert.equal(result.metadata.frontmatter.attachments.length, 1);
  const target = await f.render(path.join(f.root, 'content/posts/target.md'));
  assert.equal(target.metadata.frontmatter.title, 'target');
});

test('缺失附件、越界引用和指向草稿的链接失败', async t => {
  const f = fixture(t);
  f.write('draft.md', '---\ndraft: true\n---\n\n不公开');
  writeFileSync(path.join(f.root, 'private.md'), 'private');
  for (const destination of ['missing.png', '../../private.md', 'draft.md']) {
    await assert.rejects(f.render(f.write('source.md', `正文\n\n[链接](${destination})`)));
  }
});

test('改名与草稿状态由当前文件决定，不缓存旧文章', t => {
  const f = fixture(t);
  const file = f.write('old.md', '正文');
  renameSync(file, path.join(f.root, 'content/posts/new.md'));
  assert.deepEqual(readPosts(f.root).map(post => post.slug), ['new']);
  f.write('new.md', '---\ndraft: true\n---\n\n草稿');
  assert.equal(readPosts(f.root).filter(post => !post.metadata.draft).length, 0);
});
