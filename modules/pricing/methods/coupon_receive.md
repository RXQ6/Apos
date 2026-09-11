# pricing.coupon_receive

## 职责

用户领取优惠券到账户券包。

## 输入

- customer_id, coupon_template_id

## 输出

- coupon_id

## 失败

- `COUPON_SOLD_OUT` / `ALREADY_RECEIVED`

## 禁止

- 超发
