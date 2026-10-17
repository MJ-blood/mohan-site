# mohan 的工作室

基于 Astro + TypeScript 的个人写作与作品展示站，使用 Markdown 持续更新。文章归档支持正文搜索、主题筛选与年份分组；文章页自动生成目录，首页自动显示最近更新。保留实践案例与关于页，PC／手机分别适配；页头提供开灯／关灯，首次跟随系统并记住手动选择，减少动效设置放在页脚。

## 本地使用

Node.js 24.15+（24.x），版本入口为 `.node-version`。依赖只安装到项目目录，使用 npm 和项目锁文件：

```bash
npm ci
npm run dev
```

打开 `http://localhost:4321`。开发服务仅监听本机，修改文章、组件或样式后自动更新预览。Windows PowerShell 若拦截 npm.ps1，使用 `npm.cmd` 执行相同命令。

`npm run build` 执行类型检查、静态构建与产物检查；`npm run preview` 预览构建后的 `dist/`。线上只需要静态文件托管，无需运行 Python、Node.js 服务或数据库。

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

支持标题、段落、引用、嵌套列表、链接、图片、代码块、表格与删除线。正文从 `##` 开始；使用 `## 标题 {#stable-id}` 可固定锚点。不执行正文内的 HTML／脚本，不启用 MDX 或数学公式插件。

图片可放在文章旁的子目录，例如 `content/posts/images/example.png`，正文写 `![图片说明](images/example.png)`。构建只复制实际引用的图片／PDF，不复制整个知识库。文章之间可以写相对链接，例如 `[继续阅读](knowledge-to-output.md#judgment)`。

本地保存刷新只更新本地预览。正式网站更新时，构建生成 `dist/`，将它部署到选定的托管服务；当前尚未部署，也未配置自动发布。Astro 每次构建重新生成 dist/，删除／改名文章、转为草稿或取消附件引用后，旧页面和旧附件不会继续留在新产物中。dist/ 只能保存派生产物。

## 修改入口

| 内容 | 唯一正本 |
| --- | --- |
| 文章正文、标题、摘要、主题、日期 | `content/posts/**/*.md` |
| 页面路由与元数据 | `src/pages/**/*.astro` |
| 导航、页脚、文章卡片等 | `src/components/` |
| 共享页面布局 | `src/layouts/SiteLayout.astro` |
| 基础排版、主题与响应式 | `src/styles/site.css` |
| 首页与作品插画、展示动效 | `src/styles/presentation.css`、`src/scripts/presentation.ts` |
| 浏览器交互 | `src/scripts/` 中的 TypeScript 模块 |
| 内容集合、加载与查询 | `src/content.config.ts`、`src/loaders/posts.ts`、`src/lib/content.ts` |
| 文章格式规则与 Markdown 插件 | `src/lib/post-source.ts`、`src/lib/markdown.ts` |
| 直接公开的静态文件 | `public/`，禁止放源稿或私人资料 |
| 项目约定 | [PROJECT_RULES.md](PROJECT_RULES.md) |
| 产品与视觉决策、参考网站 | [docs/design.md](docs/design.md) |
| 文案依据与事实边界 | [docs/content-sources.md](docs/content-sources.md) |

`dist/` 是派生产物，禁止手改。文章正文只维护 Markdown。私人知识库不会被自动读取或公开。

## 验证

```bash
npm run check
npm test
npm run build
npm run test:browser
```

`check` 检查 Astro 与 TypeScript；`test` 在 .tmp/ 隔离目录验证内容规则、真实构建和开发预览；`build` 检查页面结构、资源、链接、锚点与草稿公开范围。浏览器测试使用已安装的 Edge，报告保存在 `.tmp/browser-report/`。其他系统可设置 `BROWSER_CHANNEL=chrome` 使用本机 Chrome；没有浏览器时需另行准备，不能将该检查记为通过。

## 当前状态

- Astro + TypeScript 架构保留 10 个页面、3 篇文章与访问地址。已完成全站明暗主题、首页与作品展示、阅读排版和页脚动效偏好调整，验证结果及边界见下方。
- 文案根据已有知识库改写，仍待 mohan 最终发布审阅；不补造历史发表记录。
- 公开联系方式未设置；未部署，域名与托管尚未确定。
- 当前项目目录以 Git 根为准；代码提交记录以 Git 为准，提交与推送不代表部署。

历史 Python 实现验证已归档至 [2026-10-03 验证记录](docs/archive/2026-10-03-validation.md)，不作为当前架构的验收依据。原源码保留在 [历史源码归档](docs/archive/python-site/README.md)，不参与构建和发布。

## 主题与阅读调整验证记录

日期：2026-10-17。环境：Windows、Node.js 24.15.0、本机 Edge（Chromium）。

| 命令／检查 | 结果 |
| --- | --- |
| `npm run build` | 退出 0；包含 Astro／TypeScript 检查，0 错误、0 警告；10 页、3 篇文章、171 处引用与锚点检查通过 |
| `npm run test:browser` | 退出 0，桌面／手机模拟共 14 项测试通过 |
| `npm test` | 退出 1；8 项内容测试通过，1 项发布流程测试未通过，停在等待临时开发预览地址的步骤并超时 |
| 现有 `http://127.0.0.1:4321/` 热更新预览 | 最后收紧首页间距、统一页头宽度后，桌面／手机开关灯、跨页记忆、导航宽度与文章布局定向检查通过；无页面脚本错误 |
| 文档链接、UTF-8 与 `git diff --check` | 通过 |

浏览器测试覆盖 10 页在浅色／深色及 320、390、768、1024、1440px 下的结构与溢出；覆盖搜索、筛选、URL 恢复、主题跟随系统、手动选择优先、刷新与返回、跨标签页同步、首屏提前应用主题、存储不可用、页脚动效偏好、菜单键盘操作、目录、阅读进度和禁用 JavaScript 的系统配色。

最后的首页间距与共享页头宽度调整按用户要求直接在已有开发服务中检查，没有重新运行构建或整套测试；`dist/` 因此不是最终微调的发布产物，正式发布前需重新构建。已查看最终浅色桌面首页、深色手机首页和浅色文章截图，位于 `.tmp/ui-refresh/`。浏览器测试报告位于 `.tmp/browser-report/`。

发布流程测试中的静态构建步骤已运行到改名与附件清理校验，随后等待隔离开发服务地址超时，开发热更新部分未完成；不能记为该项通过。当前用户运行的 4321 服务已完成上述定向预览。Safari、Firefox、真实手机、屏幕阅读器和线上部署未验证。依赖未变化，本轮未重复运行安全审计。

## 首页与作品动效调整验证记录

日期：2026-10-17。本次在已有 `http://127.0.0.1:4321/` 开发服务上热更新，增加左右首屏、创作流程插画、作品流程预览、成组入场与悬停反馈；保留主题切换、页脚减少动效及稳定的文章正文。

- `node .tmp/studio-refresh/preview.mjs`：桌面深浅主题与手机深色截图已查看；采样确认创作卡片随时间移动，无脚本错误。
- `node .tmp/studio-refresh/check.mjs`：退出 0；键盘聚焦暂停、页脚动效关闭／恢复、系统减少动效、320／390／768／820／1024／1440px 首页宽度、手机浅色、作品列表、文章阅读及禁用 JavaScript 内容检查通过。
- 截图与本次定向检查脚本保存在 `.tmp/studio-refresh/`，属于本地复核材料，不参与网站运行或发布。

按用户要求未重新运行构建和整套测试，以上主题与阅读阶段的构建／测试记录不代表本次新增动效的完整回归结果；`dist/` 尚未更新。验证仅覆盖本地预览，尚未部署。
