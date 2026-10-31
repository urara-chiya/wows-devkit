# wows-compute

## 1.2.0

### Minor Changes

- b316ac9: Add PR formula components and the five core statistic level module.
  
  - `wows-number-api-sdk`: `calculatePR` / `calculateBattlePR` now return `components`; export `PR_NORMALIZATION` and `normalizePrRatio`.
  - `wows-compute`: add `evaluateCoreStats`, `shipLevels`, `accountLevels` and `accountLevelsEstimated` for win rate, damage, frags, PR and XP.
  - `aggregate*` and `recentMatches` now expose `avgExp` / `expTotal` / `levels`; `RatedValue` carries optional PR components.

### Patch Changes

- Updated dependencies [b316ac9]
  - wows-number-api-sdk@1.1.0

## 1.1.0

### Minor Changes

- 51b5520: 新增 `summarizePlayers` / `summarizeRoster`，对已标准化的 `PlayerPoint` 做加权概览归纳；`PlayerPoint` 与 `PlayerRatingSnapshot` 增加可选场均与隐藏战绩字段。
