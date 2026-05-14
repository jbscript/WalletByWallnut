# Pocket — Personal Finance App (PRD)

## Original Problem Statement
> create personal finance app similar to wallet by budgetbakers

## User Choices (v1)
- Auth: **Skipped** (single demo user, hardcoded user_id="demo")
- AI features: **None** (pure finance tracking)
- Currency: **INR (₹) default**, multi-currency supported
- Scope: Core only — Accounts, Records (income/expense/transfer), Categories, Dashboard, Analytics

## Architecture
- **Backend**: FastAPI + Motor (MongoDB async). Routes under `/api`. Models: `Account`, `Category`, `Record`. Seed on startup: 1 Cash account (INR) + 12 default categories (9 expense / 3 income).
- **Frontend**: React 19 + Tailwind + shadcn/ui + Recharts + React Router 7. Global state via `AppContext` (accounts, categories, period, recordsVersion).
- **URL Routing**: `/` Dashboard, `/accounts`, `/records`, `/analytics`

## v1 Implemented (Feb 2026)
- Accounts CRUD: create / edit / archive / delete (cascades records). Custom icon + color picker. Multiple currencies (INR/USD/EUR/GBP/JPY/AUD/CAD).
- Categories list (seeded defaults + custom create/delete).
- Records CRUD: income / expense / transfer (transfer correctly affects both accounts in balance computation).
- Records filters: search, sort, account, category, type; grouped by date with daily subtotal.
- Dashboard: account chips, Balance/Cash Flow/Spending summary cards, Balance Trend area chart, Expenses Structure donut + legend.
- Analytics: 3 tabs — Incomes & Expenses report (current vs previous month per category), Balance Trend (area chart), Cash Flow (last 6 months bar chart).
- Period switcher (prev/next month, syncs across pages via context).
- AddRecordModal: pill type tabs, large amount input, category grid picker, account/to-account selects, date picker (shadcn Calendar in popover), payee + note.
- Real-time refresh across pages on record save (via `recordsVersion` bump in context).
- Toast notifications (sonner), responsive layout, custom fonts (Outfit + Manrope), emerald primary palette.
- data-testid attributes on all interactive elements.

## Backend Endpoints
- `GET/POST /api/accounts`, `PATCH/DELETE /api/accounts/{id}`
- `GET/POST /api/categories`, `DELETE /api/categories/{id}`
- `GET/POST /api/records`, `PATCH/DELETE /api/records/{id}`
- `GET /api/analytics/summary`
- `GET /api/analytics/balance-trend`
- `GET /api/analytics/expenses-structure`
- `GET /api/analytics/report`
- `GET /api/analytics/cash-flow`

## Testing Status
- Backend: 16/16 pytest pass (testing_agent_v3 iteration 1)
- Frontend: AddRecord → Records list refresh fix verified post-iteration-1

## Prioritized Backlog
### P1 (Next)
- Budgets (monthly limit per category with progress bars)
- CSV/Excel import + export
- Recurring/scheduled transactions
- Investments tab (asset positions, P/L)

### P2
- AI insights / monthly summaries
- Receipt scanning (image OCR)
- Auth (JWT + Google OAuth)
- Goals / Savings buckets
- Multi-user / cloud sync

## Next Action Items
- Ask user for feedback on v1; iterate on UX (e.g. dashboard widget rearrangement).
- Implement Budgets (P1) next.
