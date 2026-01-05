# TanStack Ecosystem Migration Plan

> **Branch Strategy**: All work in this plan should be performed on a dedicated feature branch `feature/tanstack-alignment` created from `master`. Complex phases (Phase 4+) should use sub-branches.

---

## Overview

This document outlines a phased approach to align the Pivotr Mailer codebase with TanStack ecosystem best practices. Changes are sequenced by dependency order and risk level—foundational changes first; complex refactors last.

**Reference**: [TanStack Documentation](https://tanstack.com/)

---

## Branch Strategy

```
master
  └── feature/tanstack-alignment (main work branch)
        ├── Phase 1-3: Direct commits
        ├── feature/tanstack-alignment/table (Phase 4)
        ├── feature/tanstack-alignment/loaders (Phase 5)
        └── feature/tanstack-alignment/virtual (Phase 6)
```

### Branch Commands

1. **Create main feature branch**:
   - Create branch `feature/tanstack-alignment` from `master`
   - All Phase 1-3 work commits directly here

2. **Sub-branches for complex phases**:
   - Phase 4: `feature/tanstack-alignment/table`
   - Phase 5: `feature/tanstack-alignment/loaders`
   - Phase 6: `feature/tanstack-alignment/virtual`
   - Merge each sub-branch back to `feature/tanstack-alignment` upon completion

3. **Final merge**:
   - Merge `feature/tanstack-alignment` to `master` after all phases complete

---

## Phase 1: Query Devtools Enhancement

**Priority**: Low Effort, High Value  
**Estimated Effort**: 30 minutes  
**Branch**: `feature/tanstack-alignment` (direct commit)

### Objective

Add dedicated React Query Devtools panel for enhanced debugging capabilities during development. This enables visibility into the Query cache for all subsequent phases.

### Files to Modify

| File | Change |
|------|--------|
| `frontend/package.json` | Add `@tanstack/react-query-devtools` dependency |
| `frontend/src/routes/__root.tsx` | Import and render `ReactQueryDevtools` component |

### Technical Instructions

1. **Install Dependency**
   - Add `@tanstack/react-query-devtools` using Bun
   - Refer to: [React Query Devtools Installation](https://tanstack.com/query/latest/docs/framework/react/devtools)

2. **Configure Devtools**
   - Import `ReactQueryDevtools` from `@tanstack/react-query-devtools`
   - Add as a child of `QueryClientProvider` in the root document
   - Configure `initialIsOpen` to `false` for non-intrusive default
   - The devtools automatically exclude themselves from production builds

3. **Verification**
   - Run development server
   - Confirm floating devtools button appears in bottom-right corner
   - Click to open and verify Query cache visibility

### Official Documentation

- [React Query Devtools](https://tanstack.com/query/latest/docs/framework/react/devtools)

---

## Phase 2: Query Key Factory (Foundational)

**Priority**: High (Must complete before any hook refactoring)  
**Estimated Effort**: 1-2 hours  
**Branch**: `feature/tanstack-alignment` (direct commit)

### Objective

Establish a centralized Query Key Factory **before** refactoring any hooks. This ensures all new and updated hooks use consistent, type-safe keys from day one—avoiding rework.

### Files to Create/Modify

| File | Change |
|------|--------|
| `frontend/src/lib/query-keys.ts` | **NEW FILE**: Centralized key factory |
| `frontend/src/features/auth/hooks.ts` | Update to use factory |
| `frontend/src/features/leads/hooks/use-leads.ts` | Update to use factory |
| `frontend/src/features/settings/hooks/use-settings.ts` | Update to use factory |

### Technical Instructions

1. **Create Query Key Factory File**
   - Create `frontend/src/lib/query-keys.ts`
   - Define typed key factories for each domain using the factory pattern
   - Refer to: [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)

2. **Define Key Factories**
   - Structure keys hierarchically for granular invalidation:
     - `authKeys.all` → Base key for all auth queries
     - `authKeys.account()` → User account data
     - `authKeys.session()` → Current session
     - `leadsKeys.all` → Base key for all leads queries
     - `leadsKeys.list(page, limit, search)` → Paginated leads list
     - `leadsKeys.detail(id)` → Single lead detail
     - `campaignKeys.all` → Base key for campaigns
     - `campaignKeys.active()` → Currently active campaign
     - `campaignKeys.list()` → All campaigns
     - `settingsKeys.all` → Settings document
     - `logsKeys.all` → Base key for logs
     - `logsKeys.recent()` → Recent logs for dashboard

3. **Update Existing Hooks**
   - Replace inline key arrays with factory function calls in:
     - `authKeys` in `hooks.ts` (e.g., `AUTH_KEYS.account` → `authKeys.account()`)
     - `leadsKeys` in `use-leads.ts`
     - `settingsKeys` in `use-settings.ts`

4. **Verification**
   - Run development server
   - Open Query Devtools and verify consistent key structure
   - Confirm all queries still function correctly
   - Run `bun lint` and `bun check`

### Official Documentation

- [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
- [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)

---

## Phase 3: Dashboard Hook Refactor

**Priority**: High (Critical anti-pattern fix)  
**Estimated Effort**: 2-3 hours  
**Branch**: `feature/tanstack-alignment` (direct commit)

### Objective

Replace manual `useState`/`useEffect` data fetching pattern in `useDashboard` with proper TanStack Query hooks, using the Query Key Factory from Phase 2.

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/features/dashboard/hooks/use-dashboard.ts` | Complete rewrite |
| `frontend/src/routes/index.tsx` | Update to use new hook API (if interface changes) |

### Technical Instructions

1. **Identify Current State Variables**
   - `activeCampaign`: Campaign data (fetched once, updated via realtime)
   - `recentLogs`: Log array (fetched once, appended via realtime)
   - `isLoading`: Manual loading flag

2. **Create Separate Query Hooks**
   - Define `useCampaign` query with:
     - Query key: Use `campaignKeys.active()` from Phase 2 factory
     - Query function fetching latest campaign from Appwrite
     - Refer to: [useQuery Documentation](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)
   
   - Define `useRecentLogs` query with:
     - Query key: Use `logsKeys.recent()` from Phase 2 factory
     - Query function fetching recent logs from Appwrite

3. **Integrate Realtime Updates with Query Cache**
   - Use `queryClient.setQueryData` to update cache on realtime events
   - This replaces `setState` calls with cache mutations
   - For campaign updates: Update the cached campaign object directly
   - For log additions: Append new logs to the cached array
   
   > ⚠️ **GOTCHA: Invalidation vs SetQueryData**
   > Manual cache manipulation via `setQueryData` is performant but complex and error-prone (e.g., sorting order might break when appending logs). If the logic gets too complex, fall back to `queryClient.invalidateQueries({ queryKey: [...] })`. This forces a refetch—slightly less efficient but guarantees data consistency.
   
   > 💡 **PRO-TIP: Decision Heuristic**
   > - **Single Documents** (e.g., Active Campaign Status): Use `setQueryData`. Replacing one object in the cache is simple and feels instant.
   > - **Lists** (e.g., Recent Logs): Use `invalidateQueries`. Realtime events don't indicate page position or sort order—manually splicing a list correctly is error-prone. Invalidation ensures the list is always accurate.
   - Refer to: [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)
   - Refer to: [Updates from Mutation Responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses)

4. **Replace Manual Loading State**
   - Remove `useState` for `isLoading`
   - Use `isPending` from the query hooks
   - Optionally use `isRefetching` for background refresh indicators

5. **Create Mutation Hook for Campaign Status**
   - Define `useUpdateCampaignStatus` mutation
   - Use `useMutation` with proper cache invalidation on success
   - Use `campaignKeys.active()` for invalidation
   - Refer to: [useMutation Documentation](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation)

6. **Verification**
   - Dashboard should load data correctly
   - Loading skeleton should appear during initial fetch
   - Realtime updates should reflect in UI
   - Query cache should be visible in Devtools with correct keys

### Official Documentation

- [useQuery](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)
- [useMutation](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation)
- [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)
- [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)

---

## Phase 4: TanStack Table for Leads

**Priority**: Medium  
**Estimated Effort**: 4-6 hours  
**Branch**: `feature/tanstack-alignment/table` (sub-branch)

### Objective

Replace manual array mapping in `LeadsTable` with TanStack Table for enhanced sorting, filtering, and pagination capabilities.

### Files to Modify

| File | Change |
|------|--------|
| `frontend/package.json` | Add `@tanstack/react-table` dependency |
| `frontend/src/features/leads/components/leads-table.tsx` | Complete refactor |
| `frontend/src/features/leads/hooks/` | New file: `use-leads-table.ts` (optional) |

### Technical Instructions

1. **Install Dependency**
   - Add `@tanstack/react-table` using Bun
   - Refer to: [TanStack Table Installation](https://tanstack.com/table/latest/docs/installation)

2. **Define Column Definitions**
   - Create column definitions array using `createColumnHelper` or inline definitions
   - Define columns for: Email, Full Name, Company, Status, Verification, Actions
   - Use `cell` property for custom rendering (badges, buttons)
   - Refer to: [Column Definitions](https://tanstack.com/table/latest/docs/guide/column-defs)

3. **Configure Table Instance**
   - Use `useReactTable` hook with:
     - `data`: Leads array from `useLeads` hook
     - `columns`: Column definitions
     - `getCoreRowModel`: Required for basic functionality
     - `manualPagination: true`: Since pagination is server-side
     - `pageCount`: Total pages from `useLeads` response
   - Refer to: [Table Instance](https://tanstack.com/table/latest/docs/framework/react/react-table)

4. **Integrate with Router State (CRITICAL)**
   > ⚠️ **URL as Single Source of Truth**: Do NOT use local state for pagination.
   
   - The table `state.pagination` must directly read from `useSearch()` params
   - Use `onPaginationChange` callback to trigger `navigate()` and update the URL
   - This ensures the URL remains the Single Source of Truth for pagination state
   
   > ⚠️ **GOTCHA: validateSearch is Mandatory**
   > For `useSearch()` to be type-safe (and for the table to work correctly), the `leads.tsx` route **must** export a `validateSearch` function using Zod. The route already has this—ensure it includes `page` and `limit` params with `.catch()` fallbacks for type safety.
   - Do NOT call `table.nextPage()` / `table.previousPage()` (which updates internal table state)
   - Instead, navigation buttons should update URL params directly
   - Refer to: [Manual Pagination](https://tanstack.com/table/latest/docs/guide/pagination#manual-pagination)

5. **Integrate with Existing shadcn Table Components**
   - TanStack Table is headless—continue using your existing `Table`, `TableRow`, `TableCell` components
   - Map table header groups to `<TableHeader>` and rows to `<TableBody>`
   - Use `row.getVisibleCells()` for cell rendering
   - Refer to: [Rendering Guide](https://tanstack.com/table/latest/docs/guide/tables)

6. **Optional Enhancements**
   - Add column visibility toggle
   - Add client-side sorting for sortable columns
   - Add column resizing

7. **Verification**
   - Table renders correctly with all columns
   - Pagination works via URL params (browser back/forward should work)
   - Status badges and action buttons function correctly
   - No visual regression from current implementation

### Official Documentation

- [TanStack Table Overview](https://tanstack.com/table/latest/docs/overview)
- [React Table Quick Start](https://tanstack.com/table/latest/docs/framework/react/react-table)
- [Column Definitions](https://tanstack.com/table/latest/docs/guide/column-defs)
- [Pagination Guide](https://tanstack.com/table/latest/docs/guide/pagination)
- [Manual Pagination](https://tanstack.com/table/latest/docs/guide/pagination#manual-pagination)

---

## Phase 5: Route Loaders Integration

**Priority**: High (Architectural improvement)  
**Estimated Effort**: 6-8 hours  
**Branch**: `feature/tanstack-alignment/loaders` (sub-branch)

### Objective

Add TanStack Router Loaders to route definitions for server-side data pre-fetching and improved SSR capabilities. This phase also upgrades components to use `useSuspenseQuery` for the true "TanStack Way."

### SSR Pro-Tips (Read Before Implementation)

> 💡 **PRO-TIP 1: The "Hydration Stability" Rule**
> 
> **Context**: By default, TanStack Query has a `staleTime` of `0`.
> 
> **The Trap**: In TanStack Start, the server fetches data, sends it to the client (dehydrated), and the client hydrates it. If `staleTime` is `0`, the client immediately thinks the data is "stale" and triggers a background refetch on page load. This causes a "double fetch" (Server + Client) and wastes resources.
> 
> **Heuristic**: *"If the Server fetched it, trust it for a minute."*
> 
> **Action**: In `frontend/src/router.tsx` (or where you create the `QueryClient`), set a default `staleTime` of 60 seconds. Refer to: [Default Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)

> 💡 **PRO-TIP 2: The "Gatekeeper" Rule (`beforeLoad` vs `loader`)**
> 
> **Context**: You might be tempted to put Auth checks (e.g., redirect if not logged in) inside the `loader`.
> 
> **The Trap**: `loader` functions run in parallel with other route logic. If you put redirects inside `loader`, the router might still fetch other data or render parts of the tree before redirecting.
> 
> **Heuristic**: *"`beforeLoad` decides IF we go there. `loader` decides WHAT data we take."*
> 
> **Action**: For protected routes (`/settings`, `/leads`, `/`), perform authentication redirect checks in `beforeLoad`, not `loader`. Refer to: [beforeLoad](https://tanstack.com/router/latest/docs/framework/react/guide/navigation-blocking#using-beforeload)

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/routes/index.tsx` | Add `loader` export, upgrade to `useSuspenseQuery` |
| `frontend/src/routes/leads.tsx` | Add `loader` export, upgrade to `useSuspenseQuery` |
| `frontend/src/routes/settings.tsx` | Add `loader` export, upgrade to `useSuspenseQuery` |
| `frontend/src/routes/logs.tsx` | Add `loader` export |
| Related feature hooks | Refactor to support Suspense |

### Technical Instructions

1. **Understand Loader Pattern**
   - Loaders run before the route component renders
   - In TanStack Start, loaders can pre-populate the Query cache
   - Refer to: [TanStack Start Data Loading](https://tanstack.com/start/latest/docs/framework/react/guide/data-loading)

2. **Create Loader for Dashboard (`/`)**
   - Access `queryClient` from loader context
   - Use `queryClient.ensureQueryData` to pre-fetch:
     - Active campaign using `campaignKeys.active()`
     - Recent logs using `logsKeys.recent()`
   - This ensures data is in cache before component renders
   - Refer to: [ensureQueryData](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientensurequerydata)
   
   > ⚠️ **GOTCHA: Router Context Injection**
   > `queryClient` is NOT available in loader context by default. Verify that your `createRouter` configuration in `src/router.tsx` passes it in via the `context` option. The router context type must also be defined to include `queryClient: QueryClient`.

3. **Create Loader for Leads (`/leads`)**
   - Access search params from loader context
   - Pre-fetch leads list based on current page/search params
   - Use `leadsKeys.list(page, limit, search)` from key factory

4. **Create Loader for Settings (`/settings`)**
   - Pre-fetch settings document
   - Use `settingsKeys.all` from key factory

5. **Handle Appwrite Serialization (CRITICAL)**
   > ⚠️ **SSR Serialization**: TanStack Start Loaders run on the server. Data must be serializable.
   
   - Appwrite SDK responses may contain class instances or non-serializable data
   - Verify that all data returned from loaders is plain JSON
   - If Appwrite returns class instances, map them to plain objects before returning
   - Test SSR hydration to ensure no serialization errors occur

6. **Handle Loading States**
   - Loaders enable suspense-based loading
   - Add `pendingComponent` to route definitions for loading UI
   - Consider `pendingMinMs` for minimum loading display time
   - Refer to: [Pending UI](https://tanstack.com/router/latest/docs/framework/react/guide/pending-ui)

7. **Handle Errors**
   - Add `errorComponent` to route definitions for loader failures
   - Refer to: [Error Handling](https://tanstack.com/router/latest/docs/framework/react/guide/error-handling)

8. **Upgrade to useSuspenseQuery (CRITICAL)**
   > ⚠️ **The TanStack Way**: Once loaders guarantee data availability, switch to `useSuspenseQuery`.
   
   - Replace `useQuery` with `useSuspenseQuery` in components where loaders pre-fetch data
   - Remove `isPending` / `isLoading` checks from the component body
   - Let the Router's `pendingComponent` handle all loading states
   - This eliminates loading spinners inside components—they only render when data is ready
   - Refer to: [useSuspenseQuery](https://tanstack.com/query/latest/docs/framework/react/reference/useSuspenseQuery)

9. **Verification**
   - Page transitions should feel faster (data pre-loaded)
   - No flash of loading state on navigation (if cache is warm)
   - Loading states handled by Route's `pendingComponent`, not component internals
   - Query devtools should show pre-fetched queries
   - SSR should work correctly (verify no hydration mismatches)

### Official Documentation

- [TanStack Start Data Loading](https://tanstack.com/start/latest/docs/framework/react/guide/data-loading)
- [TanStack Router Loaders](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading)
- [External Data Loading](https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading)
- [Pending UI](https://tanstack.com/router/latest/docs/framework/react/guide/pending-ui)
- [useSuspenseQuery](https://tanstack.com/query/latest/docs/framework/react/reference/useSuspenseQuery)
- [Suspense Guide](https://tanstack.com/query/latest/docs/framework/react/guides/suspense)

---

## Phase 6: TanStack Virtual for Performance (Optional)

**Priority**: Low (Performance optimization)  
**Estimated Effort**: 3-4 hours  
**Branch**: `feature/tanstack-alignment/virtual` (sub-branch)

### Objective

Add list virtualization to the Dashboard console log to improve rendering performance with large datasets.

### Files to Modify

| File | Change |
|------|--------|
| `frontend/package.json` | Add `@tanstack/react-virtual` dependency |
| `frontend/src/features/dashboard/components/dashboard-console.tsx` | Implement virtualization |

### Prerequisites

- Phase 3 completed (Dashboard uses Query properly)

### Technical Instructions

1. **Install Dependency**
   - Add `@tanstack/react-virtual` using Bun
   - Refer to: [TanStack Virtual Installation](https://tanstack.com/virtual/latest/docs/installation)

2. **Analyze Current Console Component**
   - Identify the scrollable container element
   - Determine fixed vs variable row heights
   - Note: If rows have variable heights, use `measureElement` for dynamic measurement

3. **Implement Virtualizer**
   - Use `useVirtualizer` hook with:
     - `count`: Total number of log entries
     - `getScrollElement`: Reference to scroll container
     - `estimateSize`: Estimated row height in pixels
     - `overscan`: Number of items to render outside viewport (default: 1)
   - Refer to: [Virtualizer Options](https://tanstack.com/virtual/latest/docs/api/virtualizer)

4. **Render Virtual Items**
   - Replace direct `.map()` over logs with virtual items
   - Use `virtualizer.getVirtualItems()` to get visible items
   - Apply `position: absolute` and `transform` for positioning
   - Set container height to `virtualizer.getTotalSize()`
   - Refer to: [React Virtual Example](https://tanstack.com/virtual/latest/docs/framework/react/examples/dynamic)

5. **Handle Auto-Scroll**
   - Maintain existing auto-scroll-to-bottom behavior
   - Use `virtualizer.scrollToIndex` for programmatic scrolling
   - Consider scroll anchor for new items

6. **Verification**
   - Console should render correctly
   - Add 500+ log items and verify smooth scrolling
   - Confirm DOM only contains ~10-20 items regardless of list size
   - Test auto-scroll behavior with new log entries

### Official Documentation

- [TanStack Virtual Overview](https://tanstack.com/virtual/latest/docs/introduction)
- [useVirtualizer](https://tanstack.com/virtual/latest/docs/api/virtualizer)
- [Dynamic Height Example](https://tanstack.com/virtual/latest/docs/framework/react/examples/dynamic)

---

## Phase 7: Final Cleanup & Package Audit

**Priority**: Low (Post-migration hygiene)  
**Estimated Effort**: 1-2 hours  
**Branch**: `feature/tanstack-alignment` (direct commit, after all phases merge)

### Objective

Perform a comprehensive cleanup after all migration phases are complete. Audit packages for unused dependencies, remove dead code, and ensure consistent patterns throughout the codebase.

### Files to Audit

| Area | Files |
|------|-------|
| Package Dependencies | `frontend/package.json` |
| All Hook Files | `frontend/src/features/**/hooks/`, `frontend/src/hooks/` |
| Route Files | `frontend/src/routes/*.tsx` |
| Utility Files | `frontend/src/lib/` |

### Technical Instructions

1. **Audit Unused Dependencies**
   - Review `package.json` for packages no longer needed after migration
   - Check for duplicates or superseded packages
   - Run `npx depcheck` or manually audit for:
     - Unused utility libraries
     - Old form libraries (if migrated away)
     - Redundant state management packages
   - Remove unused dependencies using `bun remove <package>`

2. **Remove Dead Imports**
   - Run `bun lint` with Biome to identify unused imports
   - Remove all unused import statements across the codebase
   - Ensure no "orphan" exports exist in utility files

3. **Audit Error Handling Consistency**
   - Ensure all queries have appropriate `retry` configuration
   - Verify `onError` callbacks are consistent across mutations
   - Consider global error handler via `QueryClient` configuration

4. **Verify Hook Patterns**
   - Confirm all hooks use the Query Key Factory from Phase 2
   - Ensure no inline query keys remain
   - Check that all mutations properly invalidate related queries

5. **Run Full Lint & Type Check**
   - Run `bun lint` and fix all issues
   - Run `bun check` for full Biome validation
   - Run `bun tsc --noEmit` for TypeScript validation
   - Ensure no warnings or errors

6. **Documentation Update**
   - Update `AGENTS.md` if any conventions changed
   - Document new patterns in relevant skill files if needed

### Official Documentation

- [Query Client Configuration](https://tanstack.com/query/latest/docs/framework/react/reference/QueryClient)

---

## Deferred Items (Not Planned)

The following items from the gap analysis are **intentionally not adopted**:

### ❌ TanStack Form (Firm Decision)

**Reason**: The current `react-hook-form` implementation is mature, well-integrated with shadcn/ui Form components, and provides all needed functionality. Migration would require significant effort with minimal benefit.

**Status**: Will continue using `react-hook-form` with `@hookform/resolvers` + Zod.

### ⚠️ TanStack Store (Conditional)

**Reason**: Current client state needs are minimal (sidebar toggle, theme). Existing patterns using `localStorage`, `next-themes`, and module-level state are sufficient.

**Reconsider if**: You need complex derived state, state machines, or cross-component state that Context cannot elegantly handle.

### ❌ Server Functions for Mutations (Firm Decision)

**Reason**: Direct Appwrite SDK calls work well for this architecture. Server Functions add complexity without clear benefit for BaaS patterns.

**Status**: Will continue using Appwrite SDK directly for all mutations.

---

## Checklist Summary

### Phase 1: Query Devtools
- [ ] Install `@tanstack/react-query-devtools`
- [ ] Add `ReactQueryDevtools` to root layout
- [ ] Verify devtools appear in development

### Phase 2: Query Key Factory
- [ ] Create `frontend/src/lib/query-keys.ts`
- [ ] Define typed key factories for all domains
- [ ] Update `auth/hooks.ts` to use factory
- [ ] Update `use-leads.ts` to use factory
- [ ] Update `use-settings.ts` to use factory
- [ ] Verify key structure in Devtools

### Phase 3: Dashboard Refactor
- [ ] Create `useCampaign` query hook using factory keys
- [ ] Create `useRecentLogs` query hook using factory keys
- [ ] Integrate realtime with Query cache updates
- [ ] Create `useUpdateCampaignStatus` mutation
- [ ] Remove manual loading state
- [ ] Update Dashboard component

### Phase 4: TanStack Table
- [ ] Install `@tanstack/react-table`
- [ ] Define column definitions
- [ ] Configure table instance with `manualPagination`
- [ ] Integrate pagination with Router URL params (SSOT)
- [ ] Integrate with shadcn Table components
- [ ] Verify pagination works via URL

### Phase 5: Route Loaders
- [ ] Add loader to Dashboard route
- [ ] Add loader to Leads route
- [ ] Add loader to Settings route
- [ ] Verify Appwrite data serialization for SSR
- [ ] Configure `pendingComponent` and `errorComponent`
- [ ] Upgrade to `useSuspenseQuery` in loader-enabled routes
- [ ] Remove loading state logic from components

### Phase 6: Virtual (Optional)
- [ ] Install `@tanstack/react-virtual`
- [ ] Implement virtualizer for console
- [ ] Verify auto-scroll behavior

### Phase 7: Final Cleanup & Package Audit
- [ ] Audit `package.json` for unused dependencies
- [ ] Remove unused imports across codebase
- [ ] Verify all hooks use Query Key Factory
- [ ] Audit error handling consistency
- [ ] Run `bun lint`, `bun check`, and TypeScript validation
- [ ] Update documentation if patterns changed

---

## References

| Library | Documentation |
|---------|---------------|
| TanStack Start | https://tanstack.com/start/latest/docs/framework/react/overview |
| TanStack Router | https://tanstack.com/router/latest/docs/framework/react/overview |
| TanStack Query | https://tanstack.com/query/latest/docs/framework/react/overview |
| TanStack Table | https://tanstack.com/table/latest/docs/overview |
| TanStack Virtual | https://tanstack.com/virtual/latest/docs/introduction |
| TanStack Store | https://tanstack.com/store/latest/docs/overview |

---

*Document created: 2026-01-05*  
*Revised: 2026-01-05 (Phase reordering, Table state sync, Suspense upgrade)*  
*Based on: tanstack_gap_analysis.md*
