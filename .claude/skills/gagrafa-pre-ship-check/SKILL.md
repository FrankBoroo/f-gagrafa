---
name: gagrafa-pre-ship-check
description: Use before pushing or deploying The Gagrafa, or when asked "is this ready to ship?". Runs type check, build, tests and the pre-deployment checklist in CLAUDE.md, then reports a verdict.
---

# Gagrafa pre-ship check

Run in order and stop at the first failure; fix it, then restart from the top.

1. `git status`: no stray files, no `.env*` or secrets staged.
2. `npm install` (only if `package.json` changed).
3. `npx tsc --noEmit`: zero errors. Do not silence with `any` or `@ts-ignore`.
4. `npm run lint`: zero errors.
5. Tests (`npm test` once Vitest is added): all green.
6. `npm run build`: succeeds with no "Attempted import error" or "not exported" warnings (these have meant missing exports before, e.g. `UNAUTHORIZED`).
7. Named-import check: every `import { X } from "@/..."` resolves to a real export.
8. Known pitfalls scan:
   - `params` / `searchParams` / `cookies()` awaited (Next 15).
   - `actions.ts` files export only async functions and types.
   - No `return toast.error(...)` inside `startTransition` callbacks.
   - Env fallbacks use `||`, not `??`.
   - Callback parameters explicitly typed.
9. Migrations: any new SQL is idempotent, ordered, has a rollback note, and the README lists the run order.
10. Walk the **Pre-deployment checklist** in `CLAUDE.md` against the actual code and produce its table (Pass / Fail / Not applicable, with file evidence).

## Verdict
End with **Ready to deploy** or **Not ready**, naming the blocking items. Do not say "ready" if any step could not be run; say which step was skipped and why.

## After deploying
Open the Vercel deployment logs, hit `/api/health`, and test one booking with Paystack test keys. Rollback: promote the previous Vercel deployment; if a migration shipped, use its `-- ROLLBACK:` block only if it is not backward-compatible.
