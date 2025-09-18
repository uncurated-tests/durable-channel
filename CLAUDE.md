# durable-object

A Next.js TypeScript application implementing durable channels with Redis backend.

## Project Overview

This is a Next.js 15.5.3 application built with TypeScript that implements a durable channel system using Redis for persistence. The project includes server-sent events (SSE) functionality and real-time communication features.

## Technology Stack

- **Framework**: Next.js 15.5.3
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Database**: Redis
- **Runtime**: Node.js

## Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Install dependencies
pnpm install

# Type checking
npx tsc --noEmit

# Build and type check
pnpm build
```

## Project Structure

- `app/` - Next.js App Router pages and API routes
  - `channel/` - Channel-related functionality
  - `sse-test/` - Server-sent events testing
  - `layout.tsx` - Root layout component
- `lib/` - Utility libraries and shared code
  - `durable-channel.ts` - Core durable channel implementation
- `next.config.ts` - Next.js configuration
- `tsconfig.json` - TypeScript configuration

## Key Features

- Durable channels with Redis persistence
- Server-sent events (SSE) support
- Real-time communication
- TypeScript type safety
- App Router architecture

## Environment Setup

Make sure you have the following installed:
- Node.js (compatible with Next.js 15.5.3)
- pnpm
- Redis server

## Build Process

The project uses Next.js's built-in build system:
1. TypeScript compilation happens automatically during build
2. Next.js optimizes and bundles the application
3. Static and server assets are generated in `.next/`

## Development Workflow

1. Install dependencies: `pnpm install`
2. Start development server: `pnpm dev`
3. The app will be available at `http://localhost:3000`
4. Make changes and they will be hot-reloaded automatically

## Deployment

The project is configured for Vercel deployment (`.vercel/` directory present).

```bash
# Build for production
pnpm build

# Start production server locally
pnpm start
```