# Baby Tracker PWA 🍼

A production-quality, offline-first Baby Activity Tracker built with a modern monorepo architecture. This application allows parents to track feeding, sleep, and diapers with real-time sync and data-driven trend visualizations.

![Baby Tracker Today Screen](packages/client/public/screenshot-today.png)

## 🌟 Features

-   **Offline-First & Local-First**: Uses Dexie.js (IndexedDB) as the primary source of truth. The app is fully functional without an internet connection.
-   **Data-Driven Trends**: Beautifully rendered charts using Recharts for Sleep Summary (Night vs. Naps) and Daily Feeding Volume.
-   **Intelligent Sync Engine**: Background synchronization between local state and a Neon PostgreSQL backend.
-   **PWA Ready**: Installable on iOS and Android with offline caching and app-like feel.
-   **Modern Design System**: A premium navy and purple-themed UI designed for quick one-handed interactions.

## 🛠 Tech Stack

### Monorepo
-   **Turborepo**: High-performance build system.
-   **pnpm**: Fast, disk space efficient package manager.

### Frontend (`packages/client`)
-   **React 19**: Latest React features for a responsive UI.
-   **Vite**: Extremely fast dev server and build tool.
-   **Dexie.js**: IndexedDB wrapper for local persistence.
-   **Recharts**: Data visualizations for trends.
-   **Zustand**: Lightweight state management for the sync engine.

### Backend (`packages/server`)
-   **Express**: Robust Node.js API framework.
-   **Neon PostgreSQL**: Serverless PostgreSQL for scalable storage.
-   **Drizzle-like Aggregation**: Complex SQL queries for trend computation.

### Shared (`packages/shared`)
-   **TypeScript**: Shared types across the entire stack ensuring end-to-end safety.
-   **Config**: Centralized baby profile and API constants.

## 📂 Project Structure

```text
.
├── packages
│   ├── client     # React + Vite PWA (Offline-first)
│   ├── server     # Express API + Neon DB aggregations
│   └── shared     # Shared TypeScript types & constants
├── turbo.json     # Turborepo configuration
└── package.json   # Monorepo workspace configuration
```

## 🚀 Getting Started

### Prerequisites
-   Node.js v20+
-   pnpm v8+
-   A Neon PostgreSQL database string

### Installation

1. Clone the repository
2. Install dependencies:
    ```bash
    pnpm install
    ```

### Development

1. Create a `.env` file in `packages/server/.env`:
    ```env
    DATABASE_URL=your_neon_connection_string
    ```

2. Start all packages in development mode:
    ```bash
    pnpm dev
    ```

-   Client: `http://localhost:5173`
-   Server: `http://localhost:3001`

### Building

To build all packages:
```bash
pnpm build
```

## 📐 Architecture

The application follows an **Offline-First** pattern:
1.  User logs an event.
2.  Event is written to **Dexie.js** (IndexedDB) immediately.
3.  The **Sync Engine** detects the new event and attempts to push to the server.
4.  If offline, the engine retries when the connection is restored.
5.  Trends are calculated locally (from Dexie) or fetched from the server depending on connectivity.

For more details, see [ARCHITECTURE.md](./ARCHITECTURE.md).
