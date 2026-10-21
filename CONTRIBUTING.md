# Contributing

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```text
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### type

| type | 用途 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修复 |
| `perf` | 性能优化 |
| `refactor` | 不改变行为的重构 |
| `docs` | 文档 |
| `test` | 测试 |
| `build` | 构建或依赖调整 |
| `ci` | CI/CD |
| `chore` | 杂项 |
| `revert` | 回滚 |

### scope

| scope | 范围 |
| --- | --- |
| `wows-api-sdk` | 官方 API、Vortex、Clans SDK |
| `wows-number-api-sdk` | wows-numbers 期望值与 PR |
| `wows-replay-parser` | Replay 与 scripts.zip 常量提取 |
| `repo` | 仓库级配置、文档、脚本 |
| `release` | 发布流程 |
| `deps` | 依赖更新 |

示例：

```text
feat(wows-replay-parser): add scripts.zip constants extractor
fix(wows-api-sdk): preserve 404 semantics in Vortex client
docs(repo): document release flow
ci(release): publish packages with provenance
chore(deps): update egoroof-blowfish
```

### 约定

- subject 使用祈使句，不超过 72 字符，不加句号。
- body 说明“为什么”，不要重复 diff。
- 破坏性变更使用 `!` 和 footer：

```text
feat(wows-api-sdk)!: require Node 22.18

BREAKING CHANGE: Node 20 is no longer supported.
```

- PR 标题遵守同一格式；合并使用 squash，保持 `main` 线性历史。
- 分支名使用 `feat/<scope>-<slug>` 或 `fix/<scope>-<slug>`。

## 版本与发布

三个包独立版本，使用 [Changesets](https://github.com/changesets/changesets) 管理。

### 添加变更

```bash
pnpm changeset
```

选择受影响的包和版本类型：

- `patch`：修复、性能、兼容性重构
- `minor`：新增功能
- `major`：破坏性变更

提交 PR 时一并提交生成的 `.changeset/*.md`。

### 发布

1. PR 合并到 `main` 后，Release workflow 创建 version PR，更新版本号和 `CHANGELOG.md`。
2. 合并 version PR 后，workflow 执行 `changeset publish`。
3. 每个包按 `包名@版本` 创建 tag 和 GitHub Release，例如 `wows-replay-parser@1.0.1`。
4. npm 发布使用 Trusted Publishing（OIDC）。首次发布新包时可以在本地使用 npm 登录态完成。

不要手工修改包版本号或 `CHANGELOG.md`。

首次 `1.0.0` 发布完成前，Release workflow 只在手动触发时运行；发布后在仓库变量中设置 `RELEASE_ENABLED=true` 启用自动发版。

如果 npm 对刚下架的包施加 24 小时重发限制，等待后手动 `npm publish`，再执行 `pnpm git-tag` 创建对应 tag。新包首次发布可能进入 npm staged release 审核。

## 提交前检查

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

涉及发布配置或入口变更时，确认 `pnpm pack:check` 的输出只包含 `dist/`、`README.md`、`LICENSE` 和 `package.json`。
