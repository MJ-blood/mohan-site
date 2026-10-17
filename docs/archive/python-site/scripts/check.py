"""Check the generated site's routes, metadata, assets and local anchors."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from build import output_path, render_site

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.ids = set()
        self.references = []
        self.h1 = 0
        self.main = 0
        self.description = False
        self.title = False
        self.lang = False
        self.errors = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        identifier = attrs.get('id')
        if identifier:
            if identifier in self.ids:
                self.errors.append(f'duplicate id: {identifier}')
            self.ids.add(identifier)
        self.h1 += tag == 'h1'
        self.main += tag == 'main'
        self.title |= tag == 'title'
        self.lang |= tag == 'html' and attrs.get('lang') == 'zh-CN'
        self.description |= tag == 'meta' and attrs.get('name') == 'description' and bool(attrs.get('content'))
        if tag == 'img' and 'alt' not in attrs:
            self.errors.append('image without alt')
        for attribute in ('href', 'src'):
            if attribute in attrs:
                self.references.append(attrs[attribute])


def check(root=ROOT, dist=None):
    root = Path(root).resolve()
    dist = Path(dist) if dist is not None else root / 'dist'
    pages = {path: Page(path.read_text(encoding='utf-8')) for path in dist.rglob('*.html')}
    if not pages:
        raise SystemExit('No build found. Run python3 scripts/build.py first.')
    errors = []
    links = 0
    rendered, assets, articles = render_site(root)
    expected_paths = {output_path(dist, route) for route in rendered}
    if set(pages) != expected_paths:
        errors.append('Built routes differ from static pages + Markdown articles (missing or stale output).')
    expected_files = expected_paths | {output_path(dist, route) for route in assets}
    if {path for path in dist.rglob('*') if path.is_file()} != expected_files:
        errors.append('Missing or unexpected generated files (including stale attachments).')
    for route, expected in rendered.items():
        target = output_path(dist, route)
        if target.is_file() and target.read_text(encoding='utf-8') != expected:
            errors.append(f'{route}: build is stale; rebuild after editing content')
    archive = pages.get(output_path(dist, '/writing/'))
    for article in articles:
        if not archive or archive.references.count(article.route) != 1:
            errors.append(f'{article.source.name}: expected exactly one archive entry')
    for route, expected in assets.items():
        target = output_path(dist, route)
        if not target.is_file() or target.read_bytes() != expected:
            errors.append(f'{route}: missing or stale asset')
    for path, page in pages.items():
        prefix = str(path.relative_to(dist))
        errors.extend(f'{prefix}: {error}' for error in page.errors)
        if page.h1 != 1 or page.main != 1 or not all((page.title, page.description, page.lang)):
            errors.append(f'{prefix}: missing/duplicate document structure or metadata')
        for reference in page.references:
            links += 1
            url = urlsplit(reference)
            if url.scheme or url.netloc:
                continue
            target = (dist / unquote(url.path).lstrip('/')) if url.path.startswith('/') else (path.parent / unquote(url.path))
            if not url.path:
                target = path
            elif target.is_dir():
                target /= 'index.html'
            target = target.resolve()
            if not target.is_relative_to(dist.resolve()):
                errors.append(f'{prefix}: reference leaves public build {reference}')
            elif not target.is_file():
                errors.append(f'{prefix}: missing target {reference}')
            elif url.fragment and target.suffix == '.html' and (target not in pages or unquote(url.fragment) not in pages[target].ids):
                errors.append(f'{prefix}: missing fragment {reference}')
    if errors:
        raise SystemExit('\n'.join(errors))
    print(f'PASS: {len(pages)} pages, {len(articles)} Markdown articles, {links} references, current content, metadata, assets and local anchors.')


if __name__ == '__main__':
    check()
