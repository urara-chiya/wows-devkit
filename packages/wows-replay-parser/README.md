# wows-replay-parser

《战舰世界》Replay（`.wowsreplay`）轻量解析器。只解析文件容器、明文元数据和对局结果包，不解释实体数据包，也不依赖游戏安装目录、`GameParams` 或翻译资源。

## 能力范围

- 解析 Replay 头部与明文元数据：版本、地图、模式、玩家、双方阵容。
- 解密并解压数据包流，只扫描包头，定位 `0x22` 对局结果包。
- 解析对局结果：胜负、时长、玩家伤害、击杀、经验、存活、交互明细。
- 使用内置的最新版字段映射表把位置数组转换为命名字段。
- Node 入口直接读取文件，内置 `node:zlib`；核心解析保持 sans-io，可自行注入解压实现。

**不做什么：**

- 不解析实体属性、RPC、位置、伤害事件等其余数据包。
- 不加载 `GameParams`、舰船模型、翻译或游戏客户端文件。
- 不支持 12.6.0 之前的 Replay。旧格式没有对局结果包，完整解析需要游戏数据，已明确不做兼容。
- 不计算 PR；需要时请配合 `wows-number-api-sdk` 或其他统计工具。

## 安装

```bash
pnpm add wows-replay-parser
```

运行时仅依赖 `egoroof-blowfish`，要求 Node.js 22.18+，ESM-only。

## 使用

### Node：直接读取文件

```ts
import { getSelfPlayer } from 'wows-replay-parser'
import { parseReplayFile } from 'wows-replay-parser/node'

const { meta, battleResults } = await parseReplayFile('path/to/battle.wowsreplay')

console.log(meta.playerName, meta.mapDisplayName, meta.version)
if (battleResults) {
  const self = getSelfPlayer(meta, battleResults)
  console.log(battleResults.common.winnerTeamId, self?.damage)
}
```

同步版本：`parseReplayFileSync(path)`。

### 通用环境：自行注入解压

```ts
import { inflateSync } from 'node:zlib'
import { parseReplay } from 'wows-replay-parser'

const replay = parseReplay(buffer, { inflate: (data) => inflateSync(data) })
```

浏览器端需要提供同步解压实现；如果只有异步的 `DecompressionStream`，可以先自行解压，再使用 `parseBattleResultsPayload`、`resolveBattleResults` 等低层 API。

### 只读元数据

```ts
import { parseReplayMeta } from 'wows-replay-parser'

const meta = parseReplayMeta(buffer)
console.log(meta.vehicles)
```

元数据不需要解密，读取成本远低于完整解析；旧版本 Replay 也可以用这个入口读取头部。

## 主要 API

| API | 说明 |
| --- | --- |
| `parseReplay(buffer, options)` | 解析元数据 + 对局结果，要求 12.6.0+ |
| `parseReplayMeta(buffer)` | 只解析容器和明文元数据 |
| `readReplayContainer(buffer)` | 返回元数据、附加 block、压缩流等容器信息 |
| `parseReplayFile(path)` / `parseReplayFileSync(path)` | Node 文件入口 |
| `iteratePackets(data)` | 遍历包头与 payload，不解释内容 |
| `findBattleResultsPacket(data)` | 定位 `0x22` 结果包 |
| `parseBattleResultsPayload(payload)` | 解析长度前缀 + JSON，返回原始结构 |
| `resolveBattleResults(raw, mapping?)` | 位置数组 → 命名字段 |
| `getSelfPlayer(meta, results)` | 按账号 ID 或昵称查找录制者 |
| `LATEST_MAPPING` | 随包发布的最新版字段映射 |

## 返回结构

```ts
interface ParsedReplay {
  meta: ReplayMeta
  battleResults: BattleResults | null
}

interface BattleResults {
  raw: RawBattleResults
  mappingVersion: string
  mappingBuild: number
  accountId: number | null
  arenaId: number | null
  common: CommonBattleResults   // winnerTeamId / durationSec / gameMode ...
  players: BattlePlayer[]       // name / teamId / shipId / damage / frags ...
}
```

`BattlePlayer.fields` 保留映射后的全部字段，`BattlePlayer.interactions` 是按受害者账号索引的交互明细。`battleResults` 为 `null` 表示该 Replay 没带结果包，例如录制者在战斗结束前离开。

## 字段映射表

对局结果中的玩家数据是位置数组，需要游戏版本对应的映射表：

- `constants/latest.json`：随包发布的最新版映射，用于默认解析。
- `constants/<version>.json`：各版本快照，保留在 GitHub，不进入 npm 包。
- 包内只发布 `dist/`，因此 npm 包只包含构建时内联的最新版映射。

映射从本机 `scripts.zip` 生成，方式见下一节。解析旧版本 Replay 时也可以自行传入映射：

```ts
parseReplay(buffer, { inflate, mapping: customMapping })
```

## 从 scripts.zip 提取映射

包内附带 Node 专用的提取器，可以直接从游戏客户端的 `bin/<build>/res/scripts.zip` 生成映射，不需要依赖其他项目：

```bash
# 构建后运行
pnpm --filter wows-replay-parser build

node packages/wows-replay-parser/dist/extract-cli.mjs \
  --scripts-zip "/path/to/World of Warships/bin/<build>/res/scripts.zip" \
  --out packages/wows-replay-parser/constants
```

也可以设置环境变量：

```bash
WOWS_SCRIPTS_ZIP=/path/to/scripts.zip \
  node packages/wows-replay-parser/dist/extract-cli.mjs --no-write
```

提取流程完全用 TypeScript 实现：

1. 读取 ZIP 中央目录，解压 STORED / DEFLATE 条目。
2. 解析 Python 2.7 marshal 格式的 `.pyc`。
3. 执行 WG 的 4 段 `.pyc` 解密（XOR + base64 + zlib + marshal + swap/bit cipher）。
4. 静态扫描代码对象常量，定位 `COMMON_RESULTS`、`PLAYER_INFO`、`VEH_COMMON_RESULTS`、`VEH_CLIENT_RESULTS` 基础段和 `CLIENT_VEH_INTERACTION_DETAILS`。
5. 拼出 `CLIENT_PUBLIC_RESULTS`，再由数组派生 `publicResultIndices`。

**Ribbon 尾段说明：** `CLIENT_PUBLIC_RESULTS` 末尾的 `RIBBON_*` 字段由游戏运行时枚举生成，静态提取只保留核心段。工具会读取上一版 `latest.json`，在核心前缀完全一致时复用其 Ribbon 尾段；前缀变化时只输出核心段并告警。这样旧字段不会因为静态提取而被错误重排。

CLI 选项：

| 选项 | 说明 |
| --- | --- |
| `--scripts-zip <path>` | 必填，`scripts.zip` 路径（或 `WOWS_SCRIPTS_ZIP`） |
| `--out <dir>` | 输出目录，默认包内 `constants/` |
| `--previous <file>` | 上一版映射，默认 `<out>/latest.json` |
| `--version` / `--build` / `--patch` | 覆盖版本信息 |
| `--no-write` | 只提取并打印摘要 |

输出为精简映射：

```json
{
  "version": "15.9",
  "build": 13357625,
  "commonResults": ["arena_id", "..."],
  "publicResultIndices": { "account_db_id": 0, "...": 1 },
  "interactionDetails": ["is_primary_spotted_by_ship", "..."]
}
```

## 错误处理

所有解析错误都是 `ReplayError`，通过 `code` 区分：

`INVALID_MAGIC`、`TRUNCATED`、`INVALID_METADATA`、`UNSUPPORTED_VERSION`、`INVALID_PACKET_STREAM`、`INVALID_BATTLE_RESULTS`。

## 开发

```bash
pnpm --filter wows-replay-parser typecheck
pnpm --filter wows-replay-parser test
pnpm --filter wows-replay-parser build
```

真实 Replay 的本地验证不属于 CI 基线；单元测试使用合成 Replay，不访问网络。
