---
description: Create a spec file for a new TripVerse feature
argument-hint: "Feature name, e.g. booking-flow or admin-analytics"
allowed-tools: Read, Write, Glob, Bash(git:*)
---

You are a senior developer spinning up a new feature for TripVerse, a travel package booking marketplace (Next.js 16 frontend, Express/Prisma/Postgres backend, already deployed).

Always follow AGENTS.md conventions (Next.js 16: `proxy.ts` not `middleware.ts`, `params` is a Promise, Turbopack default). Commit to git continuously per the AGENTS.md workflow rule — at least once per spec step.

User input: $ARGUMENTS

## Step 1 — Parse arguments

From $ARGUMENTS extract:

| Variable        | Rule                             | Example                |
| --------------- | -------------------------------- | ---------------------- |
| `feature_title` | Title Case, human readable       | "Booking Flow"         |
| `feature_slug`  | kebab-case, a-z0-9, max 40 chars | `booking-flow`         |
| `branch_name`   | `feature/<slug>`                 | `feature/booking-flow` |

Ask the user if ambiguous.

## Step 2 — Research codebase

Read these before writing the spec — the project has no `lib/types.ts`; types are co-located with the API file that owns them (e.g. `TAuthUser` lives in `auth.ts`, not a central types file).

**Existing specs** — `.opencode/specs/*.md` (read them all, avoid duplication — currently 00-overview through 25-ci-cd, backend module specs)

**API layer** — `lib/api/` (each file exports one `xxxApi = { method, ... }` object plus its own types)

- `client.ts` — `apiClient<T>(path, options?)` returns `data` only; `apiClientFull<T>` returns the full `TApiEnvelope<T>` (`{ success, statusCode, message, data, meta? }`) for paginated lists. Both throw `ApiError(statusCode, message)`. Requests go same-origin through `next.config.ts`'s `/api/:path*` rewrite to `BACKEND_API_URL` — no CORS handling needed client-side.
- `packages.ts` — `packagesApi.{getList, getBySlug, getCategories, getReviews, getMyPackages, getAllPackages, createPackage, updatePackage, changePackageStatus, deletePackage, findMyPackage, findAdminPackage}`. Types: `TCategory`, `TPublicPackage`, `TPublicPackageQuery`, `TReview`, `TPackageStatus` (`PENDING|APPROVED|REJECTED`), `TInternalPackage`.
- `auth.ts` — `authApi` (register/login/demo-login/logout/me/refresh). Types: `TAuthUser`.
- `users.ts` — `usersApi` (profile + admin user management).
- `uploads.ts` — `uploadsApi.uploadImage(file)` → `TUploadResult { url, publicId }`. Backend accepts jpg/png/webp ≤5MB, field name `"image"`.
- `blog.ts` — `blogApi`. Types: `TBlogAuthor`, `TBlogPost`, `TBlogPostListItem` (`Omit<TBlogPost, "content">`), `TBlogQuery`.
- `contact.ts` — `contactApi`.
- Roles are a string union, not a TS enum: `"USER" | "AGENT" | "ADMIN"`. The requirements doc names the roles User/Manager/Admin — `AGENT` is displayed as **"Manager"** in the UI (sidebar labels, role badges) while route prefixes stay `/agent-dashboard`. Don't rename the underlying role value.
- New resources (bookings, reviews, payments, dashboard stats) follow this exact pattern: one file per resource in `lib/api/`, a single `xxxApi` object, types declared at the top of the same file, mirrored against a `lib/validations/<name>.ts` Zod schema where the resource has a form.

**Hooks** — `hooks/`

- Only `use-me.ts` exists today (`useMe()` — returns `{ user, isLoading }`, skips the request entirely when no `accessTokenClient` cookie is present). There is **no** general `useXxx`-per-resource wrapper convention yet — most data fetching is done one of two ways, follow whichever matches the page type:
  - **Server Components** (public pages, e.g. `app/(publicGroup)/packages/page.tsx`) call `xxxApi.method()` directly in an async function, wrapped in try/catch with a safe fallback.
  - **Client Components** (dashboard pages, e.g. `agent-dashboard/my-packages/page.tsx`) call `useQuery`/`useMutation` from `@tanstack/react-query` directly with `xxxApi.method` as the `queryFn`/`mutationFn` — no wrapper hook in between.
  - Only add a `hooks/use<Name>.ts` wrapper if the same query/mutation is reused across 3+ components (mirrors why `useMe` exists — it's read from the navbar, dashboard layout, and auth pages).

**Shared components** — `components/shared/`

- `blog-card.tsx`, `contact-form.tsx`, `empty-state.tsx`, `footer.tsx`, `navbar.tsx`, `package-card.tsx`, `pagination.tsx`, `rating.tsx`, `review-list.tsx`, `section-heading.tsx`

**Dashboard components** — `components/dashboard/`

- `dashboard-mobile-nav.tsx`, `dashboard-nav.tsx`, `dashboard-user-menu.tsx`, `image-uploader.tsx` (Cloudinary upload widget, drives `uploadsApi.uploadImage`, shows previews + remove), `package-form.tsx`, `status-badge.tsx` (currently package-status only — extend the `STATUS_CONFIG` pattern for new statuses, don't create a parallel badge component)

**Auth components** — `components/auth/`

- `auth-card.tsx`, `demo-login-buttons.tsx`, `google-button.tsx`, `login-form.tsx`, `register-form.tsx`, `use-after-auth.ts`

**Route groups** — `app/`

- `(publicGroup)/` — home, `packages`, `packages/[slug]`, `blog`, `blog/[slug]`, `about`, `contact`, `help`, `privacy`, `profile` (no auth required)
- `(authGroup)/` — `login`, `register` (redirect to dashboard if already authenticated — see `components/auth/use-after-auth.ts`)
- `(dashboardGroup)/` — `admin-dashboard/`, `agent-dashboard/` today; `user-dashboard/` does not exist yet and is created by whichever spec builds it first (Step 10) — check before assuming it's there.

**Other files**

- `app/providers/query-provider.tsx` — TanStack `QueryClientProvider` setup
- `app/layout.tsx` — root layout wrapping `QueryProvider` + `ThemeProvider` + `Toaster` (sonner)
- `next.config.ts` — image `remotePatterns` for `res.cloudinary.com`; `/api/:path*` rewrite to `BACKEND_API_URL`
- `proxy.ts` — Next.js middleware (not `middleware.ts` — this project is on the Next.js version where the file is named `proxy.ts`): refreshes tokens, sets/clears the `accessToken`/`refreshToken`/`accessTokenClient` cookies (mirrors the backend's `auth.controller.ts` cookie options exactly), and guards dashboard routes by role. Read it before adding any new protected route — new path prefixes need an entry here.
- `utils/jwt.ts`, `service/refreshToken.ts` — used only by `proxy.ts`, never in client components.
- `lib/validations/` — one Zod schema file per form (`auth.ts`, `package.ts`, `public.ts` exist today), used via `@hookform/resolvers/zod` in the matching form component.
- `AGENTS.md` — project-specific Next.js 16 quirks, workflow rules, and the current list of what's cut from MVP.

## Step 3 — Create branch

Run:

```
git checkout -b feature/<feature_slug>
```

If branch exists, check it out instead.

## Step 4 — Write spec

Generate a spec document with this exact structure:

```
# Spec: <feature_title>

## Overview

One paragraph describing what this feature does for TripVerse.

## Depends on

List exact file paths this feature builds on, grouped by layer:
- `lib/api/<file>.ts` — API functions/types used (note: types are co-located here, not in a central types file)
- `hooks/use-me.ts` or inline useQuery/useMutation — which pattern this feature follows (see Step 2)
- `components/shared/<file>.tsx` / `components/dashboard/<file>.tsx` — existing components reused
- `app/(group)/` — which route group
- `proxy.ts` — auth protection needed? (role guard, redirect rules) — note any new path prefix that needs an entry

## Routes

- `GET /path` — description, auth required? role? (USER / AGENT / ADMIN — remember AGENT displays as "Manager")

## New API functions

```

lib/api/<name>.ts
fetchXxx(args) — GET /api/xxx — via apiClient/apiClientFull, returns TXxx / TApiEnvelope<TXxx[]>
createXxx(payload) — POST /api/xxx — returns TXxx

```
Types declared at the top of the same file, per project convention.

## New Hooks (only if the query/mutation is reused 3+ places — otherwise inline useQuery/useMutation in the component)

```

hooks/use<Name>.ts
useXxx() — useQuery({ queryKey: [...], queryFn: xxxApi.method })

```

## Components

**Create:**
- `path/to/component.tsx` — what it renders, what props it takes

**Modify:**
- existing component — what changes

## Files to change

Exact file paths. One per line.

## Files to create

Exact file paths. One per line.

## New dependencies

List npm packages. If none: "No new dependencies."

## Rules for implementation

Specific TripVerse constraints. Always include relevant items from this list:

### Data fetching
- Server Components call `xxxApi.method()` directly (try/catch, safe fallback); Client Components use `useQuery`/`useMutation` inline with `xxxApi.method` as the fn — no wrapper hook unless reused 3+ places (see Step 2)
- `useMutation` always includes `onSuccess` with `queryClient.invalidateQueries`
- Mutation buttons must show loading state + `disabled` attribute
- Skeleton components for loading state (never spinners for lists)
- Empty state message for every data list (`components/shared/empty-state.tsx`)
- Error state with retry button, surfacing `ApiError.message` verbatim

### Auth & routing
- `proxy.ts` guards role-based routes (`USER`, `AGENT`, `ADMIN`) — add new protected prefixes there
- Auth pages redirect to dashboard if already logged in (`components/auth/use-after-auth.ts`)
- `AGENT` role displays as **"Manager"** in UI copy; route prefixes and the stored role value stay `AGENT`/`agent-dashboard`

### UI & animation
- All clickable elements need `cursor-pointer` + `transition-colors duration-200`
- Buttons use framer-motion `whileTap={{ scale: 0.97 }}`
- Card hover: `whileHover={{ y: -4 }}` (not scale — prevents layout shift)
- Lists use `motion.div` with stagger animation (`staggerChildren: 0.08`)
- Icons from `@phosphor-icons/react` — never emoji as icons
- Images use `next/image` with `fill` + `sizes` + `onError` fallback (Cloudinary domain already in `next.config.ts`)
- Status badges follow `components/dashboard/status-badge.tsx`'s `STATUS_CONFIG` map pattern — extend it per new status enum rather than writing a new badge component
- shadcn/ui components from `components/ui/` — never create new primitives

### Styling
- Tailwind v4 `@theme` tokens (`bg-primary`, `text-muted-foreground`, etc.) — 3 primary colors + neutral only
- Dark mode via `dark:` variant
- `cn()` from `@/lib/utils` for className merging

## Definition of done

Testable checklist. Each item verifiable by running `npm run dev`. Include `npm run lint` and `npm run typecheck` passing as a standing item.
```

## Step 5 — Save

Save to: `.opencode/specs/<feature_slug>.md`

## Step 6 — Report

```
Branch:    feature/<feature_slug>
Spec file: .opencode/specs/<feature_slug>.md
Title:     <feature_title>
```

"Review the spec then ask me to implement it."

## Example output

For reference, the existing specs (`08-booking-flow.md`, `09-review-components.md`, `10-dashboards.md`, `13-payment-gateway.md`) follow this exact format — `13-payment-gateway.md` in particular shows the full depth expected (session/state handling, exact type shapes, a rules section, a testable definition-of-done). Read one before writing if unsure.
