# Agent Instructions

## Package Manager
- Use **npm**: `npm install`, `npm run dev`, `npm run build`, `npm run lint`.
- Keep `package-lock.json` as the single lockfile.

## Architecture
- Use one Next.js App Router application for the public site, authentication, and role-based dashboards.
- Use TypeScript, Tailwind CSS, Prisma, and MySQL.
- Keep pages thin; place reusable domain UI in `src/features/` and server-only code in `src/server/`.
- Treat `PRD.md` as the product source of truth and `cari-market-build.md` as the implementation plan.

## Product Rules
- Default comment delivery to manual approval; never imply auto-send is safe by default.
- Preserve role boundaries for `SUPERADMIN`, `ADMIN`, and `USER`.
- Store OAuth tokens encrypted; never log secrets or full tokens.
- Make the pre-App-Review search limitation visible in product states.

## Design System
- Derive colors from the supplied Cari Market logos; use tokens from `src/app/globals.css`.
- Use Indonesian product copy by default.
- Maintain responsive behavior and visible keyboard focus states.

## File-Scoped Commands
| Task | Command |
| --- | --- |
| Lint file | `npx eslint path/to/file.tsx` |
| Typecheck | `npx tsc --noEmit` |
| Prisma validate | `npx prisma validate` |
| Test file | `npx vitest run path/to/file.test.ts` |

## Database
- Use MySQL-compatible Prisma models and migrations.
- Use `Decimal` for currency, UTC timestamps, explicit enums, and indexed foreign keys/search fields.
- Seed data must be clearly fictional and safe for local development.

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: (the agent model's name and attribution byline)
```


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
