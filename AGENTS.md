# AGENTS.md

## 项目概览

Wows DevKit 是《战舰世界》数据服务的 TypeScript SDK 集合，使用 pnpm workspace 管理，包含三个可发布包：

| 包目录 | npm 包名 | 职责 |
| --- | --- | --- |
| `packages/wows-api-sdk` | `wows-api-sdk` | 官方 API、Vortex、公会服务客户端 |
| `packages/wows-number-api-sdk` | `wows-number-api-sdk` | wows-numbers 期望值、PR 计算、配色与玩家页链接 |
| `packages/wows-replay-parser` | `wows-replay-parser` | Replay 元数据与对局结果解析 |

三个包都是 ESM-only、Node.js 22.18+；除 `wows-replay-parser` 使用 `egoroof-blowfish` 外，运行时零依赖。构建产物输出到各自的 `dist/`。

技术栈：TypeScript 7（strict）、tsdown（打包与 `.d.mts` 生成）、Vitest 5、pnpm 12.14.0。

## 目录结构

```text
packages/
  wows-api-sdk/
    src/core/             # HttpClient、错误类型、区服主机
    src/official/         # 28 个经典 API、响应类型（含生成类型）
    src/vortex/           # Vortex 客户端与手写类型
    src/clans/            # 公会服务客户端与手写类型
    scripts/              # generate-types.mjs
    tests/
  wows-number-api-sdk/
    src/                  # expected values、缓存、PR、分段、配色、URL
    src/node.ts           # FileStorage（仅 Node 入口）
    tests/
  wows-replay-parser/
    src/                  # 容器、Blowfish、包头、结果解析
    src/node.ts           # 文件读取与 node:zlib（仅 Node 入口）
    src/extract/          # scripts.zip、Python marshal、pyc 解密与映射提取
    constants/            # 精简字段映射，仅 latest 进入 npm 包
    tests/
.github/workflows/ci.yml
tsconfig.base.json
pnpm-workspace.yaml
```

## 环境与安装

- Node.js 22.18+，pnpm 12.14.0（`packageManager` 已固定，可用 corepack）。
- 在仓库根目录执行一次 `pnpm install`。
- 只有根 `pnpm-lock.yaml`；不要在包目录生成新的 lockfile。
- `pnpm-workspace.yaml` 只包含 `packages/*`；本地研究、工具和参考目录不是 workspace 成员。

## 常用命令

所有命令在仓库根目录执行。

| 目的 | 命令 |
| --- | --- |
| 全量类型检查 | `pnpm typecheck` |
| 全量测试 | `pnpm test` |
| 全量构建 | `pnpm build` |
| 检查发布包内容 | `pnpm pack:check` |
| 单包脚本 | `pnpm --filter wows-api-sdk <script>` |
| 单个测试文件 | `pnpm --filter wows-api-sdk test tests/index.test.ts` |
| 监听构建 | `pnpm --filter wows-api-sdk dev` |

提交前至少通过 `pnpm typecheck` 和 `pnpm test`。改动入口、`exports`、`files` 或构建配置后，再执行 `pnpm build` 和 `pnpm pack:check`。

## 开发工作流

1. 修改 `src/`，并在 `tests/` 增加或调整用例。
2. 运行 `pnpm typecheck`，再运行 `pnpm test`。
3. 涉及产物或包内容时运行 `pnpm build`、`pnpm pack:check`。
4. `pack:check` 的包内容应只包含 `dist/`、`README.md`、`package.json`、`LICENSE`。

TypeScript 配置继承 `tsconfig.base.json`，每个包的 `include` 为 `["src", "tests"]`。关键约束：`strict`、`noUnusedLocals`、`verbatimModuleSyntax`、`isolatedModules`、`moduleResolution: bundler`。

- 相对导入统一带 `.js` 后缀（源码是 `.ts`，这是 ESM 产物的要求）。
- 仅类型导入使用 `import type`，仅类型导出使用 `export type`。
- 新增子入口必须同时更新 `package.json` 的 `exports` 和 `tsdown.config.ts` 的 `entry`。

## 测试

- 使用 Vitest，测试文件位于 `packages/*/tests/*.test.ts`，按被测模块命名（如 `rating.test.ts`、`vortex.test.ts`）。
- 测试不得访问真实网络：通过 `fetch` 选项注入 `vi.fn()`，自行构造 `Response`。
- 覆盖 URL 与参数拼接、错误映射、边界值和空值语义，而不只是正常路径。
- 当前基线：`wows-api-sdk` 60 个测试，`wows-number-api-sdk` 30 个测试，`wows-replay-parser` 34 个测试，共 124 个。

## 代码风格

仓库未配置 ESLint、Prettier 或 Biome，保持与现有代码一致：

- 2 空格缩进、单引号、无分号、多行尾逗号。
- 标识符和代码注释用英文；面向使用者的 README 与文档用中文。
- 公共 API 通过包入口导出；不要从 `dist/` 反向导入源码。
- `src/official/types/generated/*` 是生成文件，禁止手改。需要调整时修改 `scripts/generate-types.mjs` 后重新生成。

## 提交与版本

- 提交信息使用 Conventional Commits，格式为 `<type>(<scope>): <subject>`。
- scope 使用包名或 `repo` / `release` / `deps`；破坏性变更加 `!` 和 `BREAKING CHANGE:` footer。
- PR 标题遵守同一格式，合并使用 squash，保持 `main` 线性历史。
- 版本由 Changesets 管理：变更 PR 必须包含 `.changeset/*.md`，不要在 PR 中手工改版本号或 `CHANGELOG.md`。
- 三个包独立版本；tag 使用 `包名@版本`，例如 `wows-replay-parser@1.0.1`。
- 详细规范见 `CONTRIBUTING.md`。

## CI

`.github/workflows/ci.yml` 在 push 到 `main` 和 pull request 时运行，矩阵为 Node 22/24：

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

改动依赖时必须提交更新后的根 `pnpm-lock.yaml`，否则 frozen-lockfile 安装会失败。

## 发布

- 三个包版本独立，当前均为 `1.0.0`。
- `pnpm changeset` 记录变更；`pnpm version-packages` 更新版本号和 `CHANGELOG.md`；`pnpm release` 构建并发布未发布的包。
- `.github/workflows/release.yml` 在 `main` 上由 Changesets Action 创建 version PR，合并后执行 `changeset publish`，按包创建 tag 和 GitHub Release。
- npm 使用 Trusted Publishing（OIDC）；首次发布新包可在本地用 npm 登录态完成。
- 发布前确认 `pnpm typecheck`、`pnpm test`、`pnpm build` 与 `pnpm pack:check` 通过。
- 包名保持 `wows-api-sdk` / `wows-number-api-sdk` / `wows-replay-parser`，不要擅自添加 npm scope 或改名。

## 安全与仓库卫生

- 绝不提交真实 `application_id`、access token 或测试账号数据；示例统一使用 `process.env.WG_APPLICATION_ID`、`process.env.WG_AC` 等占位。
- 错误信息中的 URL 由 `redactUrl` 脱敏；新增 HTTP 请求路径时继续复用，避免泄漏凭据。
- 不提交 `dist/`、`node_modules/`、`*.tgz`、`.env*`。
- 提交前检查 `git status --short`，确认没有私有目录或凭据文件进入暂存区。

## 已知领域约束

- 官方 API 不支持国服：`WowsApiClient` 拒绝 `cn`；Vortex 与 Clans 支持 `ru/eu/na/asia/cn`。
- 404 语义不统一：Vortex 将 404 转为 `null`；Clans 的 `claninfo` 对不存在的公会返回 HTTP 200 空壳，调用方需检查 `clanview.clan.id`。
- wows-numbers 的 `win_rate` 是百分数（如 `49.91`），不是小数。
- `generate:types` 默认读取本地 API 文档快照，该快照不在公开仓库中；可用 `WG_API_DOC_PATH` 指向本地副本。缺少快照时不要伪造生成结果。

## 包级说明

- `packages/wows-api-sdk/AGENTS.md`
- `packages/wows-number-api-sdk/AGENTS.md`
- `packages/wows-replay-parser/AGENTS.md`

包级文件中的约定优先于本文件。
