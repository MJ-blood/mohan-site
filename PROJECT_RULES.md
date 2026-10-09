# mohan 个人站规则正本

- 定位：有真实实践支撑的个人写作站，中文为主。
- 本项目是独立个人项目，与父目录的 LEJIANEL 业务仓无关。用户已指定放在 `/home/mo/projects/mohan-site`。每次写入前确认实际项目根、Git 状态；不得修改相邻项目。
- 文档类型：small-tool。文档入口、活状态正本与验证入口均为 `README.md`。长期设计见 `docs/design.md`；计划与归档目录按需建立，当前为 none。
- 文章以 `content/posts/**/*.md` 为唯一正文与元数据正本。构建自动派生详情、首页最近文章、归档、目录与搜索数据；不在站内提供编辑后台。仅显式放入此目录的文章参与构建，不扫描私人知识库。
- `src/pages.json` 只登记非文章页面；`src/pages/` 为这些页面的模板正本，`src/layout.html` 为共享布局，`src/assets/` 为样式与渐进增强脚本。三份旧文章 HTML 仅保留迁移指针，不参与构建。
- `dist/` 只由 `scripts/build.py` 派生，禁止手改，不提交生成物。可发布目录仅为 `dist/`。
- `docs/`、源稿、项目规则不放入公开构建；不得引入私有仓库标识、业务字段、联系方式或未经核实的履历与成果。
- 参考站只提供视觉方向；不复制其代码、品牌、图片、二维码、备案号或商业内容。
- 正文与导航在禁用 JavaScript 时也须可用；适配手机、键盘和减少动态效果偏好。
- 构建依赖固定在 `requirements.txt`，只安装到项目 `.venv/`。Markdown 使用维护中的解析器，正文内 HTML 作为文字展示；元数据使用 YAML 安全加载。网站运行时仍为静态资源，无外部脚本依赖。
- 验证：`.venv/bin/python scripts/build.py`、`.venv/bin/python scripts/check.py`、`.venv/bin/python -m unittest discover -s tests -v`、`node --check src/assets/site.js`，再检查桌面与手机浏览器的文章查找、目录、导航和阅读路径。
- 暂存材料只放 `.tmp/` 并排除 Git；浏览器测试报告可放其中，不能成为站点依赖。
- 提交、推送、部署均需对应授权；本次只授权本地搭建。删除、凭据、全局依赖与系统配置遵守用户红线。
