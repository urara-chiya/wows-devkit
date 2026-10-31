# wows-compute

《战舰世界》对局数据的纯计算内核。无文件 IO、无网络、无运行时状态：输入是已经解析好的赛前名单或赛后回放结果，输出是可直接持久化或展示的 `MatchRecord`、评级与统计。

已提供：`./match`、评级、五项统计等级、时间、`./recent`、`./aggregate`、`./metrics`、`./strength`（含概览归纳）。

## 安装

```bash
pnpm add wows-compute wows-number-api-sdk
```

ESM-only，Node.js 22.18+。

## 入口

| 入口 | 内容 |
| --- | --- |
| `wows-compute` | PR / PR*、等级、近期统计、聚合、概览归纳、游戏日与周界 |
| `wows-compute/match` | `ArenaRoster`、`MatchRecord`、合并、赛前赛后关联、组队 |
| `wows-compute/metrics` | 字段字典与派生指标 |
| `wows-compute/strength` | 散点原料、概览归纳、参考线、角色配对 |

## 快速上手

```ts
import { fromReplay, groupDivisions } from 'wows-compute/match'

const record = fromReplay(parsedReplay)
// record.arenaId、record.outcome、record.quality、record.participants

const divisions = groupDivisions(record.participants)
```

`fromReplay` 接受 `wows-replay-parser` 的 `ParsedReplay` 结构，不依赖它的包，只有类型层面的结构兼容。

### 平局

事实层保留 `outcome: 'draw'`；统计层用 `statOutcome('draw')` 映射为 `loss`，即平局双输。`winnerTeamId` 为负数表示平局，`0` 是合法队伍。

### 时间

`battleTime` 优先取结果包的 `startDt`（UTC）。回放元数据的 `dateTime` 是录制者本机时间，跨区不可靠，只在没有结果包时作为回退。

### 评级

```ts
import { accountPrEstimated, accountPrPooled, levelOf, shipPr } from 'wows-compute'

const ship = shipPr(stats, expected)          // 精确，exact: true
const account = accountPrEstimated(totals, expected) // PR*，exact: false
const pooled = accountPrPooled(ships, expected, sample) // 精确加权，exact: true

levelOf('pr', 1200) // { levelKey: 'average', floor: 1100, ... }
```

`exact: false` 是产品承诺：调用方必须把它显示为 `PR*`，不能与精确 PR 不加区分地混排。偏差方向通过 `bias` 输出；没有 `shipMix` 时是 `unknown`，不猜。

PR 公式、预期值和分档阈值全部复用 `wows-number-api-sdk`，本包不复制常量。`RatedValue.components` 带有 PR 的 ratio / normalized 分量。

### 五项统计等级

`evaluateCoreStats` 统一计算胜率、场均伤害、场均击杀、PR、场均经验五项等级：

```ts
import { evaluateCoreStats, shipLevels, accountLevels } from 'wows-compute'

const levels = shipLevels(shipTotals, expected)
levels.damage?.band.key       // 'average'
levels.damage?.normalized     // nDmg
levels.damage?.ratioBand      // 同一档位在 ratio 空间的边界
levels.damage?.rawBand        // 同一档位换算回场均伤害后的边界
levels.damage?.band.deltaToNext // 到下一档的差值

const account = accountLevels(ships, expected, sample) // exact pooled
```

口径：

- 全局使用 `value >= floor`；`PR = 750`、`XP = 700` 都属于 `below-average`。
- 胜率、伤害、击杀使用 `nWins` / `nDmg` / `nFrags` 分档；PR、XP 使用绝对阈值。
- 归一化常量复用 `wows-number-api-sdk` 的 `normalizePrRatio`。
- XP 由调用方提供 `expTotal + battles`（可选 `expBattles`）；aggregate/recent 内部累计 `rawExp`，只有 `rawExp` 非空才计入 `expBattles`。
- 聚合默认 `displayed`：等级描述当前显示值，避免数字和颜色不一致。
- `aggregate*` / `recentMatches` 的输出直接带 `levels`；`strength` 本期不挂等级。

五组阈值：

| 指标 | 分档依据 | 下限 |
| --- | --- | --- |
| PR | 绝对 PR | 750 / 1100 / 1350 / 1550 / 1750 / 2100 / 2450 |
| XP | 绝对场均经验 | 700 / 900 / 1100 / 1400 / 1700 / 2100 / 2400 |
| 胜率 | `nWins` | 0.8 / 0.9 / 1.1 / 1.2 / 1.3 / 1.4 / 1.5 |
| 伤害 | `nDmg` | 0.7 / 0.9 / 1.1 / 1.3 / 1.5 / 1.7 / 1.9 |
| 击杀 | `nFrags` | 0.6 / 1.0 / 1.4 / 1.8 / 2.2 / 2.6 / 3.0 |

### 近期与聚合

```ts
import { aggregateTeam, recentMatches } from 'wows-compute'

const recent = recentMatches(records, { subject: { kind: 'self' }, last: 20 }, expected)
const team = aggregateTeam(records, teamId, {
  weighting: 'equal',          // 监控页：每个席位一票
  prAggregation: 'mean',
  expected,
})
```

- 近期只统计“已解析并入库”的对局，不扫描历史回放、不补缺口。
- `winRate` 是百分数，例如 `54.3`。
- 平局计入 `battles`，胜率为 `wins / battles`；`losses` 只计实际失败。
- 记录总览用 `weighting: 'battles'` + `prAggregation: 'pooled'`；监控页用 `equal` + `mean`。
- 分母为 0 返回 `null`；`coverage` 的 `resolved + hidden + bot + failed` 恒等于 `total`。
- `PlayerAggregate` / `TeamAggregate` / `ShipAggregate` / `RecentStats` / `DailyPoint` 带 `levels`；前四者还提供 `avgExp`，`RecentStats` 额外给出 `expTotal` 与 `expBattles`。

### 指标字典

```ts
import { METRICS, deriveMetrics } from 'wows-compute/metrics'

deriveMetrics(player.result.fields) // { damage, frags, potentialDamage, ... }
```

指标只做字段语义包装，不复制原始数据。新增字段必须能在回放字段映射中找到，测试会先失败。

### 对局强度原料

```ts
import { buildPlayerPoints, pairByRole, referenceLines } from 'wows-compute/strength'

const points = buildPlayerPoints(roster, ratings, catalog)
const reference = referenceLines(points)
const matchups = pairByRole(allyPoints, enemyPoints)
```

只输出散点原料、参考线和逐角色差值，不输出综合强度分或预测。

### 队伍概览

`summarizePlayers` / `summarizeRoster` 对已经标准化的 `PlayerPoint` 做加权归纳，输入不是对局记录：

```ts
import { buildPlayerPoints, summarizeRoster } from 'wows-compute/strength'

const points = buildPlayerPoints(roster, ratings, catalog)
const { ally, enemy, unassigned } = summarizeRoster(points)
// ally.players、ally.battles、ally.winRate / avgDamage / avgFrags / pr、ally.coverage
```

- 与 `aggregate*` 的分工：`aggregate*` 从逐局 `MatchRecord` 推导统计；overview 只归纳已算好的值，赛前赛后可复用。
- 默认 `weighting: 'equal'`（一人一票），可改为 `'battles'` 按生涯场次加权。
- 每项均值只使用非 null 值，`0` 是合法值，分母为 0 返回 `null`。
- `coverage` 的单位是席位：`total` 含 Bot，`players` 只算真人，且 `resolved + hidden + bot + failed === total`。
- 概览 PR 是对账号 PR 的均值，`prExact` 恒为 `false`，展示时必须标 `PR*`。

## 约束

- 不读写文件、不访问网络、不 import `node:*`。
- 不扫描历史回放、不推断缺失对局、不做存储假设。
- 只读已解析的数据；需要回放解析时使用 `wows-replay-parser`。

## License

MIT
