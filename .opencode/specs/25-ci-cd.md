# Step 25 — CI/CD Pipeline

## Overview

Promotes CI out of the backlog (Step 15). The repo has no CI: `main` deploys to Vercel via git-based
deploys (AGENTS.md), a husky pre-commit hook auto-runs the esbuild bundle, and `npm test` is a stub.
This step adds a **GitHub Actions workflow** that runs typecheck + tests + bundle-freshness on every
push/PR to `main`, so a broken build or stale `api/index.js` never reaches Vercel. It also lays the
groundwork for future staged deploys (preview vs production) once the frontend is live.

## Depends on

- `.github/` — workflow dir (currently absent)
- `package.json` — `test` script exists as a stub; CI runs the Step 24 `vitest` suite
- `prisma.config.ts` — schema path is project-rooted; `npx prisma generate` needs no `--schema`
- `esbuild.vercel.mjs` — the manual bundle rebuild (`npm run build:vercel`); CI verifies freshness
- `.husky/pre-commit` — already rebuilds the bundle on commit; CI re-checks it for safety
- `DATABASE_URL_TEST` — test DB (Step 24) provisioned in the workflow via a Postgres service

## Workflow — `.github/workflows/ci.yml`

Trigger: `push` to `main` + `pull_request` targeting `main`. Matrix: Node 20 and 22 (LTS pair) on
`ubuntu-latest`. Jobs:

### 1. `test` (the gate)

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: tripverse_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 10s
          --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }}, cache: npm }
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy     # applies migrations to the service DB
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/tripverse_test
      - run: npx tsc --noEmit
      - run: npm test                      # Step 24 vitest suite, DATABASE_URL_TEST env
        env:
          DATABASE_URL_TEST: postgres://postgres:postgres@localhost:5432/tripverse_test
          JWT_ACCESS_SECRET: ci-access-secret
          JWT_REFRESH_SECRET: ci-refresh-secret
          CLOUDINARY_CLOUD_NAME: ci
          CLOUDINARY_API_KEY: ci
          CLOUDINARY_API_SECRET: ci
```

Notes:

- Env mirrors `.env`-required vars (config validates at boot — tests import the app, so the required
  Zod vars must be present even if unused).
- `migrate deploy` (not `migrate dev`) — non-interactive, applies committed migrations only.
- `npm run build` (tsup) can join this job after Step 24; it's cheap insurance that the bundle builds.

### 2. `bundle-freshness` (Vercel guard)

```yaml
  bundle-freshness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: node esbuild.vercel.mjs
      - name: Fail if bundle is stale
        run: git diff --exit-code -- api/index.js
```

Purpose: `api/index.js` is committed and must match `src/` (AGENTS.md — a stale bundle caused
`ERR_MODULE_NOT_FOUND` before). If the diff is non-empty the PR author forgot to run
`npm run build:vercel`; the job fails and asks for a rebuild. This is the CI twin of the husky hook.

### 3. Optional preview deploy (skipped until frontend is live)

Vercel git deploys already give preview URLs per PR. No workflow needed. When the **frontend** ships,
extend this pipeline to run end-to-end smoke checks against the preview backend and set
`FRONTEND_URL_PROD` on the production env — out of scope until then.

## Badge & conventions

- Add a CI status badge to `README.md` (optional polish).
- Workflow files live at `.github/workflows/ci.yml`; secrets (if any) come from GitHub repo secrets,
  never hardcoded.

## Files to create

- `.github/workflows/ci.yml`
- `README.md` — optional badge

## Files to change

- None beyond the above (package.json already has `test` after Step 24).

## New dependencies

None.

## Rules for implementation

- CI is a **gate**, not a formality: `tsc --noEmit`, `npm test`, and bundle-freshness must all pass
  before a merge to `main`.
- No secrets in the workflow — only dummy CI values for the required env vars; real creds stay in the
  Vercel/GitHub dashboards.
- The test DB is provisioned in-workflow (service container), never shared across runs.
- Keep the workflow lean: three small jobs, cached npm, no third-party composite actions unless they
  add clear value.
- Section-header comments only where existing modules use them.

## Definition of done

- `.github/workflows/ci.yml` committed; on a push/PR to `main`:
  - `test` job: `npm ci` → `prisma generate` → `migrate deploy` → `tsc --noEmit` → `npm test` all
    green on Node 20 and 22.
  - `bundle-freshness` job: passes when `api/index.js` is in sync, fails with a clear diff when stale.
- A deliberately broken change (e.g. a TS error or a stale bundle) makes the PR fail with a readable
  failing job — verified manually once with a throwaway commit that is then reverted.
- Commit + push (AGENTS.md workflow).