# 字段映射表

对局结果中的 `commonList`、`playersPublicInfo` 和交互明细都是位置数组，需要按游戏版本的字段顺序解释。本目录保存精简后的映射表：

- `latest.json`：当前发布版本，构建时内联进 `dist/`，会进入 npm 包。
- `<version>.json`：历史版本快照，只保留在 GitHub。
- 生成命令：`dist/extract-cli.mjs`（见下方“更新”）。

每份映射只保留解析对局结果所需的三个字段：

| 字段 | 来源 | 用途 |
| --- | --- | --- |
| `commonResults` | `COMMON_RESULTS` | `commonList` 的字段顺序 |
| `publicResultIndices` | `CLIENT_PUBLIC_RESULTS_INDICES` | 玩家数组的字段名 → 下标 |
| `interactionDetails` | `CLIENT_VEH_INTERACTION_DETAILS` | 受害者交互数组的字段顺序 |

## 更新

从本机游戏目录的 `bin/<build>/res/scripts.zip` 生成：

```bash
pnpm --filter wows-replay-parser build
WOWS_SCRIPTS_ZIP="/path/to/scripts.zip" \
  node packages/wows-replay-parser/dist/extract-cli.mjs \
  --out packages/wows-replay-parser/constants
```

脚本完全使用 TypeScript 实现 ZIP、Python 2.7 marshal 和 4 段 `.pyc` 解密，不依赖 `wows-sandbox`、`wows-constants` 或其他项目。

`CLIENT_PUBLIC_RESULTS` 的末尾 Ribbon 字段由游戏运行时枚举生成，静态提取只覆盖核心段；脚本会复用上一版 `latest.json` 的 Ribbon 尾段，并在核心前缀变化时告警。首次在空目录生成时只会得到核心字段，建议始终保留上一版 `latest.json` 作为 `--previous`。

提交前确认提取结果与上一版的核心字段差异符合新版本预期，并运行 `pnpm --filter wows-replay-parser test`。
