"""Read public Markdown posts once; derive pages, lists, TOC and search data."""
from dataclasses import dataclass
from datetime import date
from html import escape
import json
import math
from pathlib import Path
import re
from urllib.parse import quote, unquote, urlsplit

try:
    from markdown_it import MarkdownIt
    import yaml
except ImportError as error:
    raise SystemExit('Install project dependencies, then use .venv/bin/python (see README.md).') from error


class ContentError(ValueError):
    pass


class MetadataLoader(yaml.SafeLoader):
    """Reject duplicate fields instead of silently replacing an author's value."""
    def construct_mapping(self, node, deep=False):
        result = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if not isinstance(key, str) or key in result:
                raise ContentError('metadata keys must be unique strings')
            result[key] = self.construct_object(value_node, deep=deep)
        return result


def slugify(text):
    return re.sub(r'[^\w-]+', '-', text.lower(), flags=re.UNICODE).strip('-') or 'section'


def plain(tokens):
    return ''.join(
        token.content if token.type in ('text', 'code_inline', 'code_block', 'fence')
        else ' ' if token.type in ('softbreak', 'hardbreak')
        else plain(token.children or []) if token.type == 'image'
        else '' for token in tokens
    )


def text_field(meta, name, fallback=''):
    value = meta.get(name, fallback)
    if not isinstance(value, str) or not value.strip():
        raise ContentError(f'{name} must be nonempty text')
    return value.strip()


def date_field(meta, name):
    value = meta.get(name)
    if value is None:
        return ''
    if type(value) is date:
        return value.isoformat()
    if isinstance(value, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        return date.fromisoformat(value).isoformat()
    raise ContentError(f'{name} must be YYYY-MM-DD')


@dataclass
class Article:
    source: Path
    slug: str
    title: str
    summary: str
    tags: list
    published: str
    updated: str
    draft: bool
    tokens: list
    parser: MarkdownIt
    body: str = ''
    search: str = ''
    minutes: int = 1
    toc: str = ''

    @property
    def route(self):
        return f'/writing/{quote(self.slug)}/'

    @property
    def sort_date(self):
        return self.updated or self.published

    @property
    def date_html(self):
        if not self.sort_date:
            return ''
        label = '更新于' if self.updated else '发表于'
        return f'<span>{label} <time datetime="{self.sort_date}">{self.sort_date.replace("-", ".")}</time></span>'


def read_article(path):
    source = path.read_text(encoding='utf-8-sig').replace('\r\n', '\n')
    meta = {}
    if source.startswith('---\n'):
        parts = source.split('\n---', 1)
        if len(parts) != 2 or (parts[1] and not parts[1].startswith('\n')):
            raise ContentError('frontmatter must end with a line containing ---')
        meta = yaml.load(parts[0][4:], Loader=MetadataLoader) or {}
        source = parts[1].lstrip('\n')
        if not isinstance(meta, dict):
            raise ContentError('frontmatter must be a mapping')
    unknown = set(meta) - {'title', 'summary', 'tags', 'date', 'updated', 'draft', 'slug'}
    if unknown:
        raise ContentError('unknown fields: ' + ', '.join(sorted(unknown)))
    parser = MarkdownIt('commonmark', {'html': False}).enable(['table', 'strikethrough'])
    tokens = parser.parse(source)
    heading = ''
    if tokens and tokens[0].type == 'heading_open' and tokens[0].tag == 'h1':
        heading = plain(tokens[1].children or [])
        tokens = tokens[3:]
    if any(t.type == 'heading_open' and t.tag == 'h1' for t in tokens):
        raise ContentError('use ## for body sections; only the first # heading can be the title')
    if not tokens:
        raise ContentError('article body is empty')
    title = text_field(meta, 'title', heading or path.stem)
    slug = text_field(meta, 'slug', path.stem)
    if not re.fullmatch(r'[\w-]+', slug, flags=re.UNICODE):
        raise ContentError('filename / slug may contain letters, digits, Chinese, - and _')
    paragraphs = [plain(t.children or []) for i, t in enumerate(tokens) if t.type == 'inline' and i and tokens[i-1].type == 'paragraph_open']
    paragraphs = [p for p in paragraphs if p.strip()]
    summary = text_field(meta, 'summary', (paragraphs[0][:130] if paragraphs else title))
    tags = meta.get('tags', [])
    if not isinstance(tags, list) or any(not isinstance(t, str) or not t.strip() for t in tags):
        raise ContentError('tags must be a list of nonempty text values')
    tags = list(dict.fromkeys(t.strip() for t in tags))
    draft = meta.get('draft', False)
    if not isinstance(draft, bool):
        raise ContentError('draft must be true or false')
    published, updated = date_field(meta, 'date'), date_field(meta, 'updated')
    if published and updated and updated < published:
        raise ContentError('updated cannot be earlier than date')
    return Article(path, slug, title, summary, tags, published, updated, draft, tokens, parser)


def finish_article(article, by_source, content_root, assets):
    used_ids = {'top', 'main', 'primary-navigation', 'article-start', 'article-toc'}
    toc, search = [], []
    for index, token in enumerate(article.tokens):
        if token.type == 'heading_open':
            inline = article.tokens[index + 1]
            match = re.search(r'\s+\{#([\w-]+)\}\s*$', inline.content)
            if match:
                identifier = match[1]
                inline.content = inline.content[:match.start()]
                inline.children = article.parser.parseInline(inline.content)[0].children
                if identifier in used_ids:
                    raise ContentError(f'duplicate heading id: {identifier}')
            else:
                base = slugify(plain(inline.children or []))
                identifier, suffix = base, 2
                while identifier in used_ids:
                    identifier = f'{base}-{suffix}'
                    suffix += 1
            used_ids.add(identifier)
            token.attrSet('id', identifier)
            if token.tag in ('h2', 'h3'):
                toc.append(f'<a class="toc-{token.tag}" href="#{quote(identifier)}">{escape(plain(inline.children or []))}</a>')
        if token.children:
            search.append(plain(token.children))
        for child in token.children or []:
            if child.type not in ('link_open', 'image'):
                continue
            attribute = 'src' if child.type == 'image' else 'href'
            original = child.attrGet(attribute)
            url = urlsplit(original)
            if not url.path or url.scheme or url.netloc or url.path.startswith('/'):
                continue
            target = (article.source.parent / unquote(url.path)).resolve()
            if not target.is_relative_to(content_root.resolve()) or not target.is_file():
                raise ContentError(f'missing or out-of-content relative link: {original}')
            if target.suffix.lower() == '.md':
                linked = by_source.get(target)
                if linked is None or linked.draft:
                    raise ContentError(f'link to an unpublished article: {original}')
                destination = linked.route
            else:
                if target.suffix.lower() not in {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg', '.pdf'}:
                    raise ContentError(f'unsupported public attachment: {original}')
                destination = '/media/' + quote(target.relative_to(content_root.resolve()).as_posix())
                assets[destination] = target.read_bytes()
            child.attrSet(attribute, destination + ('?' + url.query if url.query else '') + ('#' + url.fragment if url.fragment else ''))
            if child.type == 'image':
                child.attrSet('loading', 'lazy')
                child.attrSet('decoding', 'async')
        if token.type in ('fence', 'code_block'):
            search.append(token.content)
    article.body = article.parser.renderer.render(article.tokens, article.parser.options, {})
    # Tables get a keyboard-scrollable container; the document itself never widens.
    article.body = article.body.replace('<table>', '<div class="table-scroll" tabindex="0" role="region" aria-label="表格，可横向滚动"><table>').replace('</table>', '</table></div>')
    article.toc = ''.join(toc)
    article.search = ' '.join([article.title, article.summary, *article.tags, *search])
    units = len(re.findall(r'[\u3400-\u9fff]|[A-Za-z0-9]+', ' '.join(search)))
    article.minutes = max(1, math.ceil(units / 350))


def load_articles(root):
    content_root = root / 'content'
    posts_root = content_root / 'posts'
    articles, assets = [], {}
    for path in sorted(posts_root.rglob('*.md')):
        if not path.resolve().is_relative_to(posts_root.resolve()):
            raise ContentError(f'{path.name}: article symlink leaves posts directory')
        try:
            articles.append(read_article(path.resolve()))
        except (ValueError, yaml.YAMLError) as error:
            raise ContentError(f'{path.relative_to(root)}: {error}') from error
    slugs = [a.slug for a in articles]
    if len(slugs) != len(set(slugs)):
        raise ContentError('duplicate article slug / filename')
    by_source = {a.source: a for a in articles}
    published = [a for a in articles if not a.draft]
    for article in published:
        try:
            finish_article(article, by_source, content_root, assets)
        except ValueError as error:
            raise ContentError(f'{article.source.relative_to(root)}: {error}') from error
    return sorted(published, key=lambda a: (a.sort_date, a.slug), reverse=True), assets


def tag_links(article):
    return ''.join(f'<a class="tag-link" href="/writing/?topic={quote(tag)}">{escape(tag)}</a>' for tag in article.tags)


def article_page(article):
    toc = (f'<details class="article-toc" id="article-toc" open><summary>本文目录</summary><nav aria-label="文章目录">{article.toc}</nav></details>' if article.toc else '')
    return f'''<div class="container article-container">
  <nav class="breadcrumb" aria-label="面包屑"><a href="/writing/">全部文章</a><span>/</span>{escape(article.tags[0] if article.tags else '随笔')}</nav>
  <header class="detail-header article-header"><h1>{escape(article.title)}</h1><p class="lead">{escape(article.summary)}</p><div class="article-meta"><span>mohan</span>{article.date_html}<span>约 {article.minutes} 分钟</span><div class="article-tags">{tag_links(article)}</div></div></header>
  <div class="article-layout">
    {toc}
    <article class="prose article-body" id="article-start" aria-label="文章正文">{article.body}<div class="article-end"><span>读到这里，谢谢你的时间。</span><a href="/writing/">继续浏览全部文章</a></div></article>
  </div>
</div>'''


def article_row(article, archive=False):
    attributes = f' data-post="{escape(article.slug, quote=True)}"' if archive else ''
    return f'''<a class="article-row" href="{article.route}"{attributes}><div class="article-row-content"><h3>{escape(article.title)}</h3><p>{escape(article.summary)}</p><div class="article-date">{article.date_html}<span>约 {article.minutes} 分钟</span><span class="article-category">{escape(article.tags[0] if article.tags else '随笔')}</span></div></div><span class="article-arrow" aria-hidden="true">↗</span></a>'''


def archive_content(articles):
    tags = sorted({t for a in articles for t in a.tags})
    buttons = '<button type="button" class="topic-filter is-active" data-topic="" aria-pressed="true">全部</button>'
    buttons += ''.join(f'<button type="button" class="topic-filter" data-topic="{escape(t, quote=True)}" aria-pressed="false">{escape(t)}<span>{sum(t in a.tags for a in articles)}</span></button>' for t in tags)
    groups = {}
    for article in articles:
        groups.setdefault(article.sort_date[:4] or '随笔', []).append(article)
    listing = ''.join(f'<section class="archive-year" data-year><h2>{year}</h2><div class="article-list">{"".join(article_row(a, True) for a in group)}</div></section>' for year, group in groups.items())
    payload = json.dumps({a.slug: {'text': a.search, 'tags': a.tags} for a in articles}, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    return {'article_count': str(len(articles)), 'topic_filters': buttons, 'archive_rows': listing or '<p class="archive-no-posts">文章正在整理中。</p>', 'search_index': payload}


def home_content(articles):
    return {'latest_articles': ''.join(article_row(a) for a in articles[:3]) or '<p class="muted">文章正在整理中。</p>'}
