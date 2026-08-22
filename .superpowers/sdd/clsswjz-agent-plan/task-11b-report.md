# Task 11b Report — Notes and Settings Views

## Status: COMPLETE (with one caveat, see "Commit anomaly")

## Files delivered

| File | Action | Notes |
|------|--------|-------|
| `web/src/views/Notes.vue` | Overwritten | Note list: el-card items with title / 100-char content preview / noteType badge (笔记/待办/报告 via warning/success/default tags), FAB (`/notes/new`), card click → `/notes/:id`, loads via `noteApi.list({ accountBookId: appStore.currentBookId })`, handles both array and `{items}` responses |
| `web/src/views/NoteForm.vue` | Overwritten | Create/edit via `route.params.id` + `noteApi.get(id)`; title input, content textarea `:rows="10"`, noteType el-select (NOTE/TODO/REPORT → 笔记/待办/报告); save = create or update → `router.back()`; title required validation; passes `accountBookId` from app store |
| `web/src/views/settings/Categories.vue` | New | Grouped by categoryType into two glass cards: 支出分类 (EXPENSE) and 收入分类 (INCOME); el-table columns name/code/type; add/edit dialog (name, code, categoryType select 支出/收入), delete with ElMessageBox confirm |
| `web/src/views/settings/Shops.vue` | New | Search input (filters name/code client-side, case-insensitive) + el-table (name/code) + count; add/edit/delete with dialog + confirm |
| `web/src/views/settings/Tags.vue` | New | el-tag chips cloud, click chip to edit, inline × icon to delete (with confirm), hint text; add/edit dialog (name required, code optional) |
| `web/src/views/settings/Projects.vue` | New | el-table (name/code); add/edit/delete with dialog + confirm |
| `web/src/views/settings/Funds.vue` | New | Read-only el-table: name, fundType badge (CASH 现金 / BANK 银行卡 / ALIPAY 支付宝 / WECHAT 微信钱包 / CREDIT 信用卡, unknown types shown raw with info tag), balance formatted zh-CN with 2 decimals, isDefault → 默认 tag |

All views: `<script setup lang="ts">`, Chinese labels, imports from `@/api` and
`@/stores/app`, glass morphism styling using the project's design tokens from
`web/src/styles/tokens.css` (`--surface-glass`, `--blur-glass`,
`--border-glass`, `--radius-lg`, `--shadow-card`, `--text-1/2/3`) — no bare
color values except the red hover tint on tag delete.

## Verification

- `cd web && npx vite build` — succeeded (6.7s, 1687 modules). Notes.vue and
  NoteForm.vue are routed so they appear in the bundle output.
- The five settings views are **not yet routed** (router only has notes/items/books
  routes), so Vite tree-shook them out of the build. To verify them anyway, each
  SFC was compiled directly with `@vue/compiler-sfc`
  (parse + compileScript + compileTemplate): all 5 OK, no errors.
- Follow-up needed by a later task: register routes for
  `/settings/categories|shops|tags|projects|funds` in `web/src/router/index.ts`.

## Commit anomaly

The instructed commit `git add -A && git commit -m "feat: notes and settings views"`
found a clean tree: parallel task 11a's commit `ff0ea5d` ("feat: item module...")
had already swept these files in via its own `git add -A`. All 8 files from this
task are present verbatim inside `ff0ea5d`. Rather than rewrite history while
another agent works on the same branch, an empty marker commit `278367a` with the
correct message was created. Net effect: content committed exactly once on
`master`; message attribution split across two commits.

## Notes for integrator

- List endpoints may return either a plain array or `{items}` — all list loaders
  normalize both (`Array.isArray(res) ? res : res?.items || []`).
- Fund types beyond CASH/BANK/ALIPAY/WECHAT/CREDIT fall back to showing the raw
  enum value with an info tag rather than hiding data.
- Tags deletion is exposed as an inline × on each chip plus edit-on-click;
  confirm dialogs guard all destructive actions.
