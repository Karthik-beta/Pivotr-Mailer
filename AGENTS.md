# AI Agent Guidelines for Pivotr Mailer

This document provides context and guidelines for AI coding agents working on the Pivotr Mailer project.

---

## 📌 Custom Instructions

<!-- Add your custom instructions below this line -->
### 1. Source of Truth Rule

Always prefer **official documentation** over custom solutions.

- Use official docs of the framework, library, or tool being used
- Do NOT invent abstractions, helpers, wrappers, or alternate implementations
- Do NOT re-implement features that already exist in the official API
- If an official solution exists, it must be used as-is

If documentation is unclear or missing, ask before proceeding.

---

### 2. No Custom Implementations Policy

You must not:
- Create custom replacements for existing platform features
- Introduce parallel systems that overlap with official functionality
- Solve problems already addressed by the underlying framework

Favor **configuration and composition**, not reinvention.

---

### 3. UI Development Rules (Strict)

All UI must use **shadcn/ui components only**.

- Components must be installed using `bunx shadcn-ui@latest add <component>`
- Do NOT manually recreate shadcn components
- Do NOT create custom UI components that duplicate shadcn behavior
- Styling must follow shadcn conventions and structure

If a required UI element does not exist in shadcn:
- Stop and ask before implementing anything custom

---

### 4. Frontend Skill Adherence

When working on frontend code, you must strictly follow the skills and patterns defined in:

`.agent/skills/frontend-skill/SKILL.md`

- Treat this file as mandatory guidance
- Do not bypass or contradict the practices defined there
- Use the documented patterns, tools, and conventions consistently

If a requirement conflicts with this skill file, pause and ask.

---

### 5. Change Discipline

- Do only what is requested
- Do not refactor unrelated code
- Do not introduce new dependencies unless explicitly asked
- Do not optimize or redesign unless instructed

Small, correct, documented changes are preferred over clever solutions.

---

### 6. General Principle

This codebase values:
- Predictability over creativity
- Official patterns over custom logic
- Consistency over novelty

When in doubt, choose the **most boring solution that aligns with official docs**.

---

### 7. Strict TypeScript & Shared Contract Rule

All code must be written using **strict TypeScript** principles.

- Do not disable strictness
- Do not use `any`, implicit `any`, or unsafe type assertions
- Prefer explicit, well-defined types and interfaces
- Types must accurately model real data and behavior

Shared logic must be centralized.

- Common types, schemas, constants, and contracts must live in the `shared/` folder
- Do not duplicate types across frontend and functions
- Frontend and backend must consume shared definitions instead of redefining them

If a required type or contract does not exist:
- Create it in `shared/`
- Reuse it everywhere consistently

Type safety and shared contracts are non-negotiable.

---
### 8. Dependency Installation & Version Authority Rule

Dependency versions must be resolved **only by the package manager**, never manually guessed or hardcoded.

When adding a new dependency:

- You must **not** manually write or edit version numbers in `package.json`
- You must **not** copy versions from blogs, examples, StackOverflow, or old documentation
- You must **not** pin versions unless explicitly instructed

The correct workflow is mandatory:

1. Add the dependency using a Bun command  
   - `bun add <package-name>`  
   - `bun add -d <package-name>`
2. Allow Bun to resolve and install the **latest stable version**
3. Let Bun update `package.json` and `bun.lock` automatically

`package.json` is an output of the install process, not a manual input file.

#### Version Freshness Principle

- Always assume written examples may be outdated
- Always trust the package registry over documentation snippets
- Prefer latest stable releases unless compatibility constraints are explicitly stated

If a dependency version matters for compatibility:
- Ask before pinning
- Do not assume or infer version requirements

#### Lockfile Integrity

- `bun.lock` is the single source of truth for resolved versions
- Do not modify `bun.lock` manually
- Do not introduce `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`

#### Prohibited Actions

You must not:
- Manually edit dependency versions in `package.json`
- Install packages using `npm`, `yarn`, or `pnpm`
- Downgrade packages unless explicitly instructed
- Add speculative version constraints

Dependency management must remain **deterministic, reproducible, and current**.

---
### 9. Business Logic Structure & Purity Rule

All business logic must be implemented inside the `functions/` directory and must follow **clear separation, modularity, and purity principles**.

#### Business Logic Ownership

- Business logic represents **domain rules and decisions**, not infrastructure or framework behavior
- Business logic must not depend on UI, SDK wiring, HTTP handlers, or platform-specific APIs
- Each business capability must have a **single, well-defined responsibility**

Business logic must answer questions like:
- What is allowed?
- What happens next?
- Under what conditions should an action succeed or fail?

#### Structural Organization

Business logic must be:
- Well-organized into folders and files based on **intent and behavior**
- Grouped by domain or use case, not by technical detail
- Easy to locate, understand, and reason about in isolation

You must not:
- Place all logic in a single file
- Create large monolithic functions
- Intertwine unrelated business rules

Each business capability should:
- Live in its own module
- Be independently readable and testable
- Have a clear entry point and clear outcomes

#### One Function, One Purpose

Each Appwrite Function must:
- Represent a **single business operation**
- Own a distinct workflow or decision set
- Not contain logic unrelated to its declared purpose

Do not create:
- “God functions”
- Catch-all handlers
- Multi-purpose workflows hidden behind flags or conditionals

If logic grows beyond a single responsibility:
- Extract it into separate modules
- Recompose it explicitly

#### Purity Requirement

Business logic must be **pure and domain-focused**.

It must not include:
- Appwrite SDK calls
- HTTP request or response handling
- Database client wiring
- Utility helpers (date, string, formatting, IO, etc.)
- Infrastructure concerns (logging, retries, environment access)

Business logic should:
- Accept inputs as typed data
- Return explicit results or decisions
- Remain independent of execution environment

Infrastructure code may call business logic, but business logic must never depend on infrastructure.

#### Documentation Requirement

All business logic must be documented.

Documentation should clearly state:
- The intent of the logic
- The business rule being enforced
- Inputs and expected outputs
- Any important assumptions or constraints

Documentation must explain **why the rule exists**, not just what the code does.

#### Guiding Principle

Business logic must be:
- Modular
- Explicit
- Isolated
- Documented
- Composable

If business logic cannot be understood without reading surrounding infrastructure code, it is incorrectly structured.

---
### 10. Documentation Skill Adherence

When writing, updating, or generating documentation, you must strictly follow the standards defined in:

`.agent/skills/documentation-writing/SKILL.md`

- Treat this file as mandatory guidance for tone, structure, and clarity
- Apply these standards to READMEs, code comments, API guides, and architectural docs
- Prioritize user-centric, professional English over generic descriptions

If a documentation requirement conflicts with this skill file, pause and ask.


<!-- End custom instructions -->

---

## Project Context

**Pivotr Mailer** is an Event-Driven Realtime full-stack email application with:

- **Frontend**: TanStack Start (React 19 + Vite + TanStack Router)
- **Backend**: Appwrite (self-hosted via Docker Compose)
- **Package Manager**: Bun (exclusively)
- **Language**: TypeScript

## Key Conventions

### Package Manager

> ⚠️ **IMPORTANT**: This project uses **Bun** exclusively. Always use `bun` commands, never `npm`, `yarn`, or `pnpm`.

```bash
# ✅ Correct
bun install
bun add <package>
bun dev
bun build

# ❌ Incorrect
npm install
yarn add
pnpm install
```

### Project Structure

```
Pivotr Mailer/
├── .agent/                    # AI agent configuration
│   └── skills/                # Skill definitions for agents
│       └── frontend-skill/    # Frontend development guidelines
├── frontend/                  # TanStack Start application
│   ├── src/
│   │   ├── lib/               # Appwrite client & utilities
│   │   ├── routes/            # File-based routes (auto-generated)
│   │   └── styles.css
│   ├── public/                # Static assets
│   ├── .env                   # Frontend environment variables
│   └── package.json
├── functions/                 # Appwrite serverless functions
├── infra/                     # Infrastructure as Code (IaC)
│   ├── docker-compose.yml     # Appwrite self-hosted config
│   └── .env                   # Infrastructure environment vars
├── migrations/                # Database migrations
├── shared/                    # Shared utilities & types
├── appwrite.config.json       # Appwrite CLI configuration
├── ABOUT.md
├── AGENTS.md
└── README.md
```

### File-Based Routing

Routes are in `frontend/src/routes/`. TanStack Router auto-generates the route tree.

- `index.tsx` → `/`
- `about.tsx` → `/about`
- `users/$id.tsx` → `/users/:id` (dynamic route)
- `__root.tsx` → Layout wrapper

### Appwrite SDK Usage

The Appwrite client is pre-configured in `frontend/src/lib/appwrite.ts`:

```typescript
import { client, account, databases } from "../lib/appwrite";
```

### Environment Variables

Frontend environment variables must be prefixed with `VITE_`:

```env
VITE_APPWRITE_ENDPOINT=http://localhost:5000/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
VITE_APPWRITE_PROJECT_NAME=Pivotr Mailer
```

Access them with `import.meta.env.VITE_*`.

## Common Tasks

### Starting Development

```bash
# Start Appwrite backend (from project root)
cd infra
docker-compose up -d

# Start frontend dev server (from project root)
cd frontend
bun dev
```

### Adding Dependencies

```bash
cd frontend
bun add <package-name>        # Production dependency
bun add -d <package-name>     # Dev dependency
```

### Running Tests

```bash
cd frontend
bun test
```

### Linting & Formatting

```bash
cd frontend
bun lint       # Check for issues
bun format     # Auto-format code
bun check      # Full Biome check
```

## Code Style

- **Formatter**: Biome
- **Linter**: Biome
- **Language**: TypeScript (strict mode)
- **React**: Function components with hooks
- **Styling**: Tailwind CSS v4 utility classes

## Backend Services

Appwrite runs on Docker. Key endpoints:

| Service   | URL                              |
| --------- | -------------------------------- |
| API       | `http://localhost:5000/v1`       |
| Console   | `http://localhost:5000/console`  |
| Realtime  | `ws://localhost:5000/v1/realtime`|

## Gotchas & Tips

1. **Route generation**: After adding new route files, TanStack Router auto-generates `routeTree.gen.ts`. Don't edit this file manually.

2. **Hot reload**: Vite provides instant HMR. If it stops working, restart with `bun dev`.

3. **Appwrite health check**: Use the ping functionality in the app UI to verify backend connectivity.

4. **Docker issues**: If Appwrite services fail, try:
   ```bash
   cd infra
   docker-compose down
   docker-compose up -d
   ```

5. **Skill files**: Always check `.agent/skills/frontend-skill/SKILL.md` before making frontend changes.

5. **Bun lockfile**: The project uses `bun.lock`. Never commit `package-lock.json` or `yarn.lock`.

## Helpful Resources

- [TanStack Start Docs](https://tanstack.com/start/latest/docs/framework/react/overview)
- [TanStack Router Docs](https://tanstack.com/router/latest/docs/framework/react/overview)
- [Appwrite Docs](https://appwrite.io/docs)
- [Appwrite SDK Reference](https://appwrite.io/docs/sdks)
- [Bun Docs](https://bun.com/docs)
- [Shadcn UI Docs](https://ui.shadcn.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs/installation/using-vite)
- [Biome Docs](https://biomejs.dev/)

---

*Keep this document updated as the project evolves.*
