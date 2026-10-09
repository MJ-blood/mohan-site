# mohan 的工作室

一个以 Markdown 持续更新的个人写作站。文章归档支持正文搜索、主题筛选与年份分组；文章页自动生成目录，首页自动显示最近更新。保留实践案例与关于页，PC／手机分别适配，页头动效开关会记住跨页选择。

## 本地使用

Python 3.10+，首次运行时安装项目依赖（不安装到全局）：

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python scripts/serve.py --port 4321
```

打开 `http://localhost:4321`。服务启动时构建；新增或修改文章、模板与样式后，刷新浏览器即可看到变化。服务仅监听本机。修改 Python 构建脚本后需重启服务。

## 发布一篇文章

把 `.md` 文件放进 `content/posts/`，无需改页面配置、HTML 或文章列表。文件名决定默认地址，例如 `my-note.md` 对应 `/writing/my-note/`，也支持中文文件名。文件名／`slug` 应保持稳定，修改标题不会改变地址。

普通 Markdown 可以直接使用：首个 `# 标题` 作为文章标题，首段作为摘要。也可以在文件开头添加可选的 YAML 信息：

```markdown
---
title: 这次实践让我重新想了什么
summary: 一句话说明文章讨论的问题。
date: 2026-10-03
tags: [AI 工程, 产品思维]
---

从一个实际问题开始。

## 我的做法

写下过程、选择与结果。
```

可选字段：`title`、`summary`、`tags`、`date`（发表日期）、`updated`（更新日期）、`slug`（固定地址）、`draft: true`（不进入公开构建）。日期需要真实填写；没有日期也能展示，不从文件修改时间推断发表日期。按 `updated` 优先、其次 `date` 排序，无日期内容列在后面。阅读时长按正文估算。

支持标题、段落、引用、嵌套列表、链接、图片、代码块、表格与删除线。正文从 `##` 开始；使用 `## 标题 {#stable-id}` 可固定锚点。不执行正文内的 HTML／脚本，暂不支持 MDX、数学公式或脚注扩展。

图片可放在文章旁的子目录，例如 `content/posts/images/example.png`，正文写 `![图片说明](images/example.png)`。构建只复制实际引用的图片／PDF，不复制整个知识库。文章之间可以写相对链接，例如 `[继续阅读](knowledge-to-output.md#judgment)`。

本地保存刷新只更新本地预览。正式网站更新时，构建生成 `dist/`，将它部署到选定的托管服务；当前尚未部署，也未配置自动发布。删除／改名文章、取消图片或 PDF 引用后，若有遗留页面或附件，构建会报错；先核对这些文件，再使用新的输出目录，不会自动删除文件。

## 修改入口

| 内容 | 唯一正本 |
| --- | --- |
| 文章正文、标题、摘要、主题、日期 | `content/posts/**/*.md` |
| 非文章页面路由与元数据 | `src/pages.json` |
| 首页、归档、案例、关于页模板 | `src/pages/*.html` |
| 导航、页脚与共享布局 | `src/layout.html`、`scripts/build.py` |
| 视觉、响应式与交互 | `src/assets/site.css`、`src/assets/site.js` |
| Markdown 读取、列表与目录派生 | `scripts/articles.py` |
| 项目约定 | [PROJECT_RULES.md](PROJECT_RULES.md) |
| 产品与视觉决策、参考网站 | [docs/design.md](docs/design.md) |
| 文案依据与事实边界 | [docs/content-sources.md](docs/content-sources.md) |

`dist/` 是派生产物，禁止手改。三份旧文章 HTML 只保留迁移指针，不再承担正文或参与构建。私人知识库不会被自动读取或公开。

## 验证

```bash
.venv/bin/python scripts/build.py
.venv/bin/python scripts/check.py
.venv/bin/python -m unittest discover -s tests -v
node --check src/assets/site.js
```

行为测试在隔离临时目录覆盖新增／更新 Markdown、普通文件与元数据、中文文件名、目录锚点、图片和相对文章链接、草稿排除、错误输入、转义、旧产物检测，以及预览保存刷新、并发读取与错误恢复。

## 当前状态

- 本轮 PC／手机排版与动效调整：完成，已通过下方本地验证。Markdown 文件发布方式保持不变。
- 文案：根据已有知识库改写，待 mohan 最终发布审阅；日期使用本次整理日期，不补造历史发表记录。
- 公开联系方式：未设置。
- 发布：未部署，域名与托管尚未确定；本地实现不代表线上验收。

实际项目与 Git 根：`/home/mo/projects/mohan-site`，分支 `main`，尚无提交，暂无 SHA。过程快照和一次性浏览器证据保留在 `.tmp/`，不进入构建。之前布局的验证记录属于历史证据，当前结果以下方记录为准。


## 本轮验证记录

日期：2026-10-03。首页去掉重复推荐，最近文章与实践成为主线；工作流程、持续关注的问题移到关于页。归档改为顶部搜索与折叠主题菜单，文章列表统一为标题、摘要、元信息。详情页收紧头部，保留桌面侧栏目录和手机折叠目录。动效按内容组进入、交互状态切换分开处理，暂停选择跨页保存。

| 命令／检查 | 结果 |
| --- | --- |
| `.venv/bin/python scripts/build.py` | 退出 0，生成 10 页，其中 3 篇 Markdown 文章 |
| `PYTHONDONTWRITEBYTECODE=1 .venv/bin/python scripts/check.py` | 退出 0，172 处引用、资源、元数据、锚点及产物一致性通过 |
| `PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s tests -v` | 退出 0，18 项行为测试通过 |
| `node --check src/assets/site.js` | 退出 0 |
| `node /tmp/mohan-polish/qa.cjs` | 退出 0，81 项浏览器检查通过，无脚本异常或失败请求 |

Chromium 覆盖全部 10 页在 320、390、768、1024、1440px 下的结构与横向溢出；桌面／手机搜索、主题组合、空结果恢复、URL 恢复、浏览器返回、文章标签入口、目录与旧锚点、阅读进度、404，以及 200% 字号、无 JavaScript 阅读。正常动效模式额外检查标题与正文同步可见、筛选位置过渡、快速连续输入、目录反向展开、卡片悬停、暂停跨页与返回恢复、实时减少动效、菜单 Enter／Tab／Escape、跨断点导航与目录状态。最终菜单使用原生 DOM 顺序，避免依赖动画时序转移焦点。

布局位置的前后比较（约数，单位 CSS px；PC 1440 × 1000，手机 390 × 844）：

| 内容起点 | PC 调整前 → 后 | 手机调整前 → 后 |
| --- | --- | --- |
| 首页首篇文章标题 | 841 → 470 | 726 → 460 |
| 归档首篇文章标题 | 569 → 429 | 809 → 458 |
| 文章正文 | 506 → 329 | 611 → 421 |

已实际查看两端首页、归档、详情截图与关于页布局。验证脚本、报告、截图、本轮修改前快照保留在 `.tmp/layout-polish/`；它们不进入构建。脚本依赖本机已有 Playwright／Chromium 的绝对路径，换机需调整。早先 Markdown 格式专项证据保留在 `.tmp/markdown-verification/`，属于历史记录。

最终源码完成只读审阅；发现的手机菜单键盘顺序问题已修复并通过浏览器回归。未验证 Safari、Firefox、真实手机、屏幕阅读器或线上部署；内容发布审阅仍待 mohan 完成。
