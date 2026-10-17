"""Behavioral tests for file publication; fixtures never enter the real site."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import redirect_stdout
from functools import partial
from http.server import ThreadingHTTPServer
import io
from pathlib import Path
import shutil
import sys
import tempfile
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from articles import ContentError, load_articles
from build import build, output_path
from check import check
from serve import Handler, Preview

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(Handler):
    def log_message(self, *args):
        pass


class MarkdownPublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='mohan-site-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ('src', 'content'):
            shutil.copytree(ROOT / name, self.root / name)
        self.posts = self.root / 'content/posts'
        self.output = self.root / 'dist'

    def write(self, name='new-note', text='# 新文章\n\n新正文内容。\n\n## 第一个标题\n\n这一段只写在正文里。'):
        path = self.posts / (name + '.md')
        path.write_text(text, encoding='utf-8')
        return path

    def build(self):
        with redirect_stdout(io.StringIO()):
            return build(self.root)

    def test_add_plain_markdown_without_registration(self):
        self.write()
        result = self.build()
        self.assertEqual(len(result), 11)
        self.assertIn('新正文内容。', result['/writing/new-note/'])
        self.assertIn('href="/writing/new-note/"', result['/writing/'])
        self.assertIn('这一段只写在正文里。', result['/writing/'])
        self.assertEqual(result['/writing/new-note/'].count('<h1>'), 1)
        with redirect_stdout(io.StringIO()):
            check(self.root)

    def test_updated_metadata_reaches_every_entry(self):
        path = self.write(text='---\ntitle: 新标题\nupdated: 2026-10-04\nsummary: 一份新的摘要\ntags: [知识管理]\n---\n\n正文。')
        result = self.build()
        for route in ('/', '/writing/', '/writing/new-note/'):
            self.assertIn('新标题', result[route])
            self.assertIn('一份新的摘要', result[route])
        path.write_text(path.read_text().replace('新标题', '修订标题').replace('正文。', '修改后的正文。'))
        with self.assertRaises(SystemExit):
            check(self.root)
        result = self.build()
        self.assertIn('修订标题', result['/'])
        self.assertIn('修改后的正文。', result['/writing/new-note/'])

    def test_draft_excluded_from_pages_lists_and_search(self):
        self.write(text='---\ntitle: 不公开的草稿\ndraft: true\n---\n\nPRIVATE-DRAFT-MARKER')
        result = self.build()
        self.assertNotIn('/writing/new-note/', result)
        self.assertNotIn('PRIVATE-DRAFT-MARKER', ''.join(result.values()))

    def test_chinese_filename_and_missing_frontmatter(self):
        self.write('中文文章', '第一段作为摘要。\n\n## 章节\n\n正文。')
        result = self.build()
        route = '/writing/%E4%B8%AD%E6%96%87%E6%96%87%E7%AB%A0/'
        self.assertIn(route, result)
        self.assertTrue(output_path(self.output, route).is_file())
        with redirect_stdout(io.StringIO()):
            check(self.root)

    def test_common_markdown_and_heading_ids(self):
        self.write(text='# 格式样例\n\n## 标题 {#stable}\n\n**粗体** 和 *斜体*，`code`。\n\n> 引用\n\n- 第一项\n  - 嵌套项\n\n1. 有序项\n\n```python\nprint("hello")\n```\n\n| 左 | 右 |\n| --- | --- |\n| A | B |\n\n## 重复\n\n第二段\n\n## 重复\n\n第三段。')
        page = self.build()['/writing/new-note/']
        for fragment in ('id="stable"', 'id="重复-2"', '<strong>粗体</strong>', '<blockquote>', '<ul>', '<ol>', 'language-python', '<table>', 'table-scroll'):
            self.assertIn(fragment, page)

    def test_template_examples_in_markdown_are_literal(self):
        self.write(text='# 模板示例\n\n```python\nvalue = "$title / $content"\n```')
        result = self.build()
        self.assertIn('$title / $content', result['/writing/new-note/'])
        with redirect_stdout(io.StringIO()):
            check(self.root)

    def test_raw_html_and_script_urls_do_not_execute(self):
        self.write(text='# 安全渲染\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n正常正文。')
        result = self.build()
        self.assertNotIn('<script>alert(1)</script>', result['/writing/new-note/'])
        self.assertNotIn('href="javascript:', result['/writing/new-note/'])
        self.assertNotIn('<script>alert(1)</script>', result['/writing/'])

    def test_search_preserves_phrases_across_inline_formatting(self):
        self.write(text='# 搜索样例\n\n一段摘要。\n\n自动**构建**，阅读[这一篇](/writing/knowledge-to-output/)，使用 `code` 工具。')
        articles, _ = load_articles(self.root)
        article = next(a for a in articles if a.slug == 'new-note')
        self.assertIn('自动构建', article.search)
        self.assertIn('阅读这一篇', article.search)
        self.assertIn('使用 code 工具', article.search)
        self.assertIn('自动构建', self.build()['/writing/'])

    def test_removed_attachment_cannot_remain_in_public_output(self):
        (self.posts/'sample.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
        self.write(text='# 图片文章\n\n一个例子。\n\n![图片](sample.svg)')
        self.build()
        self.write(text='# 图片文章\n\n移除了图片引用。')
        with self.assertRaisesRegex(ContentError, 'Stale generated files'):
            self.build()
        with self.assertRaisesRegex(SystemExit, 'unexpected generated files'):
            check(self.root)

    def test_attachments_and_relative_markdown_links(self):
        (self.posts/'images').mkdir()
        (self.posts/'images/example.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
        self.write(text='# 图片与链接\n\n![示意图](images/example.svg)\n\n[延伸阅读](knowledge-to-output.md#judgment)')
        page = self.build()['/writing/new-note/']
        self.assertIn('/media/posts/images/example.svg', page)
        self.assertIn('/writing/knowledge-to-output/#judgment', page)
        self.assertTrue((self.output/'media/posts/images/example.svg').is_file())
        with redirect_stdout(io.StringIO()):
            check(self.root)

    def test_bad_metadata_fails_with_filename(self):
        cases = ['title: a\ntitle: b', 'tags: not-a-list', 'date: 2026-02-31', 'updated: 2025-01-01\ndate: 2026-01-01', 'draft: "false"', 'unknown: true', 'slug: ../escape']
        for metadata in cases:
            with self.subTest(metadata=metadata):
                self.write(text='---\n'+metadata+'\n---\n\n内容。')
                with self.assertRaisesRegex(ContentError, 'content/posts/new-note.md'):
                    self.build()

    def test_invalid_content_cannot_overwrite_previous_build(self):
        self.build()
        before=(self.output/'index.html').read_bytes()
        self.write(text='---\ntitle: missing closing separator')
        with self.assertRaises(ContentError):
            self.build()
        self.assertEqual(before, (self.output/'index.html').read_bytes())

    def test_duplicate_routes_and_ids_rejected(self):
        self.write(text='---\nslug: knowledge-to-output\n---\n\n正文。')
        with self.assertRaisesRegex(ContentError, 'duplicate article'):
            self.build()
        self.write(text='正文。\n\n## A {#same}\n\n一\n\n## B {#same}\n\n二')
        with self.assertRaisesRegex(ContentError, 'duplicate heading id'):
            self.build()

    def test_private_and_missing_relative_links_rejected(self):
        for destination in ('../../../README.md', 'missing.png'):
            self.write(text='# 链接\n\n[目标]('+destination+')')
            with self.assertRaises(ContentError):
                self.build()

    def test_broken_local_fragment_is_reported(self):
        self.write(text='# 链接\n\n[错误锚点](/writing/knowledge-to-output/#missing)')
        self.build()
        with self.assertRaisesRegex(SystemExit, 'missing fragment'):
            check(self.root)

    def test_existing_inbound_anchors_are_preserved(self):
        result=self.build()
        for slug, anchors in {'knowledge-to-output':['judgment','connections','output'], 'agent-handoff':['version','ownership','permission'], 'docs-with-code':['ownership','entry','status']}.items():
            for anchor in anchors:
                self.assertIn(f'id="{anchor}"', result[f'/writing/{slug}/'])

    def test_rename_does_not_silently_serve_stale_page(self):
        self.write()
        self.build()
        (self.posts/'new-note.md').rename(self.posts/'renamed.md')
        with self.assertRaisesRegex(ContentError, 'Stale generated files'):
            self.build()

    def test_preview_add_update_error_recovery_and_concurrency(self):
        preview=Preview(self.root)
        with redirect_stdout(io.StringIO()):
            preview.refresh()
        server=ThreadingHTTPServer(('127.0.0.1',0), partial(QuietHandler, preview=preview))
        thread=Thread(target=server.serve_forever, daemon=True)
        thread.start()
        def stop():
            server.shutdown(); server.server_close(); thread.join(timeout=3)
        self.addCleanup(stop)
        base=f'http://127.0.0.1:{server.server_port}'
        def read(route):
            with urlopen(base+route, timeout=10) as response:
                return response.read().decode('utf-8')
        self.write()
        with redirect_stdout(io.StringIO()):
            self.assertIn('/writing/new-note/', read('/writing/'))
            self.assertIn('新正文内容。', read('/writing/new-note/'))
            self.write(text='# 修改后\n\n刷新就能读取这一段。')
            with ThreadPoolExecutor(max_workers=6) as pool:
                pages=list(pool.map(read, ['/writing/new-note/']*6))
            self.assertTrue(all('刷新就能读取这一段。' in page for page in pages))
            self.write(text='---\ntitle: [bad]\n---\n\n正文')
            with self.assertRaises(HTTPError) as failure:
                read('/writing/')
            self.assertEqual(failure.exception.code,500)
            self.write(text='# 恢复正常\n\n修正了文件。')
            self.assertIn('恢复正常',read('/writing/new-note/'))
            request = Request(base+'/writing/new-note/', headers={'If-Modified-Since': 'Thu, 01 Jan 2099 00:00:00 GMT'})
            with urlopen(request, timeout=10) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
                self.assertIn('恢复正常', response.read().decode('utf-8'))


if __name__ == '__main__':
    unittest.main()
