# Wows DevKit

《战舰世界》数据服务的 TypeScript SDK 集合。

## 包

| 包 | 说明 |
| --- | --- |
| [`wows-api-sdk`](packages/wows-api-sdk) | 官方 API、Vortex、公会服务客户端 |
| [`wows-number-api-sdk`](packages/wows-number-api-sdk) | wows-numbers 期望值、PR 计算与玩家页链接 |
| [`wows-replay-parser`](packages/wows-replay-parser) | Replay 元数据与对局结果解析 |

## 环境要求

- Node.js 22.18+
- pnpm 12

## 安装

```bash
pnpm add wows-api-sdk
pnpm add wows-number-api-sdk
pnpm add wows-replay-parser
```

## 使用

```ts
import { WowsApiClient } from 'wows-api-sdk/official'

const client = new WowsApiClient({
  applicationId: process.env.WG_APPLICATION_ID!,
  realm: 'eu',
})
```

```ts
import { VortexClient } from 'wows-api-sdk/vortex'

const vortex = new VortexClient({ realm: 'eu' })
const accounts = await vortex.accounts.info(1001)
```

```ts
import { calculatePR } from 'wows-number-api-sdk'

const pr = calculatePR(shipStats, expectedValues)
```

```ts
import { parseReplayFile } from 'wows-replay-parser/node'

const { meta, battleResults } = await parseReplayFile('battle.wowsreplay')
```

完整接口与响应类型见各包 README。

## 开发

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

以上命令会在 workspace 内递归执行。

## 贡献与发布

提交信息使用 Conventional Commits，版本由 Changesets 管理：

```bash
pnpm changeset          # 记录本次变更
pnpm version-packages   # 更新版本号和 CHANGELOG
pnpm release            # 构建并发布未发布的包
```

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可

MIT
