"""Build static pages and public Markdown articles into a deployable dist/."""
from html import escape
import json
from pathlib import Path
from string import Template
from urllib.parse import unquote

from articles import ContentError, article_page, archive_content, home_content, load_articles

ROOT = Path(__file__).resolve().parents[1]


def output_path(output, route):
    return output / (unquote(route).lstrip('/') + ('index.html' if route.endswith('/') else ''))


def render_site(root=ROOT):
    articles, assets = load_articles(root)
    source = root / 'src'
    pages = json.loads((source / 'pages.json').read_text(encoding='utf-8'))
    layout = Template((source / 'layout.html').read_text(encoding='utf-8'))
    pages += [{'route': a.route, 'section': 'writing', 'class': 'article-page', 'title': a.title + ' · mohan', 'description': a.summary, 'content': article_page(a)} for a in articles]
    rendered = {}
    for page in pages:
        route = page['route']
        if route in rendered or not route.startswith('/') or '..' in unquote(route) or '?' in route or '#' in route:
            raise ContentError(f'Invalid or duplicate route: {route}')
        navigation = ''.join(
            f'<a href="{href}"' + (
                (' aria-current="page"' if route == href else ' aria-current="location"')
                if page['section'] == section else ''
            ) + f'>{label}</a>'
            for section, href, label in [('home', '/', '首页'), ('writing', '/writing/', '文章'), ('work', '/work/', '实践'), ('about', '/about/', '关于')]
        )
        content = page.get('content')
        if content is None:
            content = (source / 'pages' / page['source']).read_text(encoding='utf-8')
            if route == '/':
                content = Template(content).substitute(home_content(articles))
            elif route == '/writing/':
                content = Template(content).substitute(archive_content(articles))
        rendered[route] = layout.substitute(
            title=escape(page['title']), description=escape(page['description'], quote=True),
            body_class=escape(page.get('class', ''), quote=True), navigation=navigation,
            content=content, og_type='article' if page.get('class') == 'article-page' else 'website',
        )
    for path in (source / 'assets').rglob('*'):
        if path.is_file():
            assets['/assets/' + path.relative_to(source / 'assets').as_posix()] = path.read_bytes()
    return rendered, assets, articles


def build(root=ROOT, output=None):
    root = Path(root).resolve()
    output = Path(output) if output is not None else root / 'dist'
    rendered, assets, articles = render_site(root)
    expected = {output_path(output, route) for route in (*rendered, *assets)}
    stale = {path for path in output.rglob('*') if path.is_file()} - expected
    if stale:
        raise ContentError('Stale generated files remain in dist; review removed/renamed articles or attachments and use a fresh output directory: ' + ', '.join(str(p.relative_to(output)) for p in sorted(stale)))
    # Validate all inputs and render all pages before touching the previous build.
    for route, html in rendered.items():
        target = output_path(output, route)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding='utf-8')
    for route, data in assets.items():
        target = output_path(output, route)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    print(f'Built {len(rendered)} pages ({len(articles)} Markdown articles) → {output}', flush=True)
    return rendered


if __name__ == '__main__':
    try:
        build()
    except (ContentError, OSError) as error:
        raise SystemExit(str(error)) from error
