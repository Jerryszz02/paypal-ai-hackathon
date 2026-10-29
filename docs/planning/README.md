# 报销助手规划索引

更新／状态核查：2026-10-29（Europe/London）。模式：根据用户认可的方向创建产品设计与开发计划，供实施前评审。

规范项目根目录：`/Users/jerryszz/Desktop/Projects/Hackathons/PayPal AI Hackathon`。

## 目标与当前事实

- **已确定方向**：通用票据整理、报销请求收集、AI 检查、补交／人工／自动批准分流，以及 PayPal 付款；AI 采用服务端 API Key 接入。
- **计划中、待评审**：具体 MVP、技术栈、页面、规则默认值和开发顺序；产品名称尚未决定。
- **已核实的仓库事实**：本轮基于远端默认分支 `main` 的 `013f745`；该基线只有仓库资料与研究文档，没有应用代码、包清单、数据库迁移或测试套件。本次新增的仍只有 Markdown 文档。
- **未验证**：AI Key／模型权限、PayPal Sandbox 账号及实际付款、Supabase／托管服务配置、运行部署、报名和正式提交。本次没有调用付费 AI、创建云项目或发起付款。

本目录保留设计与需求基线。以后实现事实以代码和实际验证记录为准，不能因规划写明某项能力就标为已实现。

## 文档集合

| 文档 | 本次处理 | 内容与权威边界 |
| --- | --- | --- |
| [产品设计与 MVP](prd.md) | 新增 | 用户、页面、范围、分流规则、状态与验收场景 |
| [技术设计](technical-design.md) | 新增 | 拟议技术栈、API Key、模块和数据职责、支付一致性与隐私边界 |
| [开发计划](development-plan.md) | 新增 | 依赖顺序、阶段出口、时间安排、验证与提交准备 |

仓库级配套文档同步：[根 README](../../README.md)、[项目协作约定](../../AGENTS.md)、[当前产品方向](../project-direction.md)。[比赛规则备忘录](../hackathon-rules.md)保持其 2026-10-28 核查日期；本轮仅另行复核了官方截止日，不将整份旧规则记录冒充为重新全面核查。

旧 ScopePay 推荐在当前方向文档中退役，完整旧方案保留于 Git 历史。当前没有运行日志或部署历史。

## 文档取舍

| 未单独生成的文档 | 原因／未来拆分条件 |
| --- | --- |
| project-brief、user-flow、decision-log | 合并到 PRD、技术设计和当前方向说明，避免重复 |
| architecture、api-design、database-design、security-privacy | 首版单应用，必要约束合并到技术设计；实现接口／数据库契约复杂后再拆分 |
| test-plan、release-plan | 阶段验证和演示发布要求合并到开发计划；测试与部署方案确定后补实测记录 |
| developer-guide、operations-runbook | 尚无代码和可运行命令，不编造运行手册；开始实现后再建立 |

## 本轮核查证据

- 阅读基线 `AGENTS.md`、`README.md`、`docs/project-direction.md`、`docs/hackathon-rules.md`，核对 `git status`、`git worktree list` 和远端默认分支。
- 本轮官方资料入口与核查日期记录于[技术设计](technical-design.md)和[开发计划](development-plan.md)。外部资料支持选型，不证明本项目账号可用。
- 文档交付检查：`git diff --check`；逐一核对本地 Markdown 链接；规划技能的 `audit_planning_docs.py --root <工作树路径>` 检查索引与链接。检查结果随本次 PR 说明记录。
- 没有应用代码，故不运行应用测试、构建、安装依赖或迁移。未来阶段的验收项目均为计划，不是本轮通过结果。

## 待确认

1. 用户对 MVP、页面和开发顺序的评审；本次不启动实施。
2. AI 供应商与可用模型、模型调用预算；API Key 接入方式已确定，密钥值无需进入文档或聊天。
3. 具体产品名、组织示例、GBP 单币种与 £50／£200／30 天样例政策是否沿用。
4. Supabase 和托管服务选用的项目／账户、费用和评委访问方案；待实施授权后核实。
5. PayPal Sandbox Payouts 实际权限与测试接收账户；参赛资格、报名状态仍以用户账户实际核查为准。
