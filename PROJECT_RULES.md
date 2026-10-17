# mohan 个人站规则正本

- 定位：有真实实践支撑的个人写作站，中文为主。
- 本项目是独立个人项目，与父目录的 LEJIANEL 业务仓无关。项目边界以当前工作区的 Git 根为准。每次写入前确认实际项目根、Git 状态；不得修改相邻项目。
- 文档类型：small-tool。文档入口、活状态正本与验证入口均为 `README.md`。长期设计见 `docs/design.md`；计划目录当前为 none；历史验证归档在 `docs/archive/`。
- 文章以 `content/posts/**/*.md` 为唯一正文与元数据正本。构建自动派生详情、首页最近文章、归档、目录与搜索数据；不在站内提供编辑后台。仅显式放入此目录的文章参与构建，不扫描私人知识库。
- 路由正本为 `src/pages/` 中的 Astro 页面；共享布局在 `src/layouts/`，可复用展示在 `src/components/`，样式在 `src/styles/`，浏览器交互使用 `src/scripts/` 中的 TypeScript。
- `dist/` 只由 Astro 构建生成，每次构建可清理并重建派生产物；禁止手改或存入源文件，不提交生成物。可发布目录仅为 `dist/`。
- `docs/`、源稿、项目规则不放入公开构建；不得引入私有仓库标识、业务字段、联系方式或未经核实的履历与成果。
- 参考站只提供视觉方向；不复制其代码、品牌、图片、二维码、备案号或商业内容。
- 正文与导航在禁用 JavaScript 时也须可用；适配手机、键盘和减少动态效果偏好。
- 使用 Node.js 24.x、Astro 与 TypeScript 严格检查；依赖通过 `package.json` 和 `package-lock.json` 固定，仅安装到项目目录。Markdown 使用 Astro 的 Unified 处理器与站点插件，正文内 HTML 作为文字展示，元数据使用 YAML 安全解析与 schema 校验。网站当前输出静态资源，无外部脚本依赖。
- 验证入口见 README：`npm run check`、`npm test`、`npm run build`、`npm run test:browser`，覆盖桌面与手机的文章查找、目录、导航、明暗主题、动效偏好和无 JavaScript 阅读。
- 暂存材料只放 `.tmp/` 并排除 Git；浏览器测试报告可放其中，不能成为站点依赖。
- 提交、推送、部署均需当前任务的对应授权。删除、凭据、全局依赖与系统配置遵守用户红线。
