# DECISIONS.md — 设计决策日志

只记「什么决策、为什么、什么时候」；不展开长文。

| 日期 | 决策 | 原因 |
|---|---|---|
| 2026-09-11 | 三层模型：features / modules / AGENTS 导航 | 场景与能力分离，便于路由与复用 |
| 2026-09-11 | 每方法必须有 `methods/*.md` | 严谨路由，避免口头旁路 |
| 2026-09-11 | 跨模块调用必须双方 ROUTING 对称 | 防止单向暗依赖 |
| 2026-09-11 | 首期 8 模块全开、场景横向扩展 | 用户勾选全量；P0 主链路先 designed |
| 2026-09-11 | 不新建 worktree，继续 `feat/ecommerce-scenario-routing` | 空仓绿场 + 用户确认 |
| 2026-09-11 | 融入 Agent Harness：PROGRESS/DECISIONS/INIT/VERIFY/QUALITY、WIP=1、功能清单三元组 | 用户提供 harness 规范图，要求调整项目结构 |
| 2026-09-11 | 产品形态 A：Electron 场景规划工作台（非通用 Agent 壳） | 用户选定 |
| 2026-09-11 | Agent 后端仅 Pi SDK（pi-agent-core + pi-ai），不做 Claude 双栈 | 用户点名 Pi Agent SDK |
| 2026-09-11 | 布局/UI/构建照抄 craft-agents-oss：apps/electron + packages/shared、shadcn/Tailwind v4、esbuild+Vite | 用户指定参照 craft-agents-oss |
| 2026-09-11 | TypeScript 5.9 + Bun + ESM + TypeBox + Vitest + Biome | 与 Pi/Craft 对齐并冻结 |
| 2026-09-11 | 数据：`bun:sqlite`；会话 SQLite+JSONL 双写；配置根 `~/.apos` | 用户确认；详见 docs/tech-stack.md |
| 2026-09-11 | 库存扣减时机：**支付成功回调时 deduct**（下单仅 preoccupy） | 闭环可对账；与 payment.callback 路由一致 |
| 2026-09-11 | 优惠冲突默认：**活动价 > 会员价 > 券**；一单默认一张券；不可叠加则 `pricing.resolve_conflict` 可解释拒绝 | 拍板解除 promo_conflict 阻塞 |
| 2026-09-11 | 退货退款：**必须仓收货成功后才 payment.refund + inventory 回补**；仅退款不入库 | 拍板解除 return_refund 阻塞；与 fulfillment 收货事件对称 |
| 2026-09-11 | 超卖防护默认：预占原子扣减（DB 事务/行锁）；不引入分布式锁服务 | 拍板 oversell_guard 实现边界 |
| 2026-09-11 | 产品名 **Apos（景枢）**；remote `RXQ6/Apos` | 用户要求易记名 + 指定仓库 |
| 2026-09-11 | 首期 runner 用 echo+工具事件面，Pi SDK 仅作依赖预留 | 无 Key 也可验证 UI/工具/权限 |
| 2026-09-11 | 本机无 Bun 时用 Node 24 `node:sqlite`；接口对齐后续 bun:sqlite | 环境限制，不改契约 |
| 2026-09-11 | 最小运行时切片：SKU/库存/预占/订单/支付扣减/取消释放，进程内 + SQLite 事务 | 先验证契约可落地，再服务化 |
| 2026-09-11 | 全域服务补齐 cart/customer/catalog/payment/fulfillment/aftersale + 进程内事件 | A–D 落地路径 |
| 2026-09-11 | Pi 无 Key 时 echo/工具；有 Key 走 pi-agent-core/pi-ai bridge | 可离线开发 |
| 2026-09-11 | 嵌套事务用 SAVEPOINT | 避免 payment callback 内再 BEGIN |
| 2026-09-11 | E 后置：MCP/秒杀/跨境/复杂促销/完整安装包 | 见 PROGRESS |
