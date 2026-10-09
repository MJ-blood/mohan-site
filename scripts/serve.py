"""Local static preview; changed Markdown/templates rebuild on the next request."""
import argparse
from functools import partial
from html import escape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import RLock

from build import build

ROOT = Path(__file__).resolve().parents[1]


class Preview:
    def __init__(self, root=ROOT):
        self.root = Path(root)
        self.output = self.root / 'dist'
        self.lock = RLock()
        self.previous = None

    def snapshot(self):
        files = []
        for folder in ('src', 'content'):
            for path in sorted((self.root / folder).rglob('*')):
                if path.is_file():
                    stat = path.stat()
                    files.append((str(path.relative_to(self.root)), stat.st_mtime_ns, stat.st_size))
        return tuple(files)

    def refresh(self):
        current = self.snapshot()
        if current != self.previous:
            build(self.root)
            self.previous = current


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, preview, **kwargs):
        self.preview = preview
        super().__init__(*args, directory=str(preview.output), **kwargs)

    def serve_request(self, head=False):
        # A rebuild and a response share the lock, avoiding partial files under concurrent requests.
        with self.preview.lock:
            # Last-Modified has one-second precision; rapid edits must never reuse an old page.
            for header in ('If-Modified-Since', 'If-None-Match'):
                if header in self.headers:
                    del self.headers[header]
            try:
                self.preview.refresh()
            except (ValueError, OSError) as error:
                body = ('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>文章构建失败</title><h1>文章暂时无法生成</h1><p>修正文件后刷新此页即可重试。</p><pre>' + escape(str(error)) + '</pre></html>').encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                if not head:
                    self.wfile.write(body)
                return
            if head:
                super().do_HEAD()
            else:
                super().do_GET()

    def do_GET(self):
        self.serve_request()

    def do_HEAD(self):
        self.serve_request(head=True)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        error_page = self.preview.output / '404.html'
        if code == 404 and error_page.is_file():
            body = error_page.read_bytes()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(body)
            return
        super().send_error(code, message, explain)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4321)
    args = parser.parse_args()
    preview = Preview()
    try:
        preview.refresh()
    except (ValueError, OSError) as error:
        parser.error(str(error))
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, preview=preview))
    print(f'Local preview (save Markdown, then refresh): http://localhost:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
