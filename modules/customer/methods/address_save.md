# customer.address_save

## 职责

保存/更新收货地址，归属当前登录用户。

## 谁调用

- 场景 `customer.address_save`

## 输入

- customer_id（会话）, address fields

## 输出

- address_id

## 禁止

- 越权改他人地址
