# pricing.resolve_conflict

## 职责

多券/多活动不可叠加时，按规则产出唯一可生效优惠组合与可解释明细。

## 谁调用

- 场景 `pricing.promo_conflict`（define）
- 由 `pricing.quote` 内部调用

## 输入

- candidate_promos[]: id, type, priority, stackable, discount

## 输出

- selected[], rejected[], reason_codes[]

## 规则来源

- 优先级表（待业务确认；当前 draft 阻塞）

## 失败

- `PROMO_UNRESOLVABLE`（规则冲突无解）

## 禁止

- 静默丢弃优惠且不留 reason
- 支付阶段改变选择结果
