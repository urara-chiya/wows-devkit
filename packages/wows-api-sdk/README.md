# wows-api-sdk

《战舰世界》官方数据服务的 TypeScript SDK，运行时零依赖。一个包内提供三个子入口，分别对应 Wargaming 的三套主机：

| 子入口 | 客户端 | 数据源 | 鉴权 |
| --- | --- | --- | --- |
| `wows-api-sdk/official` | `WowsApiClient` | `api.worldofwarships.*`（经典 API，28 个接口） | `application_id` 必填 |
| `wows-api-sdk/vortex` | `VortexClient` | `vortex.worldofwarships.*` / `vortex.korabli.su` / `vortex.wowsgame.cn` | 可选 `ac` access token |
| `wows-api-sdk/clans` | `ClansClient` | `clans.worldofwarships.*` / `clans.korabli.su` / `clans.wowsgame.cn` | 无 |

根入口 `wows-api-sdk` 同时导出三者，按需引入子入口可获得更小的类型与产物。

> 这是非官方 SDK。使用前请在 [Wargaming Developer Room](https://developers.wargaming.net/) 申请 `application_id`，并遵守上游的使用条款与速率限制。

## 安装

```bash
npm install wows-api-sdk
```

要求 Node.js 22.18+（依赖全局 `fetch`），也可以传入自定义 `fetch`。浏览器环境需确认上游 CORS 策略。

## 快速开始

### 经典 API

```ts
import { WowsApiClient, unwrap } from 'wows-api-sdk/official'

const client = new WowsApiClient({
  applicationId: process.env.WG_APPLICATION_ID!,
  realm: 'asia',
  language: 'zh-cn',
})

const players = unwrap(await client.account.info({ account_id: [1001, 1002] }))
```

### Vortex

```ts
import { VortexClient } from 'wows-api-sdk/vortex'

const vortex = new VortexClient({ realm: 'eu', accessToken: process.env.WG_AC })

const accounts = await vortex.accounts.info(1001)
const account = accounts?.['1001']
const ships = await vortex.ships.stats(1001, 'pvp_solo')
const achievements = await vortex.accounts.achievements(1001)
const allShips = await vortex.ships.all(1001)
```

Vortex 对不存在的账号返回 **HTTP 404**，SDK 将其转换为 `null`，而不是抛错：

```ts
const account = await vortex.accounts.info(999)
if (account === null) {
  // 账号不存在，或该区服没有此账号
}
```

### 公会服务

```ts
import { ClansClient } from 'wows-api-sdk/clans'

const clans = new ClansClient({ realm: 'na' })

const info = await clans.info(123456)
const members = await clans.members(123456)
const found = await clans.search('-TAG')
const ladder = await clans.ladder({ league: 1, division: 2 })
```

## 区服与主机

| Realm | Official | Vortex | Clans | Ladder realm |
| --- | --- | --- | --- | --- |
| `ru` | `https://api.worldofwarships.ru` | `https://vortex.korabli.su` | `https://clans.korabli.su` | `ru` |
| `eu` | `https://api.worldofwarships.eu` | `https://vortex.worldofwarships.eu` | `https://clans.worldofwarships.eu` | `eu` |
| `na` | `https://api.worldofwarships.com` | `https://vortex.worldofwarships.com` | `https://clans.worldofwarships.com` | `us` |
| `asia` | `https://api.worldofwarships.asia` | `https://vortex.worldofwarships.asia` | `https://clans.worldofwarships.asia` | `sg` |
| `cn` | 无 | `https://vortex.wowsgame.cn` | `https://clans.wowsgame.cn` | `cn360` |

- `WowsApiClient` 拒绝 `cn`（官方 API 不覆盖国服）。
- `VortexClient` 与 `ClansClient` 支持全部五个区服。
- 三个客户端都接受 `baseUrl` 覆盖，用于反向代理或镜像。

## 客户端配置

### `WowsApiClient`

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `applicationId` | `string` | 必填 | Wargaming 应用 ID |
| `realm` | `'eu' \| 'na' \| 'asia' \| 'ru'` | `'eu'` | 默认区服 |
| `language` | `LanguageCode` | 无 | 默认本地化语言，可被单次请求覆盖 |
| `baseUrl` | `string` | 对应区服域名 | API 源站，也可传以 `/wows` 结尾的地址 |
| `fetch` | `typeof fetch` | `globalThis.fetch` | 自定义 fetch 实现 |
| `timeout` | `number` | 无 | 请求超时（毫秒） |

### `VortexClient`

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `realm` | `WowsRealm` | `'eu'` | 默认区服 |
| `baseUrl` | `string` | 对应区服 Vortex 主机 | 可指向镜像 |
| `accessToken` | `string` | 无 | 作为 `?ac=` 附加到账号与船只请求 |
| `fetch` / `timeout` | 同上 | — | — |

单次请求可用 `{ accessToken }` 覆盖；传 `null` 表示本次不带 token。

### `ClansClient`

`realm`、`baseUrl`、`fetch`、`timeout`。`ladder()` 的 `realm` 参数可单独覆盖，用于跨区查询。

## 接口

### Official

<details>
<summary>28 个经典 API 接口</summary>

#### Account

| 方法 | API 路径 | 主要参数 |
| --- | --- | --- |
| `client.account.list` | `account/list` | `search`（必填）、`type`、`limit` |
| `client.account.info` | `account/info` | `account_id`（必填）、`access_token`、`extra` |
| `client.account.achievements` | `account/achievements` | `account_id`（必填）、`access_token` |

#### Clans

| 方法 | API 路径 |
| --- | --- |
| `client.clans.list` | `clans/list` |
| `client.clans.info` | `clans/info` |
| `client.clans.accountInfo` | `clans/accountinfo` |
| `client.clans.glossary` | `clans/glossary` |
| `client.clans.season` | `clans/season` |
| `client.clans.seasonStats` | `clans/seasonstats` |

#### Encyclopedia

`client.encyclopedia` 提供 `ships`、`shipProfile`、`modules`、`consumables`、`crews`、`crewSkills`、`crewRanks`、`achievements`、`battleArenas`、`battleTypes`、`collections`、`collectionCards`、`accountLevels`、`info`。

#### Seasons

`client.seasons` 提供 `info`、`accountInfo`、`shipStats`。

#### Ships

`client.ships` 提供 `stats`、`badges`。

</details>

所有官方 API 方法返回 `{ status: 'ok', meta, data }`，`unwrap(response)` 可直接取 `data`。

响应容器：

| 接口 | `data` 结构 |
| --- | --- |
| `account/list` | `AccountListEntry[]` |
| `account/info` | `Record<accountId, AccountInfo \| null>` |
| `ships/stats` | `Record<accountId, ShipStats[]>` |
| `ships/badges` | `Record<accountId, ShipBadge[]>` |
| `encyclopedia/*` | 按实体 ID 索引的对象 |
| `encyclopedia/crewranks` | `Record<nation, CrewRank[]>` |
| `encyclopedia/achievements` | `{ battle: Record<achievementId, Achievement> }` |
| `clans/list` | `ClanListEntry[]` |
| `clans/info` | `Record<clanId, ClanInfo>`；`extra=members` 时 `members` 为按账号 ID 索引的对象 |
| `clans/glossary` | 对象，`building_types` / `buildings` 为按 ID 索引的对象 |
| `clans/season` | `Record<seasonId, ClanSeason>`，其中 `leagues` 是数组 |
| `clans/seasonstats` | `Record<accountId, { account_id, seasons: SeasonStats[] }>` |
| `seasons/info` | `Record<seasonId, RankedSeason>`，其中 `leagues` / `ranks` 为按 ID 索引的对象 |
| `seasons/accountinfo` | `Record<accountId, SeasonAccountInfo \| null>` |
| `seasons/shipstats` | `Record<accountId, SeasonShipStats[]>` |

补充语义：

- `ships/stats` 的 `in_garage` 只接受 `"1"` / `"0"`；SDK 接受 `boolean | 0 | 1` 并自动转换。
- `account/info` 的 `extra` 只接受文档列出的具体路径（如 `statistics.pvp_solo`），`statistics` 和 `statistics.pvp` 都会返回 `407 INVALID_EXTRA`。SDK 用 `AccountExtra` 联合类型约束。
- 不存在的账号通常不是错误：`data` 中对应键为 `null`。
- 官方 API 的 API 级错误仍以 HTTP 200 返回，由 `WowsApiError` 表示。

### Vortex

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `client.accounts.info(id, options?)` | `/api/accounts/{id}/` | 账号档案 + 各模式累计统计 |
| `client.accounts.clan(id, options?)` | `/api/accounts/{id}/clans/` | 当前公会（无公会时 `clan_id` 为 `null`） |
| `client.accounts.achievements(id, options?)` | `/api/accounts/{id}/achievements/` | 成就进度，按成就 ID 索引 |
| `client.accounts.search(name, options?)` | `/api/accounts/search/{name}/` | 昵称搜索，名称会 URL 编码 |
| `client.ships.all(id, options?)` | `/api/accounts/{id}/ships/` | 所有船只、所有模式一次返回 |
| `client.ships.stats(id, mode, options?)` | `/api/accounts/{id}/ships/{mode}/` | 单模式每船统计 |
| `client.ships.pve/pvp/pvpSolo/pvpDiv2/pvpDiv3/rankSolo/ratingSolo/ratingDiv` | 同上 | 模式快捷方法 |

`mode` 取值：`pve`、`pvp`、`pvp_solo`、`pvp_div2`、`pvp_div3`、`rank_solo`、`rank_div2`、`rank_div3`、`rank_old_solo`、`rank_old_div2`、`rank_old_div3`、`clan`、`club`、`rating_solo`、`rating_div`。`rating_solo` / `rating_div` 仅在部分区服可用；不可用时返回 HTTP 404，SDK 将其转换为 `null`。

响应结构示例：

```ts
// /ships/{mode}/
type VortexShipStatsData = Record<
  string, // account id
  {
    name?: string
    created_at?: number
    statistics?: Record<
      string, // ship id
      {
        mastery_sign?: string | null
        mark_of_excellence?: { personal?: object; division?: object }
        pvp_solo?: VortexShipStats
      }
    >
  }
>

// /accounts/{id}/achievements/
type VortexAchievementsData = Record<
  string, // account id
  {
    name: string
    created_at: number
    statistics?: {
      achievements?: Record<string, { count: number; last_time?: number; ship_id?: number }>
    }
  }
>
```

### Clans

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `client.info(clanId)` | `/api/clanbase/{id}/claninfo/` | 公会详情 + 公会战数据，返回 `{ _meta_, clanview }` |
| `client.members(clanId)` | `/api/members/{id}/` | `{ status, clan_statistics, items, ... }` |
| `client.search(tag)` | `/api/search/autocomplete/?search=&type=clans` | `{ _meta_, search_autocomplete_result }` |
| `client.ladder({ league?, division?, limit?, realm? })` | `/api/ladder/structure/` | 公会战排行榜（裸数组） |

`clanbase/{id}/claninfo/` 对不存在的公会仍返回 **HTTP 200**，`clanview.clan` 为空对象、`clanview.wows_ladder` 仍在；SDK 只在 HTTP 404 时返回 `null`，调用方需自行检查 `clanview.clan.id`。`members()` 与 `search()` 返回包装对象，而不是裸数组。

## 错误处理

```ts
import {
  WowsApiError,
  WowsHttpError,
  WowsNetworkError,
  WowsParseError,
} from 'wows-api-sdk'

import { VortexError } from 'wows-api-sdk/vortex'

try {
  await client.account.list({ search: 'a' })
} catch (error) {
  if (error instanceof WowsApiError) {
    // 官方 API 返回 status: "error"（通常是 HTTP 200）
  } else if (error instanceof WowsHttpError) {
    // 非 2xx；Vortex/Clans 的 404 已转换为 null
  } else if (error instanceof WowsNetworkError) {
    // 网络、超时或中止
  } else if (error instanceof WowsParseError) {
    // 响应不是预期 JSON
  } else if (error instanceof VortexError) {
    // Vortex 返回 200 但 status !== "ok"
  }
}
```

错误对象中的 URL 会把 `application_id` 与 `ac` 替换为 `***`。

## 类型生成

官方 API 的响应类型位于 `src/official/types/generated/`，由 `scripts/generate-types.mjs` 根据 API 文档快照生成：

```bash
npm run generate:types
```

生成器可用 `WG_API_DOC_PATH` 指定文档快照路径。它按响应字段的点号路径构建嵌套接口，并用 `arrayContainers` / `recordContainers` 两个白名单区分“数组容器”和“按 ID 索引的对象”。文档未明确描述的关联数组使用 `Record<string, unknown>`。所有字段均为可选，因为 `fields` 参数可以裁剪响应。

根级容器（例如 `ships/stats` 的数组、`seasons/info` 的按赛季索引）在 `src/official/types/api.ts` 中单独声明，不依赖文档推断。

Vortex 与 Clans 的类型按上游接口结构手写，未确认字段保持可选并允许索引签名。

## 已知限制

- 三个服务都没有自动重试、速率限制或响应缓存；请按业务控制调用频率。高频请求可能触发官方 API 返回 `504 SOURCE_NOT_AVAILABLE`。
- Vortex 的 404 语义为“无数据”；`status !== "ok"` 的错误体结构未公开，`VortexError.body` 保留原始响应。
- Vortex 未暴露语言参数，SDK 不发送 `Accept-Language`。
- `rating_solo` / `rating_div` 只在部分区服可用；不可用时返回 HTTP 404（SDK 返回 `null`）。
- 官方 API 的 `fields` 上限为 100 个字段，且各接口允许的 `extra` 值不同；SDK 只对常用 `extra` 做了联合类型约束。
- 文档未描述的字段（例如 `private: null`、部分新版本统计字段）可能出现在响应中；生成类型保持字段可选，并允许按响应裁剪。
- `encyclopedia/collectioncards` 单次响应可达 1.4 MB 以上，服务器可能超过 30 秒仍未返回；建议使用 `fields` 裁剪字段。
- `clanbase/{id}/claninfo/` 对不存在的公会仍返回 HTTP 200 空壳，不能仅依赖 `null` 判断。

## 开发

在仓库根目录执行：

```bash
pnpm install
pnpm --filter wows-api-sdk typecheck
pnpm --filter wows-api-sdk test
pnpm --filter wows-api-sdk build
```

构建会输出 `index`、`official`、`vortex`、`clans` 四个入口。

## 许可

MIT
