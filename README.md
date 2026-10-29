# PayPal AI Hackathon

PayPal AI Hackathon 2026 项目工作区。

- 比赛官网：[PayPal AI Hackathon](https://paypalaihackathon.devpost.com/)
- 产品方向：通用票据整理与报销助手。AI 检查材料，按组织规则请求补交、转人工或自动批准，再通过 PayPal 处理报销付款。
- 当前阶段：方向已确定，产品设计与开发计划待评审；截至 2026-10-29，没有可运行的应用。
- 拟议技术栈：Next.js + TypeScript、Supabase、服务端 AI API Key、PayPal Sandbox Payouts。详细选型与范围见规划文档。
- 凭据只保存在服务端环境变量或部署平台密钥设置中，不进入浏览器或仓库。

## 项目资料

- [比赛规则、截止时间与提交要求](docs/hackathon-rules.md)
- [当前产品方向与选题历史](docs/project-direction.md)
- [规划索引](docs/planning/README.md)
- [产品设计与 MVP 范围](docs/planning/prd.md)
- [技术栈与 AI / PayPal 接入设计](docs/planning/technical-design.md)
- [开发顺序和里程碑](docs/planning/development-plan.md)
- [项目协作约定](AGENTS.md)

比赛规则备忘录核查于 2026-10-28；产品规划更新于 2026-10-29。规划描述目标行为，不作为实现或实际支付成功的证据。

## 仓库状态

仓库先以私有形式建立。比赛提交前需要公开源码并加入合适的开源许可证；公开、许可证选择和正式提交在准备好作品后处理。

研究文档通过独立分支和 Pull Request 提交。后续实现从最新远端默认分支建立独立 worktree，并保持改动可审查。

## 当前范围

已初始化项目资料和 Git 基础。比赛报名、PayPal Developer 账号配置、应用实现、部署和正式参赛提交分别跟踪，不因仓库创建而视为完成。
