# AGENTS.md — wows-number-api-sdk

适用于 `packages/wows-number-api-sdk`。仓库级约定见根 `AGENTS.md`，此处只记录本包特有的结构与约束。

## 包职责

wows-numbers 的 TypeScript SDK，运行时零依赖，ESM-only。提供 expected values 的获取、校验与缓存，以及纯函数的 PR 计算、分段、配色和玩家页链接。

| 入口 | 源文件 | 用途 |
| --- | --- | --- |
| `wows-number-api-sdk` | `src/index.ts` | 浏览器与通用环境 |
| `wows-number-api-sdk/node` | `src/node.ts` | Node 文件缓存 `FileStorage` |

`src/node.ts` 依赖 `node:crypto`、`node:fs/promises`、`node:path`，不能从 `src/index.ts` 或其他浏览器入口导入。

## 源码结构

- `src/cache.ts`：`CacheStorage`、`MemoryStorage`、`createWebStorage`。
- `src/expected-values.ts`：URL、`parseExpectedValues`、`ExpectedValuesClient`、`DEFAULT_CACHE_TTL`、`DEFAULT_CACHE_KEY`。
- `src/rating.ts`：`calculatePR`、`calculateBattlePR`、`normalizePrRatio`、`PR_NORMALIZATION`、`PR_BANDS`、`WIN_RATE_BANDS`、`prCategory`、`winRateCategory`。
- `src/colors.ts`：`CATEGORY_COLORS`、`categoryColor`、`chipBackground`、`withAlpha`。
- `src/url.ts`：`playerUrl` 与 `WOWS_NUMBERS_REALMS`。
- `src/errors.ts`：HTTP、网络、解析与校验错误。
- `src/types.ts`：expected values、舰船统计、PR 分段、`PrComponents` 等公共类型。

## 数据与计算不变量

- `win_rate` 是百分数（`49.91`），不是 `0.4991`；比较和配色都按百分数处理。
- PR 公式：伤害、击杀、胜率三项按 `700 / 300 / 150` 加权；所有指标恰好达到期望值时 PR = 1150。
- `calculatePR` / `calculateBattlePR` 同时返回 `components`（actual、expected、ratio、normalized），上层等级计算复用这些分量，不复制归一化常量。
- `PR_NORMALIZATION` 与 `normalizePrRatio` 是 `0.4 / 0.1 / 0.7` 的唯一来源；compute 不得重新写死。
- 没有期望值的舰船整艘跳过；没有有效场次、分母为零或结果非有限数时返回 `null`。
- 分段阈值以 `PR_BANDS`（750/1100/1350/1550/1750/2100/2450）和 `WIN_RATE_BANDS`（47/50/52/54/56/60/65）为准，修改时同步 README 表格。
- 分段使用 `value >= floor`：`PR = 750` 属于 `below-average`，不是 `bad`。
- `parseExpectedValues` 拒绝 HTML、截断 JSON、缺失字段和没有任何有效舰船的数据；未知字段会被丢弃。
- 无效响应不得写入缓存；刷新失败时保留过期缓存，只有完全没有可用缓存才抛错。
- 缓存默认 TTL 为 7 天（`DEFAULT_CACHE_TTL`），`time` 字段不参与过期判断。

## 测试

- `tests/rating.test.ts`：公式、components、归一化、边界、阈值与 `null` 语义。
- `tests/expected-values.test.ts`：校验、缓存、刷新失败与时钟注入。
- `tests/url-colors.test.ts`：玩家页 URL 与配色。
- `tests/node.test.ts`：`FileStorage` 使用临时目录，键名会做安全化处理。
- 通过 `fetch`、`now`、`cache` 选项注入依赖，不访问真实网络。

```bash
pnpm --filter wows-number-api-sdk typecheck
pnpm --filter wows-number-api-sdk test
pnpm --filter wows-number-api-sdk test tests/rating.test.ts
pnpm --filter wows-number-api-sdk build
```

## 变更检查

- 公式、分段阈值、缓存默认值的改动属于行为变更：同时更新实现、测试和 README。
- 新增公共导出需经过 `src/index.ts`（Node 专有内容走 `src/node.ts`），并同步 README。
- 保持运行时零依赖；不要引入日期、缓存或 HTTP 工具库。
- `files` 只发布 `dist`，新增入口时同步 `package.json` `exports` 与 `tsdown.config.ts` `entry`。
