# Pocket — Personal Finance App (PRD)

## Original Problem Statement
> create personal finance app similar to wallet by budgetbakers

## Stack (after v2 migration)
- **Frontend**: React 19 + **TypeScript** + Tailwind + shadcn/ui + Recharts + **Zustand** state
- **Backend**: FastAPI (Python) + Motor (MongoDB async)
- **DB**: MongoDB (single demo user, no auth)
- **Routing**: SPA on `/`, API under `/api`

(Note: user originally asked for Next.js + PostgreSQL + Prisma + Docker — not supported on the Emergent pod; per support_agent guidance we adopted as much as possible: TS + Tailwind + Zustand + full subcategory hierarchy.)

## v2 Implemented (Feb 2026)
- **Full TypeScript migration**: every source file is `.ts/.tsx`; tsconfig with `@/*` paths; `src/types/shims.d.ts` declares shadcn UI modules as `any` for ergonomic imports.
- **Zustand store** (`src/store/useAppStore.ts`) replaces React Context — selectors for accounts, categories, period, recordsVersion.
- **Hierarchical categories**: `Category` model has `parent_id` + `external_id` fields. Seed data inserts the full BudgetBakers hierarchy: **11 parents + 82 subcategories = 93 categories** (10 expense groups + Income + Others).
- **AddRecord modal — hierarchical picker**: Step 1 shows parent grid (10 expense or Income parents based on type). Step 2 reveals the parent's subcategory pills with a Back button + breadcrumb.
- **Records filter**: parent-category filter sidebar; `parent_category_id` query param expands to include all child subcategory IDs.
- **Analytics report**: each parent row is expandable to show child subcategory breakdown (current vs previous period).
- **Expenses Structure donut**: rolls up by parent for the Dashboard chart.
- **PeriodSwitcher**: popover with month grid + year navigation + Quick jump presets (This month, Last month, 3 months ago, Same month last year).
- Cross-page refresh on record save (`bumpRecords()` in Zustand store).

## Backend Endpoints (unchanged signatures + new query params)
- `GET/POST /api/accounts`, `PATCH/DELETE /api/accounts/{id}`
- `GET/POST /api/categories?type=&parent_id=`, `DELETE /api/categories/{id}` (only non-default)
- `GET/POST /api/records?account_id=&category_id=&parent_category_id=&type=&start_date=&end_date=&search=&sort=`
- `PATCH/DELETE /api/records/{id}`
- `GET /api/analytics/summary`
- `GET /api/analytics/balance-trend`
- `GET /api/analytics/expenses-structure?group_by=parent|leaf`
- `GET /api/analytics/report` (returns parents with `children[]`)
- `GET /api/analytics/cash-flow`

## Testing Status (iteration_2)
- **Backend**: 30/30 pytest pass (hierarchy, parent_category_id rollup, analytics report children, cascade delete).
- **Frontend e2e**: ~95% — parent→sub picker, save flow, dashboard rollup, analytics expand all verified. Two LOW priority items: chart width(-1) warnings on inactive tabs, and a deterministic data-testid is already present on records sidebar select.

## Prioritized Backlog
### P1 (Next)
- Budgets (monthly cap per category with progress bars; sub-level overrides)
- CSV/Excel import + export
- Recurring/scheduled transactions
- Investments module (holdings + P/L)
- Lazy-mount charts in inactive tabs (suppress Recharts -1 warnings)

### P2
- AI monthly summaries
- Auth (JWT or Emergent Google)
- Receipt OCR / image attachments
- Goals / savings buckets
- Multi-user sync

## Next Action Items
- Pick P1 feature to build next (Budgets recommended).
- Consider seeding lock — current `seed_defaults` wipes on schema mismatch; later add `is_default` guard.
