# AGENTS.md — wows-replay-parser

适用于 `packages/wows-replay-parser`。仓库级约定见根 `AGENTS.md`，此处只记录本包特有的结构与约束。

## 包职责

《战舰世界》Replay 文件的轻量解析器，运行时仅依赖 `egoroof-blowfish`，ESM-only。只解析容器、明文元数据和对局结果包，不解析其余实体数据包，不依赖游戏资源。

| 入口 | 源文件 | 用途 |
| --- | --- | --- |
| `wows-replay-parser` | `src/index.ts` | 通用 sans-io API |
| `wows-replay-parser/node` | `src/node.ts` | Node 文件读取与 `node:zlib` 解压 |
| `wows-replay-parser/extract` | `src/extract.ts` | 从 `scripts.zip` 提取字段映射（Node） |

## 源码结构

- `src/container.ts`：Replay 容器、明文元数据、附加 block。
- `src/blowfish.ts`：基于 `egoroof-blowfish` 的数据包流解密与 XOR 链。
- `src/packets.ts`：12 字节包头遍历，只暴露 `size/type/clock/payload`。
- `src/replay.ts`：串联容器、解密、解压、结果包定位与结果解析。
- `src/results.ts`：长度前缀 JSON 解析、位置数组映射、录制者查找。
- `src/container.ts`、`src/version.ts`：版本解析与 12.6.0 支持门槛。
- `src/constants.ts`：内联 `constants/latest.json`。
- `src/extract/zip.ts`：ZIP 中央目录与 STORED/DEFLATE 条目。
- `src/extract/marshal.ts`：Python 2.7 marshal 解析。
- `src/extract/decrypt.ts`：4 段 `.pyc` 解密。
- `src/extract/constants.ts`：静态扫描结果字段数组、拼装映射。
- `src/extract-cli.ts`：`wows-scripts-constants` 命令行入口。
- `src/types.ts`、`src/errors.ts`：公共类型与 `ReplayError`。

## 格式与行为约束

- 容器布局：magic `0x11343212` -> block count -> 明文 JSON 元数据 -> 附加 block -> 解压/压缩大小 -> 加密数据包流。
- 包头固定 12 字节：`size(u32LE) + type(u32LE) + clock(f32LE)`，随后是 `size` 字节 payload。
- 数据包流使用固定 key 的 Blowfish（ECB + 前一明文块 XOR 链），解密后是 zlib 流。
- 对局结果包类型为 `0x22`，payload 是 `u32 长度 + UTF-8 JSON`；长度必须与 payload 完全一致。
- 只支持 12.6.0+。低于该版本时 `parseReplay` 抛 `UNSUPPORTED_VERSION`；`parseReplayMeta` 仍可读取元数据。
- 结果包可能不存在（录制者提前离开），此时 `battleResults` 为 `null`，不是错误。
- 不引入完整实体解码、`GameParams`、翻译、GameData 或网络访问。

## 字段映射

- `constants/latest.json` 随源码存在，构建时内联到 `dist/`；`constants/<version>.json` 只保留在 GitHub。
- 映射由 `src/extract/` 从本机 `scripts.zip` 静态提取生成，不依赖 `wows-sandbox`、`wows-constants` 或其他项目。
- 提取流程：ZIP -> Python 2.7 marshal -> 4 段 `.pyc` 解密 -> 代码对象常量扫描。
- `CLIENT_PUBLIC_RESULTS` 的核心段由 `PLAYER_INFO + VEH_COMMON_RESULTS + VEH_CLIENT_RESULTS` 基础段拼成；末尾 Ribbon 段由运行时枚举生成，提取器复用上一版 `latest.json` 的尾段，核心前缀不一致时告警并只输出核心段。
- 升级游戏版本时运行 `dist/extract-cli.mjs --scripts-zip ...`，不要手工编辑映射表。
- 自定义映射通过 `parseReplay` 的 `mapping` 选项传入。

## 测试

- `tests/blowfish.test.ts`：标准向量、流加解密往返。
- `tests/container.test.ts`：容器、元数据、截断与非法 JSON。
- `tests/packets.test.ts`：包头遍历、结果包定位、越界保护。
- `tests/results.test.ts`：位置数组映射、缺失字段、录制者查找、最新映射快照。
- `tests/replay.test.ts`：合成 Replay 端到端、旧版本拒绝、结果缺失。
- `tests/node.test.ts`：临时文件读写。
- `tests/extract/marshal.test.ts`：Python 2.7 marshal 标量、字符串引用、代码对象。
- `tests/extract/zip.test.ts`：ZIP STORED / DEFLATE 条目。
- `tests/extract/constants.test.ts`：设置 `WOWS_SCRIPTS_ZIP` 时对真实 `scripts.zip` 做集成验证；未设置时跳过。
- 测试使用 `tests/helpers/replay.ts` 生成合成 Replay，不提交真实回放，不访问网络。

```bash
pnpm --filter wows-replay-parser typecheck
pnpm --filter wows-replay-parser test
pnpm --filter wows-replay-parser build
WOWS_SCRIPTS_ZIP=/path/to/scripts.zip pnpm --filter wows-replay-parser test
```

真实 Replay 的本地验证不进入 CI；单元测试使用合成 Replay。

## 变更检查

- 修改容器布局、包头或解密逻辑时，补充合成用例并跑真实样本验证。
- 修改公共导出时同步 `src/index.ts`、`package.json` `exports`、`tsdown.config.ts` `entry` 和 README。
- 新增入口时必须区分浏览器安全代码与 `node:` 依赖；`node:` 只允许出现在 `src/node.ts`。
- 除 `egoroof-blowfish` 外不新增运行时依赖；提取器只使用 Node 内置模块。
- `files` 只发布 `dist`，不要把 `constants/` 或真实 Replay 放进 npm 包。
