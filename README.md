# Pivotr Mailer

Event-driven B2B email automation platform with Gaussian scheduling and reputation protection.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | [TanStack Start](https://tanstack.com/start/latest) (React 19, Router, Query) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Backend | AWS Lambda (Node.js 20, TypeScript) |
| Infrastructure | [AWS CDK](https://aws.amazon.com/cdk/) + [SAM CLI](https://aws.amazon.com/serverless/sam/) |
| Local Dev | [LocalStack](https://localstack.cloud/) (Docker) |
| Runtime | [Bun](https://bun.sh/) |
| Build Tool | [Vite](https://vite.dev/) |
| Testing | [Vitest](https://vitest.dev/) |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL DEVELOPMENT                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Browser (:3000)                                                            │
│       │                                                                      │
│       ▼                                                                      │
│   ┌─────────────────┐         ┌─────────────────┐                           │
│   │  Vite Frontend  │ ──────► │   SAM Local API │                           │
│   │     (:3000)     │  proxy  │     (:3001)     │                           │
│   │                 │ /api/*  │                 │                           │
│   │  React 19       │   →     │  Lambda Funcs   │                           │
│   │  TanStack Start │ /v1/*   │  Node.js 20     │                           │
│   └─────────────────┘         └────────┬────────┘                           │
│                                        │                                     │
│                                        ▼                                     │
│                          ┌─────────────────────────┐                        │
│                          │    LocalStack (:4566)   │                        │
│                          │ ┌─────────┬───────────┐ │                        │
│                          │ │DynamoDB │    SQS    │ │                        │
│                          │ │(5 tables)│(3 queues)│ │                        │
│                          │ ├─────────┼───────────┤ │                        │
│                          │ │   SES   │    SNS    │ │                        │
│                          │ │ (mock)  │(2 topics) │ │                        │
│                          │ ├─────────┴───────────┤ │                        │
│                          │ │         S3          │ │                        │
│                          │ │    (audit logs)     │ │                        │
│                          │ └─────────────────────┘ │                        │
│                          └─────────────────────────┘                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### LocalStack Replaces These AWS Services

| AWS Service | LocalStack Equivalent | Purpose |
|-------------|----------------------|---------|
| DynamoDB | `localhost:4566` | 5 tables: leads, campaigns, metrics, logs, settings |
| SQS | `localhost:4566` | 3 queues: sending, feedback, verification (+DLQs) |
| SES | `localhost:4566` | Mock email sending (no real emails sent) |
| SNS | `localhost:4566` | 2 topics: alarms, ses-feedback |
| S3 | `localhost:4566` | Audit logs bucket |

---

## Prerequisites

- **Docker Desktop** - Running and healthy
- **Bun** >= 1.0 - JavaScript runtime (`curl -fsSL https://bun.sh/install | bash`)
- **AWS SAM CLI** - Lambda local execution ([install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- **Node.js** 20.x - Lambda runtime compatibility

### Verify Prerequisites

```bash
docker --version        # Docker version 24+
bun --version           # 1.0+
sam --version           # SAM CLI 1.100+
node --version          # v20.x
```

---

## Quick Start

### Step 1: Install Dependencies

```bash
# Install all workspace dependencies
bun install
```

### Step 2: Start LocalStack (Terminal 1)

```bash
bun run dev:infra
```

This command:
1. Starts LocalStack container with Docker
2. Creates all DynamoDB tables, SQS queues, SNS topics
3. Verifies SES email identities

**Verify LocalStack is healthy:**
```bash
bun run localstack:status
# Should show: "running" for all services
```

### Step 3: Start Backend API (Terminal 2)

```bash
bun run dev:api
```

This command:
1. Builds all Lambda functions using SAM
2. Starts local API Gateway on port 3001

**Verify API is running:**
```bash
curl http://localhost:3001/v1/campaigns
# Should return: {"success":true,"data":{"campaigns":[],...}}
```

### Step 4: Start Frontend (Terminal 3)

```bash
bun run dev:frontend
```

This starts Vite dev server on port 3000 with proxy configuration.

**Open the application:**
```
http://localhost:3000
```

---

## Port Reference

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 3000 | http://localhost:3000 |
| Backend API (SAM) | 3001 | http://localhost:3001/v1 |
| LocalStack | 4566 | http://localhost:4566 |

---

## Available Scripts

### Development

| Command | Description |
|---------|-------------|
| `bun run dev:infra` | Start LocalStack and bootstrap resources |
| `bun run dev:api` | Build and start SAM local API |
| `bun run dev:frontend` | Start Vite frontend dev server |
| `bun run dev:reset` | Stop LocalStack, then restart and re-bootstrap |

### LocalStack

| Command | Description |
|---------|-------------|
| `bun run localstack:up` | Start LocalStack container |
| `bun run localstack:down` | Stop and remove LocalStack container |
| `bun run localstack:logs` | View LocalStack container logs |
| `bun run localstack:status` | Check LocalStack health status |
| `bun run localstack:bootstrap` | Create AWS resources in LocalStack |

### SAM CLI

| Command | Description |
|---------|-------------|
| `bun run sam:build` | Build Lambda functions |
| `bun run sam:build:cached` | Build with caching (faster) |
| `bun run sam:local:api` | Start local API Gateway on port 3001 |
| `bun run sam:local:invoke` | Invoke individual Lambda functions |

### Testing

| Command | Description |
|---------|-------------|
| `bun run test` | Run all tests |
| `bun run test:unit` | Run unit tests only |
| `bun run test:integration` | Run integration tests (requires LocalStack) |
| `bun run test:lambda` | Run Lambda-specific tests |

---

## Email Verification (SES)

**LocalStack SES does NOT send real emails.** All emails are captured locally for testing.

### View Captured Emails

```bash
# Method 1: Via LocalStack SES API
bun run ses:emails

# Method 2: With jq formatting
curl -s http://localhost:4566/_aws/ses | jq

# Method 3: Check container logs
docker logs pivotr-localstack 2>&1 | grep -i "ses\|email"
```

### List Verified SES Identities

```bash
aws --endpoint-url=http://localhost:4566 ses list-verified-email-addresses
```

### Send a Test Email (via UI)

1. Open http://localhost:3000
2. Navigate to Campaigns
3. Create or select a campaign
4. Click "Send Test Email"
5. Run `bun run ses:emails` to verify the email was captured

---

## Troubleshooting

### Frontend Can't Reach API

**Symptoms:** Network errors, CORS errors, 502 errors

**Solutions:**
1. Verify SAM API is running:
   ```bash
   curl http://localhost:3001/v1/campaigns
   ```
2. Check Vite proxy logs in Terminal 3
3. Ensure SAM build completed successfully:
   ```bash
   bun run sam:build
   ```

### LocalStack Not Responding

**Symptoms:** Connection refused on port 4566

**Solutions:**
1. Check Docker is running:
   ```bash
   docker ps
   ```
2. Check LocalStack container status:
   ```bash
   docker logs pivotr-localstack
   ```
3. Restart LocalStack:
   ```bash
   bun run dev:reset
   ```

### SAM Build Fails

**Symptoms:** Build errors, missing modules

**Solutions:**
1. Ensure Node.js 20 is installed
2. Install Lambda dependencies:
   ```bash
   bun install
   ```
3. Clean and rebuild:
   ```bash
   rm -rf .aws-sam
   bun run sam:build
   ```

### Port Already in Use

**Symptoms:** EADDRINUSE errors

**Solutions:**
```bash
# Find process using the port (macOS/Linux)
lsof -i :3000  # or :3001, :4566

# Windows
netstat -ano | findstr :3000

# Kill the process
kill -9 <PID>
```

### Docker Network Issues

**Symptoms:** Lambda functions can't reach LocalStack

**Solutions:**
1. Ensure the Docker network exists:
   ```bash
   docker network ls | grep pivotr-localstack-network
   ```
2. If missing, restart LocalStack:
   ```bash
   bun run dev:reset
   ```

---

## Project Structure

```
pivotr-mailer/
├── frontend/                 # React/TanStack frontend
│   ├── src/
│   │   ├── features/         # Feature-based modules
│   │   │   ├── campaigns/    # Campaign management
│   │   │   └── leads/        # Lead management
│   │   └── routes/           # TanStack Router routes
│   ├── vite.config.ts        # Vite + proxy configuration
│   └── .env.local            # Local environment variables
├── lambda/                   # AWS Lambda functions
│   ├── api/                  # API handlers
│   │   ├── campaigns/
│   │   ├── leads/
│   │   └── metrics/
│   ├── send-email/           # Email sending logic
│   ├── campaign-processor/   # Scheduled campaign processing
│   └── shared/               # Shared utilities
├── infrastructure/           # AWS CDK definitions
├── tests/
│   ├── localstack/           # LocalStack configuration
│   │   ├── docker-compose.yml
│   │   └── bootstrap.ts
│   └── env/                  # Environment configs for testing
├── template.yaml             # SAM template for local Lambda
├── package.json              # Root package with scripts
└── README.md                 # This file
```

---

## Environment Variables

### Frontend (`frontend/.env.local`)

```env
VITE_API_URL=/api
VITE_ENV=development
```

### Backend (SAM/Lambda)

Configured automatically via `tests/env/sam-local.json`:

| Variable | Default Value |
|----------|---------------|
| `AWS_ENDPOINT_URL` | `http://host.docker.internal:4566` |
| `AWS_REGION` | `us-east-1` |
| `DYNAMODB_TABLE_LEADS` | `pivotr-leads` |
| `DYNAMODB_TABLE_CAMPAIGNS` | `pivotr-campaigns` |
| `SQS_QUEUE_SENDING` | `http://host.docker.internal:4566/000000000000/sending-queue` |

---

## Additional Documentation

- [Local Testing Guide](docs/LOCAL_TESTING_GUIDE.md) - Detailed testing procedures
- [AWS Implementation Guide](docs/AWS_IMPLEMENTATION_GUIDE.md) - Production deployment

---

## License

Private - Pivotr
