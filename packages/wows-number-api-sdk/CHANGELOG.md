# wows-number-api-sdk

## 1.1.0

### Minor Changes

- b316ac9: Add PR formula components and the five core statistic level module.
  
  - `wows-number-api-sdk`: `calculatePR` / `calculateBattlePR` now return `components`; export `PR_NORMALIZATION` and `normalizePrRatio`.
  - `wows-compute`: add `evaluateCoreStats`, `shipLevels`, `accountLevels` and `accountLevelsEstimated` for win rate, damage, frags, PR and XP.
  - `aggregate*` and `recentMatches` now expose `avgExp` / `expTotal` / `levels`; `RatedValue` carries optional PR components.

## 1.0.1

### Patch Changes

- 首次公开发布。npm 已占用 1.0.0 版本号，初始发布使用 1.0.1。
