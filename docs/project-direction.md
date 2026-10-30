# 当前产品方向

更新日期：2026-10-30（Europe/London）。用户已认可**通用票据整理与报销助手**计划，并授权实现第一版；本轮明确选择本地流程与真实服务接入代码，外部调用留待配置后验收。工作名称 Carry。

## 已确定的方向

组织配置报销规则；报销人提交票据和用途；AI 提取内容并指出疑点，程序根据明确规则分流为自动批准、请求补交或人工审核；通过审批的申请由 PayPal Sandbox Payouts 付款，并跟踪单笔付款结果。

AI 使用服务端 API Key；本轮实现 OpenAI Responses adapter，具体模型与费用预算待配置。Supabase 与 PayPal Sandbox 接入代码已提供；本地 demo 明确使用模拟识别与付款，不调用外部供应商。

## 设计与开发计划入口

- [规划索引与当前状态](planning/README.md)
- [产品设计、MVP 范围、页面和验收场景](planning/prd.md)
- [技术栈、AI 接入、数据与支付边界](planning/technical-design.md)
- [开发顺序、里程碑与交付检查](planning/development-plan.md)
- [比赛规则备忘录](hackathon-rules.md)

## 选题历史

2026-10-28 的自由职业者需求变更与收款提案（ScopePay）已被本次方向替代，不作为实现要求。旧方案保留在 Git 历史中，不再维护其功能清单或时间安排。

本地实现与验证见[规划状态](planning/README.md)。需求市场验证、真实模型质量、PayPal 账号权限、部署或参赛提交仍未完成。
