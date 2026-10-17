import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { checkSite } from '../scripts/check';

const run = promisify(execFile);
const project = process.cwd();
const cli = path.join(project, 'node_modules/astro/bin/astro.mjs');
const env = { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', FORCE_COLOR: '0' };

test('真实 Astro 构建和开发预览：发布、更新、附件、草稿、改名及错误恢复', { timeout: 180_000 }, async t => {
  const base = path.join(project, '.tmp/tests');
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(path.join(base, 'publication-'));
  let preview: ChildProcess | undefined;
  t.after(async () => {
    if (preview && preview.exitCode === null) {
      preview.kill();
      await new Promise<void>(resolve => preview!.once('exit', () => resolve()));
    }
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });
  for (const file of ['src', 'public', 'content', 'astro.config.ts', 'tsconfig.json', 'package.json']) {
    cpSync(path.join(project, file), path.join(root, file), { recursive: true, filter: source => !source.endsWith('.html') && !source.endsWith('pages.json') && !source.includes(`${path.sep}src${path.sep}assets`) });
  }
  const posts = path.join(root, 'content/posts');
  const note = path.join(posts, '新文章.md');
  const text = (title: string) => `---\ntitle: ${title}\nupdated: 2026-10-17\n---\n\n首段摘要。\n\n## 章节 {#stable}\n\n独有正文标记。\n\n![图片](sample.svg)\n\n[阅读](knowledge-to-output.md#judgment)`;
  writeFileSync(path.join(posts, 'sample.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  writeFileSync(path.join(posts, 'unused.pdf'), 'PRIVATE-UNREFERENCED-ATTACHMENT');
  writeFileSync(note, text('新增文章'));
  writeFileSync(path.join(posts, 'draft.md'), '---\ndraft: true\n---\n\nPRIVATE-DRAFT-MARKER');
  const build = () => run(process.execPath, [cli, 'build'], { cwd: root, env, timeout: 60_000, maxBuffer: 2_000_000 });
  await build();
  checkSite(root);
  const articlePath = path.join(root, 'dist/writing/新文章/index.html');
  assert.match(readFileSync(articlePath, 'utf8'), /独有正文标记/);
  for (const file of ['index.html', 'writing/index.html']) assert.match(readFileSync(path.join(root, 'dist', file), 'utf8'), /新增文章/);
  assert.equal(existsSync(path.join(root, 'dist/media/posts/sample.svg')), true);
  assert.equal(existsSync(path.join(root, 'dist/media/posts/unused.pdf')), false);
  assert.equal(existsSync(path.join(root, 'dist/writing/draft/index.html')), false);
  assert.doesNotMatch(readFileSync(path.join(root, 'dist/writing/index.html'), 'utf8'), /PRIVATE-DRAFT/);

  writeFileSync(note, '---\ntitle: 错误\ntitle: 重复\n---\n\n正文');
  await assert.rejects(build());
  assert.match(readFileSync(articlePath, 'utf8'), /独有正文标记/);
  writeFileSync(note, '# 更新后\n\n新的摘要与正文。');
  renameSync(note, path.join(posts, 'renamed.md'));
  await build();
  checkSite(root);
  assert.equal(existsSync(articlePath), false);
  assert.equal(existsSync(path.join(root, 'dist/media/posts/sample.svg')), false);
  assert.match(readFileSync(path.join(root, 'dist/writing/renamed/index.html'), 'utf8'), /更新后/);

  const child = spawn(process.execPath, [cli, 'dev', '--host', '127.0.0.1', '--port', '0'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  preview = child;
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const until = async <T>(operation: () => Promise<T>, accept: (value: T) => boolean): Promise<T> => {
    const deadline = Date.now() + 20_000;
    do {
      const value = await operation();
      if (accept(value)) return value;
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    throw new Error(`Preview did not update. ${output.slice(-4000)}`);
  };
  const url = await until(async () => output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0] ?? '', value => Boolean(value));
  const fetchPage = async (route: string) => { const response = await fetch(url + route); return { status: response.status, html: await response.text() }; };
  const live = path.join(posts, 'live.md');
  writeFileSync(live, '# 实时新增\n\n预览正文。');
  await until(() => fetchPage('/writing/live/'), value => value.status === 200 && value.html.includes('实时新增'));
  writeFileSync(live, '# 实时更新\n\n修改正文。');
  await until(() => fetchPage('/writing/live/'), value => value.status === 200 && value.html.includes('实时更新'));
  writeFileSync(live, '---\ntitle: [bad]\n---\n\n正文');
  await until(() => fetchPage('/writing/'), value => value.status === 500);
  writeFileSync(live, '# 恢复正常\n\n修正正文。');
  await until(() => fetchPage('/writing/live/'), value => value.status === 200 && value.html.includes('恢复正常'));
  const responses = await Promise.all(Array.from({ length: 6 }, () => fetchPage('/writing/live/')));
  assert.ok(responses.every(response => response.status === 200 && response.html.includes('恢复正常')));
  renameSync(live, path.join(posts, 'live-renamed.md'));
  await until(() => fetchPage('/writing/live-renamed/'), value => value.status === 200);
  await until(() => fetchPage('/writing/live/'), value => value.status === 404);
});
