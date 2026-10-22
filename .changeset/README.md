# Changesets

本仓库使用 [Changesets](https://github.com/changesets/changesets) 管理三个独立版本的发布包。

## 添加变更

```bash
pnpm changeset
```

选择受影响的包和版本类型（patch / minor / major），填写面向使用者的说明。提交 PR 时一并提交生成的 `.changeset/*.md`。

## 发布流程

1. PR 合并到 `main` 后，Changesets Action 创建 version PR，更新版本号和 `CHANGELOG.md`。
2. 合并 version PR 后，Action 执行 `changeset publish`，按包创建 `包名@版本` tag 与 GitHub Release。
3. npm 发布使用 Trusted Publishing（OIDC）；首次发布可在本地用 npm 登录态完成。

不要手工修改包版本号或 `CHANGELOG.md`。

## 特殊情况

- 新包首次发布可能进入 npm 的 staged release 审核，审核通过后才会替换 `0.0.0-stage` 占位版本。
- 刚下架的包有 24 小时重发限制。等待后可以手动 `npm publish`，再执行 `pnpm git-tag` 创建对应 tag。

当前未准备发布的包会暂时加入 `config.json` 的 `ignore` 列表；准备好后移除即可。
