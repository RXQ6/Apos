# Apos（景枢）

**网页版**电商场景规划智能工作台 + 可验证 domain 内核 + 购物小店（沙箱支付）。

## 启动（只需浏览器）

```bash
npm install
npm.cmd run gate          # 可选：结构/测试
npm.cmd run web           # 或 npm.cmd run dev / start
```

打开：

| 页面 | 地址 |
|---|---|
| Agent 工作台 | http://127.0.0.1:8787/workbench |
| 购物小店 | http://127.0.0.1:8787/ |

配置根：`~/.apos/`（SQLite + 会话）。

### 工作台

- 场景列表与 harness 状态  
- 权限 explore / ask / allow-all  
- 会话、对话 Agent（无 API Key 为 echo+本地工具）  
- 模型设置（Provider / Key）  

### 小店

选物 → 购物车 → 报价（活动价›会员价›券）→ 沙箱支付 → 订单/物流。

## 目录

```text
apps/shop         网页主产品（Hono + SPA）
apps/electron     可选桌面壳（非必须）
packages/shared   domain / agent / tools / db
features/ modules/ docs/   文档权威域
```

## 可选：桌面壳

```bash
npm.cmd run build:electron
# cd apps/electron && npx electron dist/main/main.js
```

## 门禁

```bash
npm.cmd run gate
```

文档入口：`AGENTS.md`。
