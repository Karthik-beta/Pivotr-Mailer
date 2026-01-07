# About Pivotr Mailer

## Overview

**Pivotr Mailer** is a full-stack email application developed as part of the Pivotr Apps suite. It leverages modern web technologies to provide a scalable, maintainable, and performant mailing solution.

## Purpose

This application serves as the email communication component for Pivotr, enabling:

- 📧 Email sending and management
- 🔐 Secure authentication via Appwrite
- 📊 Real-time status updates
- 🗄️ Persistent data storage

## Architecture

### Frontend

The frontend is built using **TanStack Start**, a modern full-stack React framework that provides:

- **File-based routing** via TanStack Router
- **Data Fetching** via TanStack Query
- **Data Grids** via TanStack Table
- **Virtualization** via TanStack Virtual
- **Server-side rendering (SSR)** capabilities
- **React 19** with the latest features
- **Tailwind CSS v4** for utility-first styling
- **Vite** for lightning-fast development and builds

### Backend

The backend is powered by **Appwrite**, a self-hosted Backend-as-a-Service (BaaS) that provides:

- **Authentication** - User management and sessions
- **Database** - Document-based storage with real-time subscriptions
- **Storage** - File uploads and management
- **Functions** - Serverless function execution
- **Realtime** - WebSocket-based live updates

### Infrastructure

The application uses **Docker Compose** (located in `infra/`) to orchestrate all backend services:

- Appwrite API & Console
- MariaDB database
- Redis caching layer
- Traefik reverse proxy
- Background workers for async operations

### Project Organization

The codebase follows a modular structure:

- **`frontend/`** - TanStack Start application (React, Vite, Tailwind)
- **`functions/`** - Appwrite serverless functions
- **`infra/`** - Infrastructure as Code (Docker Compose, environment configs)
- **`migrations/`** - Database migration scripts
- **`scripts/`** - Automation & utility scripts
- **`shared/`** - Shared utilities and TypeScript types
- **`.agent/`** - AI agent configuration and skill definitions
- **`appwrite.config.json`** - Appwrite CLI configuration (project root)

## Technology Choices

### Why TanStack Start?

- Built on proven TanStack libraries (Router, Query)
- Modern React 19 support
- Type-safe routing
- Excellent developer experience
- File-based routing simplifies project structure

### Why Appwrite?

- Open-source and self-hosted
- Comprehensive BaaS features out of the box
- Great developer experience with SDK support
- Active community and development
- No vendor lock-in

### Why Bun?

- Extremely fast package installation
- Built-in TypeScript support
- Drop-in replacement for npm/yarn
- Growing ecosystem compatibility

## Development Philosophy

1. **Type Safety First** - TypeScript throughout the stack
2. **Modern Tooling** - Latest stable versions of frameworks
3. **Self-Hosted Backend** - Full control over data and infrastructure
4. **Developer Experience** - Fast feedback loops and clear debugging

## Future Considerations

- Email template management
- Campaign analytics and tracking
- Integration with external SMTP providers
- Advanced scheduling capabilities
- Multi-tenant support

---

*Pivotr Mailer is actively developed as part of the Pivotr ecosystem.*
