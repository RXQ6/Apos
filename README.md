# Apos（景枢）

电商**场景规划智能工作台** + 可验证 domain 内核 + 最小购物前台（沙箱支付）。

## 首次运行

```bash
npm install
# Electron 二进制若下载失败（GitHub 超时）：
# $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
# npm install electron --workspace=@apos/electron

npm.cmd run gate          # verify + smoke + tests
npm.cmd run shop          # 小店 http://127.0.0.1:8787
npm.cmd run dev           # Electron 工作台（内嵌启动小店）
```

配置根：`~/.apos/`（`data.db` + `sessions/`）。

## 小店闭环

1. 打开 `http://127.0.0.1:8787`（或 Electron 侧栏「打开小店」）
2. 「种子数据」→ 注册/登录 → 加购 → 创建订单 → 沙箱支付
3. 可选：地址簿、演示券 OFF100、物流轨迹查询

## 网页版工作台（Agent）

纯浏览器即可，无需 Electron：

```bash
npm.cmd run shop
# 打开 http://127.0.0.1:8787/workbench
```

- 场景列表 / 权限三档 / 会话 / 对话（无 Key 为 echo+工具）
- 模型设置保存 Provider；小店入口在顶栏

## 目录

```text
apps/electron     工作台（Agent + 内嵌 shop）
apps/shop         Hono API + 静态前台
packages/shared   domain / tools / db / channels
features/ modules/ docs/   文档权威域
```

## 支付渠道

| 渠道 | 状态 |
|---|---|
| sandbox | 默认；HMAC 验签回调 |
| alipay / wechat | 适配层预留；配置 `app_settings` 键 `payment.alipay.config` / `payment.wechat.config`（JSON：`merchantId`,`secret`）后可 charge；公网回调需自备 |

```bash
# 列出渠道
curl http://127.0.0.1:8787/api/payments/channels
```

## 安装包（可选）

```bash
npm install
npm.cmd run build:shared
npm.cmd run build -w @apos/shop
npm.cmd run build -w @apos/electron
npm.cmd run dist -w @apos/electron   # 产出 apps/electron/dist-electron
```

Windows NSIS / macOS DMG / Linux AppImage 由 electron-builder 生成。首次打包需下载 Electron 发行物，可用镜像环境变量。

## 门禁

```bash
npm.cmd run gate   # verify 40/40 + smoke + vitest
```

文档入口：`AGENTS.md`。
