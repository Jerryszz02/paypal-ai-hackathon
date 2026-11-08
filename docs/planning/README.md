# 报销助手规划索引

更新／状态核查：2026-11-08（Europe/London）。工作模式：每周文档同步，核对 11 月 2–8 日用户对话、视频交付清单与现有实现；本轮不配置服务、不执行参赛提交。用户已授权公开源码并使用 MIT，选择 DeepSeek 接入；真实 AI 与 PayPal Sandbox 验收仍待配置。

规范项目根目录：`/Users/jerryszz/Desktop/Projects/Hackathons/PayPal AI Hackathon`。[第一版 PR #3](https://github.com/Jerryszz02/paypal-ai-hackathon/pull/3) 已合并；[MIT PR #4](https://github.com/Jerryszz02/paypal-ai-hackathon/pull/4) 已合并，仓库已公开。[DeepSeek PR #5](https://github.com/Jerryszz02/paypal-ai-hackathon/pull/5) 与 [数据库加固 PR #6](https://github.com/Jerryszz02/paypal-ai-hackathon/pull/6) 也已合并；本次核对基准为 2026-11-08 fetch 后的 `9c6889e`（包含文档 PR #7）。Devpost 已保存草稿，尚未正式提交。

## 目标与当前事实

- **实施基线**：工作名称 Carry；英文界面、单组织 GBP、报销人与财务角色、£50／£200／30 天示例政策，自动付款默认关闭。
- **本地第一版已实现**：六个页面、私有票据上传与原件预览、样本识别／字段确认、确定性规则分流、补交、人工决定、版本与审批记录、收款档案、政策、双状态付款与 CSV。
- **本地持久化已验证**：PGlite 执行 PostgreSQL schema；事务控制累计占用、唯一付款意图、历史不可变、任务恢复和角色隔离。浏览器不直接访问数据库或存储。
- **接入代码已实现，外部待验证**：Supabase Auth／私有 Storage／Postgres、OpenAI／DeepSeek Responses、PayPal Sandbox Payouts 与验签通知。模型与付款自动化测试使用替身，不是模型调用或到账证明。
- **Supabase 部分验收已完成**：独立 Carry Sandbox 项目、14 张启用 RLS 且撤销客户端直连权限的业务表、私有票据桶及三个受控测试账号已配置；真实 Auth 登录、文件上传下载及拒绝越权访问的探针通过。
- **仍未完成**：本机 Postgres 直连与应用完整 Sandbox 流程、真实模型调用和质量评估、PayPal Sandbox 交易、应用部署、视频的 YouTube 上传与正式提交。

用户确认的本轮边界允许先验收本地流程。因此 M0 的真实服务出口保持待验证，未被模拟结果替代；本地实现不宣称满足比赛要求的真实 AI＋Sandbox 集成。

## 参赛草稿与阻塞的最后记录

- 本机 `.local/submission/devpost-status.md` 更新于 2026-11-02，记录最终源码包 `carry-v1-9dc962c.zip` 已上传、保存并重新打开确认，工作版本链接固定到该提交。10 月 30 日锁屏造成的上传阻塞已在用户解锁后解除，不作为当前阻塞；本轮未操作屏幕或网站。
- Devpost 最后有据状态仍为 2026-11-02 记录的 Draft（3/5），本轮未重新核对网站；11 月 8 日的视频交付清单仍明确 `youtube_uploaded=false`、`devpost_submitted=false`。本地视频已经制作，但尚缺 YouTube 视频链接；最终规则／条款接受和 Submit project 尚未执行。源码公开、MIT、草稿保存与上传均不能替代提交回执。
- 最新本机交付记录仍将应用数据库直连、真实 AI／PayPal Sandbox 与完整应用流程标为待验收；有限 Supabase Auth／Storage 检查不证明完整闭环。本次维护仅同步状态，不读取密钥、恢复服务或发起外部操作。

## 本地视频已制作，上传与正式提交未完成

2026-11-08 用户认可分镜后，160 秒、1920×1080、30 fps 的英文旁白与字幕演示片已完成，另有 SRT、封面和 YouTube 描述。本机 `.local/submission/video/manifest.json` 记录视频制作源码为 `c79ce46`、录制应用为 `9c6889e`；本轮已核对四个交付文件的大小与 SHA-256。制作源码在 [PR #8](https://github.com/Jerryszz02/paypal-ai-hackathon/pull/8) 待审，尚未合入本次默认分支；操作与制作边界见该分支的 [video/README.md](https://github.com/Jerryszz02/paypal-ai-hackathon/blob/c79ce4607a60f50f610490b72750cdcbf41e11c7/video/README.md)。

成片展示实际本地界面，但票据、提取和付款明确为模拟；它不能证明真实 AI 或 PayPal Sandbox 已接通。YouTube 上传、把链接填回 Devpost、真实集成演示替换及最终参赛提交仍需分别验收。本轮未渲染、上传、启动预览或修改视频制作分支。

11 月 5 日对话只确认数据库密码／模型 Key 的本机填写入口及 PayPal 注册页已准备；没有后续真实连接成功证据。不能据此把配置或服务验收改为完成；本轮未读取环境文件或检查凭据。

## 文档集合

| 文档 | 本次处理 | 权威边界 |
| --- | --- | --- |
| [产品设计与 MVP](prd.md) | 保留需求基线 | 定义目标行为及 A01–A12；外部验收仍待执行 |
| [技术设计](technical-design.md) | 保留实现取舍 | 设计约束；当前代码结构以开发者指南为准 |
| [开发计划](development-plan.md) | 同步视频制作与提交边界 | 区分本地完成、真实服务门槛与发布准备 |
| [开发者指南](../developer-guide.md) | 保留 | 描述代码现在如何运行、配置、迁移与恢复；当前实现事实冲突时以代码及本轮测试为准 |

本轮更新本索引与[开发计划](development-plan.md)的视频状态；[产品方向](../project-direction.md)、[根 README](../../README.md)、[项目协作约定](../../AGENTS.md)及其余实现文档保留已有准确内容。[比赛规则](../hackathon-rules.md)保留 2026-10-28 的历史核查日期；本轮没有重新核查参赛规则。

## 验证证据与维护边界

- 2026-10-30 首次实现时的历史本地验证：lint、TypeScript、生产构建通过；Vitest 7 个文件共 105 项通过，Chrome 4 条端到端用例通过；桌面和 375px 页面完成实际浏览器检查。外部服务测试未执行。
- 后续合并交付的历史记录：PR #5 最终 head `846b140` 的 [CI](https://github.com/Jerryszz02/paypal-ai-hackathon/actions/runs/41122987921) 包含 130 项测试、生产构建与五条 Chromium 流程通过；这是对应实现提交的记录，本轮未重跑产品测试。
- 自动化入口：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e`。测试源码在 `tests/`，浏览器结果在本地忽略的 `test-results/`／`playwright-report/`；结果以实施 PR 的最终验证记录为准。
- 本地 PostgreSQL 验证包含并发额度、重启持久化、唯一付款、不可变历史及拒绝 `authenticated` 角色的直接读写。后续托管 Auth／Storage 探针为单独证据，范围见开发者指南，不代表完整应用 Sandbox 验收。
- Provider 测试使用固定响应及失效输入；PDF／图片验证、签名会话、同源校验、权限与源引用、未知结果保留、旧事件不回退到账状态均有针对性验证。
- 文档检查：`git diff --check` 与 `audit_planning_docs.py`；这些只证明格式与链接，不证明外部服务状态。
- 历史规划不承担运行日志。没有部署记录；当前运行版本应由启动进程工作目录、Git head 和服务探针核实。

## 文档取舍

需求背景、用户流程与决策仍合并在三份规划文档中。代码结构与本地运行／付款恢复合并在开发者指南中，不另建重复的 API、数据库、运维文档。真实服务与发布阶段开始后再补 dated 验收记录及发布说明。

## 仍待验证／决定

1. AI 模型、权限、费用预算及至少 15 份匿名材料的实际识别质量；本地样本不是该评估。
2. Supabase 的本机数据库直连、应用 Sandbox 权限流程与托管运行限制。
3. PayPal Sandbox Payouts 权限、测试买卖方、真实创建／单笔查询、可达 webhook 与恢复调度。
4. 应用部署、评委测试访问、真实集成演示与 YouTube 上传、正式参赛提交；公开源码及 MIT、本地模拟演示成片已完成。
