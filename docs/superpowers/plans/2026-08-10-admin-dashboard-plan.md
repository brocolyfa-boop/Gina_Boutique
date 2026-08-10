# Panel Administrador Completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current admin page into a separate, data-driven back office for products, images, categories, promotions, inventory, orders, and sales zones.

**Architecture:** PostgreSQL remains the source of truth for all business data. The API owns authorization, aggregation, validation, Cloudinary uploads, and persistence; the web admin consumes typed endpoints and renders separate modules. Cloudinary stores image files while PostgreSQL stores their URLs and metadata.

**Tech Stack:** TypeScript, Express, Prisma, PostgreSQL, Zod, React, React Query, React Router, Tailwind CSS, Cloudinary Node SDK, Recharts, Vitest/supertest where tests exist.

## Global Constraints

- Preserve the existing monorepo workspaces and Node `>=22 <23` requirement.
- Keep the admin area inaccessible to non-admin users through both API middleware and web route guards.
- Keep `CLOUDINARY_URL` only in the Railway API service; never expose it to Vite or the browser.
- Store image URLs and product/promotion metadata in PostgreSQL; store binary image files in Cloudinary.
- Keep new product measurement and shipping fields optional so existing seeded products remain valid.
- Preserve the existing uncommitted `package-lock.json` change and do not include it in feature commits.
- Each task must compile and pass its focused tests before the next task begins.

## File Map

- Modify `apps/api/prisma/schema.prisma` for product metadata, dimensions, image metadata, and promotion scheduling fields.
- Create focused API modules under `apps/api/src/admin/` for Cloudinary, dashboard queries, and upload handling.
- Modify `apps/api/src/routes/products.ts` and `apps/api/src/routes/promotions.ts` for admin CRUD and upload-backed persistence.
- Create `apps/api/src/routes/admin.ts` for dashboard aggregates and zone data.
- Modify `packages/shared/src/schemas.ts` and `packages/shared/src/types.ts` for shared request/response contracts.
- Split `apps/web/src/pages/Admin.tsx` into `apps/web/src/pages/admin/` modules rather than growing one page further.
- Create `apps/web/src/components/admin/` for navigation, cards, charts, tables, filters, upload widgets, and product forms.
- Modify `apps/web/src/App.tsx` and `apps/web/src/lib/api.ts` only where admin routing or upload error handling requires it.
- Add focused tests under `apps/api/src/**/*.test.ts` and `apps/web/src/**/*.test.tsx` following the repository's available test setup.

---

### Task 1: Confirm test and data foundations

**Files:**
- Inspect: `package.json`, `apps/api/package.json`, `apps/web/package.json`, `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/admin/admin-test-data.ts` only if a reusable test fixture is required
- Test: existing API and shared test locations

**Interfaces:**
- Produces a confirmed test command, seeded admin fixture, and a documented baseline schema for the later tasks.

- [ ] **Step 1: Inspect available test runners and scripts**

Run:

```bash
npm run typecheck --workspaces --if-present
cat package.json apps/api/package.json apps/web/package.json
```

Record the existing runner instead of introducing a second test framework unnecessarily.

- [ ] **Step 2: Add a failing schema contract test for optional product metadata**

Test that an existing product payload with only the current fields remains accepted and that a payload containing dimensions, SKU, and material is accepted.

- [ ] **Step 3: Run the focused test and verify the new fields fail before implementation**

Run the repository's discovered test command against the new test. Expected: the new extended payload is rejected or its fields are absent.

- [ ] **Step 4: Commit the baseline test contract**

```bash
git add <focused-test-files>
git commit -m "test: define admin product data contract"
```

### Task 2: Extend PostgreSQL and shared contracts

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/types.ts`
- Create: `apps/api/prisma/migrations/<timestamp>_admin_product_metadata/migration.sql`
- Test: shared schema tests from Task 1

**Interfaces:**
- `ProductoInput` gains optional `sku`, `marca`, `material`, `tipoPrenda`, `medidas`, `pesoGramos`, `altoCm`, `anchoCm`, `profundidadCm`, and `guiaTallas`.
- Product images remain ordered URL strings for compatibility; image metadata may be represented by a focused `ProductoImagenDTO` only if the UI needs public IDs or alt text.
- Promotion input gains explicit `fechaInicio`, `fechaFin`, `activo`, and an image URL field while preserving existing seeded rows.

- [ ] **Step 1: Add nullable Prisma columns with safe defaults**

Add optional product fields and a JSON-compatible `medidas` value or a dedicated `ProductMeasurement` relation. Use the simpler JSON shape for garment measurements because the fields are product-specific and optional. Add shipping dimensions as nullable numeric columns.

- [ ] **Step 2: Generate the migration without changing existing rows**

Run:

```bash
npx prisma migrate dev --name admin_product_metadata -w @gina/api
```

Verify the migration is additive and does not delete or rewrite seeded products.

- [ ] **Step 3: Update Zod schemas and DTO types**

Validate numeric dimensions as non-negative, SKU as trimmed and bounded, and garment measurements as optional. Keep `imagenes` as a URL array until image reordering requires richer metadata.

- [ ] **Step 4: Run shared typecheck and schema tests**

```bash
npm run typecheck --workspaces --if-present
```

- [ ] **Step 5: Commit the data contract**

```bash
git add apps/api/prisma packages/shared
git commit -m "feat: add admin product metadata and measurements"
```

### Task 3: Add secure Cloudinary upload service

**Files:**
- Create: `apps/api/src/admin/cloudinary.ts`
- Create: `apps/api/src/admin/upload.ts`
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/admin/cloudinary.test.ts`

**Interfaces:**
- `subirImagen(buffer: Buffer, filename: string): Promise<{ url: string; publicId: string }>`.
- `eliminarImagen(publicId: string): Promise<void>`.
- `POST /api/admin/uploads/images` accepts multipart image files only for authenticated admins and returns ordered upload results.

- [ ] **Step 1: Add the failing tests**

Cover: missing `CLOUDINARY_URL` produces a clear API configuration error; non-admin upload returns 403; unsupported MIME type returns 400; a successful mocked Cloudinary upload returns URL and public ID.

- [ ] **Step 2: Add the Cloudinary dependency and server-side configuration**

Install the Node SDK in the API workspace. Read the existing Railway `CLOUDINARY_URL` from `env.ts`; never add it to `apps/web` or any Vite variable.

- [ ] **Step 3: Implement memory-safe multipart handling**

Limit image count and per-file size, accept JPEG/PNG/WebP, reject SVG and executable content, upload from memory or a temporary stream, and return only safe public metadata.

- [ ] **Step 4: Register the admin upload route and run focused tests**

Verify successful mocked uploads, rejected files, and admin authorization.

- [ ] **Step 5: Commit the upload service**

```bash
git add apps/api apps/api/package.json package-lock.json
git commit -m "feat: add secure admin image uploads"
```

Do not include the pre-existing unrelated `package-lock.json` diff; stage only dependency lines belonging to this task.

### Task 4: Build complete product and category administration

**Files:**
- Create: `apps/api/src/routes/admin-products.ts` if separating admin endpoints is clearer
- Modify: `apps/api/src/routes/products.ts`
- Modify: `apps/api/src/routes/categories.ts`
- Create: `apps/web/src/pages/admin/ProductosAdmin.tsx`
- Create: `apps/web/src/pages/admin/ProductoForm.tsx`
- Create: `apps/web/src/pages/admin/CategoriasAdmin.tsx`
- Create: `apps/web/src/components/admin/ImageUploader.tsx`
- Create: `apps/web/src/components/admin/ProductMeasurements.tsx`
- Modify: `apps/web/src/pages/Admin.tsx`
- Test: API CRUD tests and web form tests

**Interfaces:**
- Admin product create/update accepts the shared `ProductoInput` plus uploaded image URLs.
- `ImageUploader` returns `string[]` URLs to `ProductoForm` and supports preview, reorder, remove, and primary-image selection.
- `ProductoForm` submits one normalized product payload and never sends Cloudinary credentials.

- [ ] **Step 1: Add failing API tests for product CRUD and category selection**

Cover admin create, admin update, public exclusion of inactive products, optional dimensions, and rejection for non-admin users.

- [ ] **Step 2: Implement API create/update/delete behavior with validation**

Keep logical deletion for products referenced by orders. Return the category relation and normalized image array in admin responses.

- [ ] **Step 3: Add failing component tests for the product form**

Cover required fields, category selection, price offer validation, image preview, measurement fields, shipping fields, and successful submit payload.

- [ ] **Step 4: Implement the modular product UI**

Use tabs for information, prices/offer, photos, measurements, and inventory/shipping. Add loading, success, and error states and invalidate the product queries after mutations.

- [ ] **Step 5: Add category management and image selection**

Support category name, slug, description, ordering, active state, and optional category image through the same upload service.

- [ ] **Step 6: Run API tests, web tests, and typecheck**

```bash
npm run typecheck --workspaces --if-present
npm run build -w @gina/web
```

- [ ] **Step 7: Commit product and category administration**

```bash
git add apps/api apps/web packages/shared
git commit -m "feat: add admin product and category management"
```

### Task 5: Add promotions with images and scheduling

**Files:**
- Modify: `apps/api/src/routes/promotions.ts`
- Modify: `packages/shared/src/schemas.ts` and `packages/shared/src/types.ts`
- Create: `apps/web/src/pages/admin/PromocionesAdmin.tsx`
- Create: `apps/web/src/components/admin/PromotionForm.tsx`
- Modify: `apps/web/src/pages/Home.tsx`
- Test: promotion API and form tests

**Interfaces:**
- Promotion form submits `tipo`, `valor`, `categoriaId`, `productoIds`, `fechaInicio`, `fechaFin`, `bannerImagen`, and `activo`.
- Public promotion listing returns only records that are active and within the current time window.

- [ ] **Step 1: Add failing tests for date and active-state filtering**

Cover promotions before start, after end, inactive promotions, category-targeted promotions, and percentage versus fixed-amount validation.

- [ ] **Step 2: Implement server-side promotion filtering and admin CRUD**

Do not rely on the browser clock for public visibility. Validate `fechaFin > fechaInicio` and reject invalid discount values.

- [ ] **Step 3: Add promotion form and image preview**

Allow selecting all products, one category, or selected products. Show a preview matching the public banner dimensions.

- [ ] **Step 4: Run focused tests and build**

Verify existing seeded promotions still render and new promotions can be created with Cloudinary URLs.

- [ ] **Step 5: Commit promotions**

```bash
git add apps/api apps/web packages/shared
git commit -m "feat: add scheduled promotion management"
```

### Task 6: Add dashboard aggregates and zone analytics

**Files:**
- Create: `apps/api/src/routes/admin.ts`
- Create: `apps/api/src/admin/dashboard.ts`
- Create: `apps/web/src/pages/admin/DashboardAdmin.tsx`
- Create: `apps/web/src/components/admin/AdminFilters.tsx`
- Create: `apps/web/src/components/admin/SalesCharts.tsx`
- Create: `apps/web/src/components/admin/ZoneSalesMap.tsx`
- Modify: `apps/web/src/pages/Admin.tsx`
- Modify: `apps/api/src/app.ts`
- Test: dashboard query and aggregation tests

**Interfaces:**
- `GET /api/admin/dashboard?desde=&hasta=&departamento=&municipio=&categoriaId=&productoId=&estado=` returns cards, time series, top products, category totals, low stock, and zone totals.
- `GET /api/admin/dashboard/zones` returns department/municipality totals suitable for a Honduras map and ranked table.

- [ ] **Step 1: Add failing aggregation tests with fixed orders**

Cover date boundaries, department grouping, municipality grouping, cancelled/returned order handling, zero-order periods, and low-stock threshold behavior.

- [ ] **Step 2: Implement parameterized Prisma aggregates**

Use database grouping and bounded date filters. Keep raw order/customer details out of aggregate responses. Require admin middleware on every route.

- [ ] **Step 3: Add chart dependency only if not already available**

Use Recharts for line, bar, pie/donut, and area charts. Add a lightweight Honduras SVG/GeoJSON asset only if licensing and bundle size are acceptable; otherwise show a department heat table with a map-ready data contract.

- [ ] **Step 4: Implement the dashboard layout**

Add the filter bar, summary cards, sales trend, zone ranking/map, top products, category distribution, and low-stock panel. All charts must show loading, empty, and error states.

- [ ] **Step 5: Verify responsive behavior and accessibility**

Check keyboard navigation, readable chart labels, color-independent legends, and mobile stacking.

- [ ] **Step 6: Commit dashboard analytics**

```bash
git add apps/api apps/web packages/shared
git commit -m "feat: add admin dashboard and zone analytics"
```

### Task 7: Upgrade orders, navigation, security, and deployment

**Files:**
- Create: `apps/web/src/pages/admin/PedidoDetalle.tsx`
- Create: `apps/web/src/components/admin/AdminSidebar.tsx`
- Modify: `apps/web/src/pages/Admin.tsx`
- Modify: `apps/web/src/components/Layout.tsx`
- Modify: `apps/api/src/middleware/auth.ts` only if role checks need tightening
- Test: end-to-end admin smoke tests

- [ ] **Step 1: Add the sidebar and responsive admin shell**

Keep the admin visual language distinct from the customer storefront while reusing safe base components.

- [ ] **Step 2: Add order search, filters, detail, and status transitions**

Preserve existing order state rules and show validation errors when an invalid transition is attempted.

- [ ] **Step 3: Add audit-safe permission tests**

Verify anonymous users, regular users, and admins against every admin endpoint, including upload and dashboard routes.

- [ ] **Step 4: Run the complete verification suite**

```bash
npm run typecheck --workspaces --if-present
npm run build
```

Manually verify: admin login, upload, product creation, promotion scheduling, dashboard filters, zone totals, order update, public catalog visibility, and mobile layout.

- [ ] **Step 5: Deploy API and web in Railway**

Confirm `CLOUDINARY_URL` exists only on `Gina_Boutique`, verify `Gina_Web` has only public build variables, run migrations, and inspect deployment logs and health endpoints.

- [ ] **Step 6: Commit and push the completed phase**

```bash
git add apps/api apps/web packages/shared docs
git commit -m "feat: complete administrator back office"
git push origin claude/gina-boutique-setup-vetm41
```

## Verification Checklist

- Existing 15 seeded products remain visible and valid.
- Existing orders continue to render and change state.
- A non-admin cannot call product, category, promotion, upload, or dashboard admin endpoints.
- Admin can upload multiple images and create a product without entering URLs manually.
- Product images persist after a Railway redeploy.
- Promotion visibility respects server time and active state.
- Dashboard totals match filtered orders and group correctly by department and municipality.
- Public storefront never receives Cloudinary credentials.
- API and web build successfully before each deployment.

