# Phase 2 Frontend Implementation: Pivotr Mailer

**Status**: APPROVED  
**Context**: Phase 2 (Frontend Implementation)  
**Stack**: TanStack Start (React 19), Appwrite (Self-Hosted), Tailwind CSS v4, Bun  
**Aesthetic**: Industrial / Utilitarian (Strict Shadcn UI)

---

## 1. Purpose & Scope

This document defines the authoritative implementation strategy for the Pivotr Mailer frontend. It translates the Product Requirements Document (PRD) into strict technical directives for the engineering team.

### 1.1 In-Scope (Phase 2 Delivery)
The following deliverables are mandatory:
*   **Dashboard**: Real-time visualization of the automated sending loop, queue status, and system health.
*   **Lead Management**: Interface for manual entry, CSV/Excel import, editing, and list management.
*   **Template Editor**: Spintax-aware email composing interface with live preview and variable injection validation.
*   **Metrics View**: Read-only visualization of the `Metrics` table (Sent, Bounced, Rejected, Open Rates). **Note: Metrics definitions are provisional and subject to final PRD freeze.**
*   **Authentication UX**: Integration with existing Appwrite Auth Sessions (Login/Logout/Recovery).

### 1.2 Out-of-Scope
*   **Backend Logic Changes**: No changes to `orchestrator.ts`, `JobManager`, or the core event loop unless strictly required for frontend data contracts.
*   **New Infrastructure**: No changes to Docker Compose or Traefik configurations.
*   **Auth Provider Configuration**: Google Workspace SSO setup is assumed to be pre-configured on the backend.

---

## 2. Application Structure (TanStack Start)

The application utilizes **TanStack Start** with file-based routing. All new routes must be strict and typed.

### 2.1 Route Ownership & Hierarchy
Routes adhere to the following `src/routes` structure:
*   `__root.tsx`: Global layout (Sidebar, Toast Provider, Auth Guard).
*   `index.tsx`: **Dashboard** (Home).
*   `leads.tsx`: **Lead Management** (List & Actions).
*   `templates.tsx`: **Template Editor**.
*   `settings.tsx`: **Configuration** (API Keys, Limits).
*   `logs.tsx`: **Audit Logs** (Historical searchable table).
*   `login.tsx`: Public login route (Unauthenticated).

### 2.2 Colocation Strategy
Code must be colocated by **Feature**, not by Type.
*   **Do NOT** use global `src/components` for feature-specific functionality.
*   **DO** use `src/features/<feature_name>/` for domains.

**Structure Example:**
```text
src/
├── features/
│   ├── dashboard/       # Dashboard widgets, live feed
│   ├── leads/           # Import UI (Upload only), DataTables
│   ├── templates/       # Spintax editor, Preview engine
│   └── shared/          # Truly global UI (Layouts, Nav)
├── components/          # Shadcn UI primitives (Button, Card) only
└── routes/              # Route definitions (Data loaders, Page shells)
```

---

## 3. State Management Strategy

### 3.1 Server State (Dominant)
90% of application state is **Server State** managed via **TanStack Query** (integrated in TanStack Start).
*   **Fetch**: All data fetching uses `useQuery` or `useSuspenseQuery`.
*   **Mutations**: All write operations use `useMutation` with strict cache invalidation (`queryClient.invalidateQueries`).
*   **Loaders**: Use TanStack Router `loader` functions to prefetch critical data before rendering.

### 3.2 URL State (Navigation)
Use URL Search Params for all ephemeral UI states to ensure shareability and persistence on reload.
*   **Leads Table**: `?page=1&search=...&status=valid`
*   **Logs**: `?filter=error&limit=100`

### 3.3 Real-Time & Hybrid State (Hybrid Model)
**Realtime subscriptions are the primary data channel.** Health polling exists only as a liveness detector and must **never** mutate state.
*   **Dashboard**: Subscribe to `databases.logs` and `databases.metrics` for live flow.
*   **Queue**: Subscribe to `databases.leads`.
*   **Health Check**: Poll `/health` every 5s. If fails -> Show "Reconnecting". If succcess -> Re-establish Realtime.

---

## 4. Data Flow & Backend Interaction

### 4.1 Read Patterns
*   **Strict Contracts**: All data received from Appwrite must be validated against shared Zod schemas in `shared/types`.
*   **Suspense**: UI must use React `Suspense` limits.

### 4.2 Write Patterns
*   **Actions**: Writes via Appwrite SDK.
*   **Optimistic Updates**: 
    *   **Allowed**: Draft changes, User Settings.
    *   **PROHIBITED**: Lead Status changes (e.g., "Skip") or Campaign Control (Start/Stop). These MUST wait for server ACK to prevent "phantom" states during rollbacks.

### 4.3 JIT Verification Visualization
The Phase 2 frontend must visualize the backend's "Just-In-Time" verification pipeline.
*   **Status Indicators**: The UI must distinctively show: `Pending` -> `Verifying` (Spinner) -> `Valid` (Green) / `Invalid` (Red).
*   **Latency Handling**: The UI must tolerate the 1-3s latency of the verification API without freezing; use non-blocking background updates.

---

## 5. Component Architecture

### 5.1 Design System (Shadcn UI)
*   **Strict Adherence**: Use **ONLY** Shadcn UI components.
*   **Styling**: Tailwind CSS v4. No custom CSS files locally.
*   **Aesthetic**: **Industrial / Utilitarian**.
    *   High contrast borders.
    *   Monospace fonts for data/logs (`font-mono`).
    *   Dense data displays (compact tables).
    *   Minimal padding; maximize screen real estate for data.

### 5.2 Feature Components
*   **DashboardConsole**: A terminal-like component for the Activity Log. **NOT** the audit trail. Streaming, severity-based.
*   **AuditLogTable**: (For `logs.tsx`) A generic DataTable supporting deep introspection of JSON payloads (Verifier Response, SES ID) and filtering by Lead/Campaign. Immutable history.
*   **NameParserReview**: A dedicated UI element in `leads.tsx` (Column or Drawer) to manually review and correct the "Parsed First Name" output. Must allow manual override and persist confirmation.
*   **SpintaxEditor**:
    *   **Inputs**: Separate `Input` for **Subject** and `Textarea` for **Body**.
    *   **Preview**: "Live Preview" side-panel showing combined result (Subject + Body) for validation.
*   **MetricCard**: Standardized card for high-level stats.

---

## 6. UX and Interaction Rules

### 6.1 Feedback & Transitions
*   **Toast Notifications**: Use `sonner` (via Shadcn) for all operation results (Success/Error).
*   **Destructive Actions**: "Delete Lead" or "Abort Campaign" require a confirmation dialog (Shadcn `AlertDialog`).
*   **Loading**: Use `Skeleton` loaders that mimic the final layout structure.

### 6.2 Accessibility (A11y)
*   **Keyboard Navigation**: Full support for Tab navigation in Forms and DataTables.
*   **Focus Management**: Focus must return to the trigger element after closing Modals/Dialogs.

---

## 7. Non-Functional Requirements

### 7.1 Performance
*   **Virtualization**: The Leads list may contain 10,000+ records. Use `@tanstack/react-virtual` for the table rendering.
*   **Bundle Size**: Lazy load the `SpintaxEditor` and `HighCharts/Recharts` libraries; do not include them in the main bundle.

### 7.2 Resilience
*   **Connection Loss**: Display a global "Offline - Reconnecting..." banner if Appwrite connectivity is lost (catch network errors in SWR/Query).
*   **Graceful Degradation**: If Metrics fail to load, the Controls (Start/Stop) must still function.

---

## 8. Edge Cases & Failure Modes

*   **Auth Session Expiry**: If a 401/403 is received during a background polling/subscription, immediately redirect to `/login` with a `?redirect` param.
*   **System Recovery**: On app load, detect resumed state and show a distinct **Recovery Banner**: "Session Restored. Resumed from Lead #X at HH:MM".
*   **API Outages**:
    *   **Verifier Down**: Show subtle warning badge "Verification Delayed - Retrying".
    *   **SES Throttled**: Show "Sending Paused - Cooling Down" status.
*   **Partial Import Failure**: If 90/100 leads import but 10 fail validation, show a distinct "Partial Success" dialog listing the failed rows.

---

## 9. Analytics, Logging, and Observability

### 9.1 Frontend Logging
*   **Console**: Clean console. No development logs (`console.log`) in production builds.
*   **Error Boundary**: Use a root-level `ErrorBoundary` to catch React crashes and display a "Copy Error Stack" button for debugging.

---

## 10. Implementation Guidelines & Guardrails

### 10.1 MUST DO
*   **Type Everything**: No `any`. Use `zod` for runtime validation of external data.
*   **Use Shared Logic**: Spintax preview **MUST** import `resolver.ts` from the `shared/` directory to ensure parity with backend.
*   **Import Strategy**: CSV Parsing **MUST** happen on backend (`import-leads` function). Frontend only uploads the file.
*   **Use Hooks**: encapsulate logic in `use<Feature>` hooks.
*   **Follow SKILL.md**: Verify aesthetic choices against the "Distinctive" rule (avoid generic spacing/colors).

### 10.2 MUST NOT DO
*   **No Global State Libraries**: Do not install Redux, Zustand, or Recoil. Use React Context only for dependency injection (like Toast/Theme).
*   **No Raw Styles**: Do not use `style={{}}` props. Use Tailwind classes.
*   **No Magic Strings**: All labels/status-codes must use Constants or Enums from `shared/`.
