# wows-number-api-sdk

wows-numbers 的 TypeScript SDK：获取 Personal Rating 的 expected values，校验与缓存，并提供纯函数的 PR 计算、分段、配色和玩家页链接。运行时零依赖。

> 非官方 SDK。wows-numbers 只公开了 expected values 一个 JSON 接口，本包不抓取玩家页面。

## 安装

```bash
npm install wows-number-api-sdk
```

要求 Node.js 22.18+（依赖全局 `fetch`），也可以传入自定义 `fetch`。浏览器使用前需确认上游 CORS 策略。

## 快速开始

```ts
import { ExpectedValuesClient, calculatePR } from 'wows-number-api-sdk'

const client = new ExpectedValuesClient()
const expected = await client.get()

const result = calculatePR(
  [
    {
      shipId: 3309254640,
      battles: 120,
      damage: 12_000_000,
      frags: 100,
      wins: 65,
    },
  ],
  expected,
)

if (result) {
  console.log(result.pr, result.category) // 例如 1234.5 'average'
}
```

`shipId` 是游戏内的舰船 ID，`battles/damage/wins/frags` 是该船在该模式下的累计值。

## Expected values

### 数据源

```text
GET https://api.wows-numbers.com/personal/rating/expected/json/
```

响应结构：

```ts
interface ExpectedValuesDocument {
  time: number // Unix 秒，仅供参考，不参与缓存过期
  data: Record<
    string,
    | { average_damage_dealt: number; average_frags: number; win_rate: number }
    | []
  >
}
```

`win_rate` 是百分数（`49.91`，不是 `0.4991`）。空数组表示该舰没有可用期望值。

### 校验

`parseExpectedValues(payload)` 会拒绝：

- HTML 错误页、截断 JSON、非对象结构；
- `time` 非有限数、`data` 不是对象；
- 非空条目缺少三个有限数值字段；
- 一条有效舰船都没有。

未知舰船字段会被丢弃，返回值是规范化后的文档。

```ts
import { parseExpectedValues, shipCount, shipExpectedValues } from 'wows-number-api-sdk'
```

### 缓存

`ExpectedValuesClient` 默认使用内存缓存，TTL 为 **7 天**：

```ts
const client = new ExpectedValuesClient()

await client.get() // 命中新鲜缓存时不会发请求
await client.get({ force: true }) // 强制刷新
await client.getCached() // 只读缓存，不联网
await client.clearCache()
```

刷新失败时会继续使用过期缓存；只有完全没有可用缓存时才抛错。无效响应不会被写入缓存。

浏览器：

```ts
import { createWebStorage, ExpectedValuesClient } from 'wows-number-api-sdk'

const client = new ExpectedValuesClient({
  cache: createWebStorage(localStorage),
})
```

Node 文件缓存（原子写入，按 key 一文件）：

```ts
import { FileStorage } from 'wows-number-api-sdk/node'

const client = new ExpectedValuesClient({
  cache: new FileStorage('.cache/wows-numbers'),
})
```

也可以实现自定义 `CacheStorage`：

```ts
interface CacheStorage {
  get(key: string): string | null | undefined | Promise<string | null | undefined>
  set(key: string, value: string): void | Promise<void>
  delete?(key: string): void | Promise<void>
}
```

### 客户端配置

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `url` | `string` | 官方 API 地址 | 可指向代理 |
| `fetch` | `typeof fetch` | `globalThis.fetch` | 自定义 fetch |
| `timeout` | `number` | 无 | 请求超时（毫秒） |
| `cache` | `CacheStorage` | `MemoryStorage` | 缓存实现 |
| `cacheKey` | `string` | `wows-number:expected-values` | 缓存键 |
| `ttl` | `number` | 7 天 | 缓存有效期（毫秒） |
| `now` | `() => number` | `Date.now` | 可注入时钟 |

## Personal Rating

### 公式

对每艘**有期望值**的舰船 i（`b_i` 为场次）：

```text
E_dmg   = Σ average_damage_dealt_i × b_i
E_frags = Σ average_frags_i × b_i
E_wins  = Σ (win_rate_i / 100) × b_i

r_dmg   = Σ damage_i / E_dmg
r_frags = Σ frags_i  / E_frags
r_wins  = Σ wins_i   / E_wins

n_dmg   = max(0, (r_dmg   - 0.4) / 0.6)
n_frags = max(0, (r_frags - 0.1) / 0.9)
n_wins  = max(0, (r_wins  - 0.7) / 0.3)

PR = 700 × n_dmg + 300 × n_frags + 150 × n_wins
```

没有期望值的舰船会被整艘跳过；所有指标恰好达到期望值时 PR = 1150。没有有效场次、分母为零或结果非有限数时返回 `null`。

```ts
import { calculatePR, calculateBattlePR } from 'wows-number-api-sdk'

calculatePR(shipStats, expected)
calculateBattlePR({ shipId, damage, frags, win }, expected) // 单场
```

### 分段

```ts
import { prCategory, PR_BANDS, PR_CATEGORY_LABELS } from 'wows-number-api-sdk'

prCategory(1600) // 'very-good'
```

| 分段 | PR 下限 | 显示名 |
| --- | --- | --- |
| `bad` | — | Bad |
| `below-average` | 750 | Below Average |
| `average` | 1100 | Average |
| `good` | 1350 | Good |
| `very-good` | 1550 | Very Good |
| `great` | 1750 | Great |
| `unicum` | 2100 | Unicum |
| `super-unicum` | 2450 | Super Unicum |

胜率分段按百分数：`47 / 50 / 52 / 54 / 56 / 60 / 65`，使用 `winRateCategory(rate)`。

### 配色

```ts
import { categoryColor, chipBackground, withAlpha } from 'wows-number-api-sdk'

categoryColor('unicum') // { primary: '#D042F3', darkText: '#D878EC', lightText: '#802B94' }
chipBackground('great') // 'rgba(2, 201, 179, 0.18)'
withAlpha('#FF0000', 46)
```

每个分段提供 `primary`、`darkText`、`lightText` 三个颜色。`CHIP_TINT_ALPHA = 46`（约 18%）。

## 玩家页链接

```ts
import { playerUrl } from 'wows-number-api-sdk'

playerUrl({ realm: 'na', accountId: 1_003_924_023, name: 'G4ngB4r3ng' })
// https://na.wows-numbers.com/player/1003924023,G4ngB4r3ng
```

- 账号与昵称用英文逗号分隔，无尾斜杠。
- realm 会转为小写；昵称会 `encodeURIComponent`。
- 已确认的区服子域名是 `eu`、`na`、`asia`；`ru` / `cn` 未验证，类型上仍允许传入自定义字符串。

## 错误处理

```ts
import {
  ExpectedValuesValidationError,
  WowsNumbersHttpError,
  WowsNumbersNetworkError,
  WowsNumbersParseError,
} from 'wows-number-api-sdk'
```

- `WowsNumbersHttpError`：非 2xx。
- `WowsNumbersNetworkError`：网络错误、超时或中止。
- `WowsNumbersParseError`：响应不是 JSON（包括 200 返回 HTML 的情况）。
- `ExpectedValuesValidationError`：JSON 结构不符合 expected values 文档；`reason` 为 `invalid-document` / `invalid-ship-entry` / `no-ships`。

## 已知限制

- wows-numbers 没有公开玩家数据 API，本包只提供 expected values 与 PR 计算。
- 不自动重试；429/5xx 策略由调用方决定。
- 未做并发请求去重，多个 `get()` 同时触发刷新时可能发出多个请求。
- expected values 的 schema 没有版本号，只能靠运行时校验兜底。
- `time` 字段不参与过期判断，缓存以本地写入时间为准。
- RU / CN 区服的站点可用性未确认。
- 浏览器直连 `api.wows-numbers.com` 的 CORS 行为未验证。

## 开发

在仓库根目录执行：

```bash
pnpm install
pnpm --filter wows-number-api-sdk typecheck
pnpm --filter wows-number-api-sdk test
pnpm --filter wows-number-api-sdk build
```

## 许可

MIT
