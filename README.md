# Pivotr Mailer

A modern full-stack web application built with **TanStack Start** for the frontend and **Appwrite** as the Backend-as-a-Service (BaaS). This project is designed to be a robust foundation for building scalable mailer applications.

<img src="frontend/public/tanstack-circle-logo.png" alt="TanStack x Appwrite" width="100" />

## 🚀 Tech Stack

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | [TanStack Start](https://tanstack.com/start/latest)               |
| UI Library | [React 19](https://react.dev/)                                    |
| Styling    | [Tailwind CSS v4](https://tailwindcss.com/)                       |
| Backend    | [Appwrite](https://appwrite.io/) (Self-hosted via Docker Compose) |
| Runtime    | [Bun](https://bun.sh/)                                            |
| Build Tool | [Vite](https://vite.dev/)                                         |
| Testing    | [Vitest](https://vitest.dev/)                                     |
| Linting    | [Biome](https://biomejs.dev/)                                     |

## 📁 Project Structure

```
Pivotr Mailer/
├── .agent/                    # AI agent configuration & skills
│   └── skills/
│       └── frontend-skill/    # Frontend development guidelines
├── frontend/                  # TanStack Start application
│   ├── src/
│   │   ├── lib/               # Appwrite client configuration
│   │   ├── routes/            # File-based routing (TanStack Router)
│   │   └── styles.css         # Global styles
│   ├── public/                # Static assets
│   ├── .env                   # Frontend environment variables
│   ├── package.json
│   └── vite.config.ts
├── functions/                 # Appwrite Functions (serverless)
├── infra/                     # Infrastructure as Code (IaC)
│   ├── docker-compose.yml     # Appwrite self-hosted configuration
│   └── .env                   # Infrastructure environment variables
├── migrations/                # Database migrations
├── shared/                    # Shared utilities & types
├── appwrite.config.json       # Appwrite CLI configuration
├── ABOUT.md                   # Project overview
├── AGENTS.md                  # AI agent guidelines
└── README.md
```

## 🔧 Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

## 🏁 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd "Pivotr Mailer"
```

### 2. Start Appwrite (Backend)

Start the self-hosted Appwrite instance using Docker Compose:

```bash
cd infra
docker-compose up -d
```

> This will spin up all required Appwrite services including the API, console, database, storage, and worker containers.

The Appwrite Console will be available at `http://localhost:5000/console`.

### 3. Configure Environment Variables

All environment variables are managed from a single `.env` file in the project root:

```bash
# From project root
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Appwrite connection (used by both frontend and migrations)
APPWRITE_ENDPOINT=http://localhost:5000/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_PROJECT_NAME=Pivotr Mailer

# API Key (server-side only, never exposed to frontend)
APPWRITE_API_KEY=your-api-key
```

> **Note**: The Vite config automatically exposes `APPWRITE_*` variables to the frontend as `import.meta.env.VITE_APPWRITE_*`. No duplication needed!

### 4. Install Dependencies

```bash
cd frontend
bun install
```

### 5. Start Development Server

```bash
bun dev
```

The application will be available at `http://localhost:3000`.

---

## 🔐 Appwrite Backend Setup

### Step 1: Create a Project

1. Access Appwrite Console at `http://localhost:5000/console`
2. Create a new project named **Pivotr Mailer**
3. Note your **Project ID** for the environment variables

### Step 2: Configure Google OAuth

1. Go to **Auth → Settings → OAuth2 Providers**
2. Enable **Google** and add your OAuth credentials
3. In Google Cloud Console, add the redirect URI:
   ```
   http://localhost:5000/v1/account/sessions/oauth2/callback/google/YOUR_PROJECT_ID
   ```

### Step 3: Add Platform

1. Go to **Overview → Platforms**
2. Add a **Web** platform with hostname: `localhost`

### Step 4: Create API Key

1. Go to **Overview → API Keys → Create API Key**
2. Name: `migrations-key`
3. Select **ALL scopes** for full access
4. Copy the generated key

### Step 5: Run Database Migrations

First, create a `.env` file in the project root:

```bash
# From project root
cp .env.example .env
```

Edit `.env` with your Appwrite credentials:

```env
APPWRITE_ENDPOINT=http://localhost:5000/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
```

Then run the migrations:

```bash
bun run migrations/run.ts
```

This creates the database, collections, indexes, and seed data.

### Step 6: Deploy Appwrite Functions

**Important**: Each function must have its dependencies installed locally before deployment, as Appwrite does not install dependencies during build.

### Step 6: Deploy Appwrite Functions

**Recommended Method: Bundled Deployment**

We use `bun build` to bundle dependencies into a single file, avoiding runtime resolution issues and significantly reducing upload size.

1. **Run the Build Script**:
   ```bash
   cd functions/export-leads
   bun run build.ts
   ```

2. **Deploy the `dist` folder**:
   ```bash
   cd ../..
   npx appwrite functions create-deployment \
     --function-id export-leads \
     --activate true \
     --entrypoint main.js \
     --code ./functions/export-leads/dist
   ```

> **Why Bundling?** Packages like `exceljs` have deep dependency trees (`readdir-glob` → `minimatch` → ...) that are hard to manage in serverless runtimes. Bundling compilation bakes them all into one file.

#### Troubleshooting: Manual Dependencies (Legacy)

If you prefer not to bundle, install missing packages explicitly:
1. Identify missing package from logs.
2. `bun add <package>` in function dir.
3. Redeploy.

**Known tricky chains:** `exceljs` → `jszip`, `fast-csv`, `archiver`, `saxes`. All solved by bundling.

### Step 7: Configure Function Environment Variables

For each function in **Functions → Settings → Variables**, add:

```env
APPWRITE_FUNCTION_PROJECT_ID=your-project-id
APPWRITE_FUNCTION_API_KEY=your-api-key

# AWS SES (for orchestrator)
AWS_SES_ACCESS_KEY_ID=your-aws-key
AWS_SES_SECRET_ACCESS_KEY=your-aws-secret
AWS_SES_REGION=ap-south-1

# AWS SQS (for sqs-poller)
AWS_SQS_QUEUE_URL=your-sqs-queue-url
AWS_SQS_REGION=ap-south-1

# Email Verifier (for orchestrator)
MY_EMAIL_VERIFIER_API_KEY=your-mev-key
```

---


## 📜 Available Scripts

Run these commands from the `frontend/` directory:

| Command       | Description                    |
| ------------- | ------------------------------ |
| `bun dev`     | Start development server       |
| `bun build`   | Build for production           |
| `bun serve`   | Preview production build       |
| `bun test`    | Run tests with Vitest          |
| `bun lint`    | Lint code with Biome           |
| `bun format`  | Format code with Biome         |
| `bun check`   | Run all Biome checks           |

## 🧪 Testing

This project uses [Vitest](https://vitest.dev/) for testing:

```bash
bun test
```

## 🎨 Styling

The project uses [Tailwind CSS v4](https://tailwindcss.com/) for styling, integrated via the Vite plugin.

## 🔗 Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are automatically generated from files in `src/routes/`.

### Adding a New Route

Simply create a new file in `frontend/src/routes/`:

```tsx
// frontend/src/routes/about.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return <h1>About Page</h1>;
}
```

## 📦 Building for Production

```bash
cd frontend
bun build
```

The production build will be output to `frontend/dist/`.

## 🐳 Docker Services

The `infra/docker-compose.yml` includes a complete Appwrite setup:

- **Appwrite API** - Main backend service
- **Appwrite Console** - Admin dashboard
- **Appwrite Realtime** - WebSocket connections
- **MariaDB** - Database
- **Redis** - Caching & queues
- **Traefik** - Reverse proxy
- **Worker Services** - Background job processing

## 📚 Documentation

- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [TanStack Router Documentation](https://tanstack.com/router/latest)
- [Appwrite Documentation](https://appwrite.io/docs)
- [Bun Documentation](https://bun.sh/docs)

## 📄 License

See [LICENSE](frontend/LICENSE) for details.

---

Built with ❤️ by Pivotr
