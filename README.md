# Pivotr Mailer

A modern full-stack web application built with **TanStack Start** for the frontend and **Appwrite** as the Backend-as-a-Service (BaaS). This project is designed to be a robust foundation for building scalable mailer applications.

![TanStack x Appwrite](frontend/public/tanstack-circle-logo.png)

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

Copy the example environment file and update with your Appwrite project details:

```bash
cd frontend
cp .env.example .env
```

Edit `.env` with your Appwrite configuration:

```env
VITE_APPWRITE_ENDPOINT=http://localhost:5000/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
VITE_APPWRITE_PROJECT_NAME=Pivotr Mailer
```

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
