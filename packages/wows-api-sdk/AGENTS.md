# AGENTS.md — wows-api-sdk

适用于 `packages/wows-api-sdk`。仓库级约定见根 `AGENTS.md`，此处只记录本包特有的结构与约束。

## 包职责

《战舰世界》官方数据服务的 TypeScript 客户端，运行时零依赖，ESM-only。一个包提供四个入口：

| 入口 | 源文件 | 客户端 | 数据源 |
| --- | --- | --- | --- |
| `wows-api-sdk` | `src/index.ts` | 全部 | 统一导出 |
| `wows-api-sdk/official` | `src/official.ts` | `WowsApiClient` | `api.worldofwarships.*` |
| `wows-api-sdk/vortex` | `src/vortex.ts` | `VortexClient` | `vortex.*` |
| `wows-api-sdk/clans` | `src/clans.ts` | `ClansClient` | `clans.*` |

`package.json` 的 `exports` 与 `tsdown.config.ts` 的 `entry` 必须同步修改。

## 源码结构

- `src/core/`：`HttpClient`、错误类型、`REALM_ENDPOINTS` 主机表、`redactUrl`。
- `src/official/`：`WowsApiClient` 与按领域拆分的 endpoints（account、clans、encyclopedia、seasons、ships）。
- `src/official/types/api.ts`：根级响应容器类型（数组、按 ID 索引的对象）在此声明，不依赖文档推断。
- `src/official/types/generated/`：由脚本生成的响应接口，禁止手改。
- `src/vortex/`、`src/clans/`：客户端与手写类型；未确认字段保持可选。
- `src/index.ts`：`export *` 汇总所有入口。

## 类型生成

- 生成器：`scripts/generate-types.mjs`，读取清理后的 API 文档快照，按响应字段的点号路径构建嵌套接口。
- 默认读取本地 API 文档快照，该快照不在公开仓库中。使用本地副本时：

```bash
WG_API_DOC_PATH=/path/to/api.json pnpm --filter wows-api-sdk generate:types
```

- `arrayContainers` / `recordContainers` / `associativeOverrides` 是人工白名单，用于区分“数组容器”“按 ID 索引的对象”和文档未描述的关联数组。上游结构变化时修改白名单或生成器，不要直接编辑生成文件。
- 重新生成后运行 `pnpm --filter wows-api-sdk typecheck` 与 `pnpm --filter wows-api-sdk test`，并检查 diff 是否只包含预期的结构变化。

## 测试

- `tests/index.test.ts`：官方 API 的 URL、参数序列化、语言覆盖、错误映射。
- `tests/vortex.test.ts`：Vortex 请求路径、404 → `null`、token 处理。
- `tests/clans.test.ts`：公会接口与 200 空壳语义。
- `tests/types.test.ts`：根级容器类型与 `unwrap` 等类型行为。
- 全部通过注入 `fetch` 模拟响应，不访问真实 API。

```bash
pnpm --filter wows-api-sdk typecheck
pnpm --filter wows-api-sdk test
pnpm --filter wows-api-sdk test tests/vortex.test.ts
pnpm --filter wows-api-sdk build
```

## 领域约定

- 官方 API 拒绝 `cn` 区服；Vortex 与 Clans 支持全部五个区服。
- 官方 API 的 API 级错误常以 HTTP 200 返回，用 `WowsApiError` 表示；非 2xx 用 `WowsHttpError`。
- Vortex 的 404 表示“无数据”，SDK 转为 `null`；`status !== "ok"` 用 `VortexError`。
- `clans` 的 `claninfo` 对不存在的公会返回 HTTP 200 空壳，不能只依赖 `null` 判断。
- `ships/stats` 的 `in_garage` 在 SDK 层接受 `boolean | 0 | 1`，发送前转换为 `"1"` / `"0"`。
- `account/info` 的 `extra` 只接受文档列出的具体路径；新增值需同步 `AccountExtra` 联合类型。
- 错误对象中的 `application_id` 与 `ac` 已脱敏；新增请求路径时复用 `redactUrl`。

## 变更检查

- 新增接口：实现 endpoint、补充响应类型、更新 README 接口表、添加测试。
- 新增子入口：同步 `package.json` `exports`、`tsdown.config.ts` `entry`、README 与根 README。
- 保持运行时零依赖；不要为单个接口引入 HTTP 客户端或工具库。
- `files` 只发布 `dist`，不要依赖包内其他运行时文件。
