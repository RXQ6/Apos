# SCENARIO — agent.provider_config

## 正常步骤

1. 设置页选择 provider（anthropic/openai/compatible）
2. 填 baseUrl / model / apiKey
3. 写入 `~/.apos/credentials.enc`（AES）
4. runner 切换到 Pi 会话（有 Key 时）

## 无 Key

- 工作台仍可用 echo + 工具模式
