# AGENTS.md — wows-compute

适用于 `packages/wows-compute`。仓库级约定见根 `AGENTS.md`，此处只记录本包特有的结构与约束。

## 包职责

纯计算内核：输入已解析的赛前名单或赛后回放结果，输出 `MatchRecord`、评级与统计。不做文件 IO、网络、存储、UI，也不依赖运行时状态。

| 入口 | 源文件 | 内容 |
| --- | --- | --- |
| `wows-compute` | `src/index.ts` | rating、levels、recent、aggregate、overview、time |
| `wows-compute/match` | `src/match.ts` | 数据模型、fromReplay、合并、关联、组队 |
| `wows-compute/metrics` | `src/metrics.ts` | METRICS、deriveMetrics |
| `wows-compute/strength` | `src/strength.ts` | PlayerPoint、概览归纳、参考线、角色配对 |

新增入口时同步 `package.json` 的 `exports` 与 `tsdown.config.ts` 的 `entry`。

## 源码结构

- `src/match/`：`types.ts` 数据模型，`index.ts` 转换与合并。
- `src/rating/`：`shipPr`、`battlePr`、`accountPrEstimated`（PR*）、`accountPrPooled`。
- `src/levels/`：`levelOf`，只给 key 与阈值。
- `src/time/`：`parseBattleTime`、`gameDay`、`weekBoundary`、`inRange`。
- `src/recent/`：已入库对局的窗口统计。
- `src/aggregate/`：加权聚合、覆盖率、按日序列。
- `src/metrics/`：指标字典与派生。
- `src/strength/`：散点原料、概览归纳（`PlayerPoint` 聚合）与角色配对。

## 依赖与边界

- 运行时只依赖 `wows-number-api-sdk`。PR 公式、预期值、分档常量一律复用，不复制。
- `wows-replay-parser` 只是 devDependency，用于类型兼容测试与指标字段存在性测试；不要把它变成运行时依赖。
- `src/` 与构建产物不得出现 `node:*`、`fetch`、`fs`、`electron`。`vitest.config.ts` 属于测试配置，可以使用 `node:url`。
- `tsconfig.json` 用 `paths` 指向两个 SDK 的源码，保证全新 clone 在 `pnpm build` 之前也能通过 `typecheck`；`vitest.config.ts` 用 alias 让测试在 SDK 未构建时也能运行。
- `tsconfig.build.json` 清掉 `paths`，只供 `tsdown` 生成声明。若保留源码路径，dts 会把 SDK 的 `.d.ts` 写到它们的 `src/` 旁边。构建前需要 `wows-number-api-sdk` 已有 `dist`（根目录 `pnpm build` 会按依赖顺序先构建它）。
- `tsdown.config.ts` 通过 `deps.neverBundle` 把 number-sdk 保留为外部依赖，不要打进 bundle。

## 口径不变量

- 平局：事实层 `outcome: 'draw'`，统计层 `statOutcome` 返回 `loss`。`winnerTeamId < 0` 是平局；`0` 是合法队伍。
- `battleTime` 优先 `common.startDt`；`meta.dateTime` 是录制者本机时间，只作回退。
- 赛前名单与赛后记录按 `mapId` + 120 秒容差关联，候选必须唯一，否则返回 `null`。
- 组队按 `teamId + prebattle_id`，`prebattle_id > 0` 且至少 2 人。
- 自己：赛前 `relation === 0`；赛后按 `meta.playerName` 唯一匹配，`playerID` 常为 `0`，不可依赖。
- `exact: false` 只用于 PR*；UI 必须标 `PR*`。
- 分母为 0 返回 `null`，不返回 0。
- 胜率一律是百分数（`wins / battles * 100`），与 `WIN_RATE_BANDS` 一致；平局计入 `battles`。
- `coverage.resolved + hidden + bot + failed = total` 是硬不变量，所有聚合输出都要满足。
- `aggregate` 的 coverage 单位是人次，overview（`summarizePlayers`）的 coverage 单位是席位；不要混用两者的分母语义。
- 近期只统计已入库且 `result !== null` 的对局；`drawPolicy: 'exclude'` 会同时从 `matches` 和样本中移除平局。
- 指标字典的每个 `source` 字段必须存在于 `LATEST_MAPPING.publicResultIndices`；测试 `tests/metrics.test.ts` 守住这一点。
- 角色契约：`cruiser` 是兜底，`cruiser-functional` / `cruiser-firepower` 是子角色；无法判定时用 `cruiser` 或 `unknown`，不内置角色数据表。
- 强度只输出原料（散点、参考线、角色差值），不输出综合分或预测。

## 测试

- `tests/match.test.ts`：胜负/平局、稳定键、fromReplay、组队、合并、赛前关联。
- `tests/rating.test.ts`：与 SDK 公式逐值一致、PR* 偏差方向、分档边界。
- `tests/time.test.ts`：时区解析、游戏日边界、周界。
- `tests/recent.test.ts`：窗口、平局策略、日期边界、同场他人。
- `tests/aggregate.test.ts`：权重差异、PR mean/pooled、覆盖率守恒、按日序列。
- `tests/metrics.test.ts`：字段存在性、sum/ratio、缺失值语义。
- `tests/strength.test.ts`：散点、参考线、象限、角色配对、概览归纳与覆盖率。
- `tests/compat.test.ts`：`ParsedReplay` 结构兼容。
- 不访问网络；真实回放验证放在 `private/research/replay-spike`，不进入包。

```bash
pnpm --filter wows-compute typecheck
pnpm --filter wows-compute test
pnpm --filter wows-compute build
```

## 变更检查

- 改数据模型或口径时同步 `private/docs/wows-compute-design.md` 与 README。
- 新增公共导出时同步 `src/index.ts`、`src/match.ts`、`src/metrics.ts` 或 `src/strength.ts`，以及 `package.json` 的 `exports`、`tsdown.config.ts` 的 `entry` 与 README。
- 修改时间、平局、组队、PR 口径时必须补测试。
