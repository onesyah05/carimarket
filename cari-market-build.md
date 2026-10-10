# Cari Market Build Plan

## Goal
Deliver a polished, responsive Cari Market MVP from `PRD.md` as one Next.js application backed by MySQL.

## Architecture Decisions
- Next.js App Router unifies SEO-ready public pages and the authenticated dashboard.
- Prisma targets MySQL; Threads OAuth/search/reply now use the official API adapter, while Redis/BullMQ, AI, billing, and email remain adapter-based until their infrastructure or credentials are supplied.
- Lead, keyword, connection, automation setting, and reply delivery state come from MySQL; missing Threads credentials are surfaced as an explicit configuration state.
- Manual approval remains the default. Automatic-mode rules are persisted, while unattended scheduled delivery still requires the production queue worker described in the PRD.

## Delivery Phases
1. Revise PRD decisions: MySQL, single Next.js app, MVP boundaries, and data model.
2. Scaffold Next.js, Prisma, environment templates, assets, and design tokens.
3. Implement public marketing routes and authentication/onboarding screens.
4. Implement user dashboard, lead feed, keywords, reply review, history, and settings.
5. Implement admin/superadmin navigation and representative management views.
6. Add route handlers/services, MySQL schema, seed data, and validation.
7. Verify lint, typecheck, build, Prisma schema, responsive UI, and critical interactions.

## Acceptance Criteria
- `npm run dev` starts the app and primary routes render without external credentials.
- MySQL is the only documented and configured relational database.
- Public pages have metadata, semantic structure, responsive layouts, sitemap, and robots rules.
- Dashboard clearly shows quota, Meta approval limitations, lead status, and manual reply approval.
- Role navigation and protected domain operations are represented and server-side authorization boundaries are documented.
- Supplied brand assets are used and the UI palette visibly derives from them.
- Production integrations are isolated behind environment variables and adapters.

## Hardening Pass (10 Oktober 2026)
- Negative keywords now filter search ingestion; relevance and exclusion logic live in a pure, unit-tested module.
- Threads engagement metrics are persisted only when the source returns them; unknown metrics stay null instead of rendering as zero, and the lead feed gained an engagement filter plus time-accurate sorting.
- Plan quotas (search, reply, keyword) are enforced server-side for API routes and the worker, surfaced on the subscription page, and warn at 80 percent.
- Scheduled articles publish through a worker job with an audit entry.
- Contact submissions persist to MySQL and are visible to Admin and Superadmin.
- The onboarding wizard is reachable again, routes incomplete profiles, persists keywords, and stamps completion.
- The in-memory rate limiter sweeps expired windows and caps tracked keys.
- Prisma migrations are baselined in `prisma/migrations/0_init`, and Vitest covers the pure logic modules.
- Threads OAuth signup marks placeholder emails explicitly, records an audit entry, exposes the state to Superadmin, allows claiming a real email, and can be disabled via `THREADS_SIGNUP_ENABLED`.
- In-app notifications are stored and shown in the dashboard bell; email remains an unconfigured adapter.

## Delivery Status
- Complete: PRD architecture and MySQL data-model revision.
- Complete: agent instructions and specialist role definitions.
- Complete: public site, SEO routes, auth, onboarding, user dashboard, admin, and superadmin surfaces.
- Complete: Prisma MySQL schema, Docker MySQL configuration, seed, encrypted Threads OAuth, public keyword search, reply publishing, keyword CRUD, and delivery history persistence.
- Verified: lint, TypeScript, Prisma validation/client generation, production build, responsive rendering, configuration states, and API error handling.
- Deferred to credentials/infrastructure: end-to-end Meta authorization against a real account, external AI provider, billing provider, email delivery provider, and production queue worker.
- Pending a running MySQL instance: applying `prisma/migrations/0_init` and the seed refresh were not executed in this pass; lint, typecheck, unit tests, Prisma validation, and the production build were.
