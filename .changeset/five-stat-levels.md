---
'wows-number-api-sdk': minor
'wows-compute': minor
---

Add PR formula components and the five core statistic level module.

- `wows-number-api-sdk`: `calculatePR` / `calculateBattlePR` now return `components`; export `PR_NORMALIZATION` and `normalizePrRatio`.
- `wows-compute`: add `evaluateCoreStats`, `shipLevels`, `accountLevels` and `accountLevelsEstimated` for win rate, damage, frags, PR and XP.
- `aggregate*` and `recentMatches` now expose `avgExp` / `expTotal` / `levels`; `RatedValue` carries optional PR components.
