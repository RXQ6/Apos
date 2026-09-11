# QUALITY.md — 模块质量快照

会话结束或定期清理后更新。优先处理评分最低模块。

评分维度：验证通过 / 文档可理解 / 路由对称 / 边界清晰（A–D）

| 模块 | 综合 | 验证 | 文档 | 路由 | 备注 |
|---|---|---|---|---|---|
| catalog | B | 骨架自检 | MODULE/ROUTING/methods | 对称已写 | 缺完整业务验收 |
| inventory | B+ | 骨架自检 | preoccupy/deduct/release | 对称已写 | 超卖防护仍 draft |
| pricing | B | 骨架自检 | quote 已写 | 对称已写 | 冲突消解 draft |
| order | B+ | 骨架自检 | create/mark_paid/timeout | 对称已写 | — |
| payment | B+ | 骨架自检 | create/callback/timeout | 对称已写 | refund 方法 MD 未写 |
| fulfillment | B | 骨架自检 | create_shipment/ship | 对称已写 | 部分发货 draft |
| aftersale | B- | 骨架自检 | open/refund_only | 对称已写 | return_refund 待设计 |
| customer | B | 骨架自检 | login/get/address_save | 对称已写 | — |

## 同步策略

- **即时**：每个会话结束前更新受影响模块行
- **每周**：全表重评 + 结构校验脚本
