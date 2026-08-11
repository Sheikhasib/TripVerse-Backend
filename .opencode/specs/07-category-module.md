# Step 7 — Category Module

Admin-managed taxonomy for tour packages. Backs the explore `?category=` filter, the landing **Categories** section, and the dashboard **Categories** menu (all in the requirements). Build right after contact — the package module (Step 8) depends on this relation.

## Endpoints — `/api/categories`
```
GET    /                 public        ordered by name asc, with _count of approved packages
POST   /                 auth(ADMIN)    body: { name }
PATCH  /:id              auth(ADMIN)    body: { name }    regenerates slug
DELETE /:id              auth(ADMIN)    409 if packages reference it
```

## Rules
- Slug generated server-side from `name` (same kebab-case slugify as package slugs in Step 8). `name` and `slug` are both `@unique`.
- Public `GET /` returns each category with its `_count.packages` (approved + not-deleted only) so the landing Categories section renders real counts, not placeholders.
- `DELETE` refuses with 409 when `_count.packages` > 0 — a category in use can be renamed, not removed. The create/update path checks the `@unique` constraints and surfaces a friendly 409 instead of a raw P2002.
- No pagination on the public list (categories are few). The dashboard category table gets `page`/`limit` via the dashboard module (Step 12).
- No soft-delete on `Category` — renaming is the escape hatch; hard delete is safe because of the 409 guard.
