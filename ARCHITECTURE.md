# ARCHITECTURE.md: Zero-Friction Baby Tracker MVP

## 1. Project Overview
This project is an offline-first, mobile Progressive Web App (PWA) designed for sleep-deprived parents to log baby activities (sleep, feeds, diapers). It relies entirely on large, touch-friendly UI buttons rather than text input. All data is immediately persisted locally to ensure zero-latency interactions, and asynchronously synced to a cloud database.

## 2. Technology Stack
- **Frontend**: React 19 (via Vite), TypeScript.
- **Styling**: Tailwind CSS (Minimalist, high-contrast, large touch targets).
- **Local Storage**: Dexie.js (IndexedDB wrapper).
- **State Management & Sync**: Zustand.
- **API Layer**: Express (deployable to Azure App Service free tier).
- **Database**: Neon (Serverless PostgreSQL).

## 3. Architecture Diagram
```
graph TD
    %% User Interaction
    User((User)) --> |Taps large UI buttons| UI[React UI Components]

    %% Presentation & Local State
    subgraph Client [Client-Side App PWA]
        UI --> |Dispatch Action| State[Zustand Store]
        State --> |1. Write Instantly| LocalDB[(Dexie.js / IndexedDB)]
        State --> |2. Enqueue Sync| SyncQueue[Background Sync Engine]
    end

    %% Network Boundary
    SyncQueue --> |3. Async Push JSON| API[Express API Endpoint]
    API --> |Acknowledge/Error| SyncQueue

    %% Backend
    subgraph Cloud [Cloud Infrastructure - Azure]
        API --> |SQL Insert/Update| DB[(Neon PostgreSQL)]
    end

    %% Offline handling
    LocalDB -.-> |Read on Load| UI
```

## 4. System Layers & Data Flow

### A. The Presentation Layer (React + Tailwind)
- **Responsibility**: Provide an idiot-proof, single-column interface.
- **Design Constraints**: No complex forms. Use massive tap targets (minimum 64px height).
- **Example Flow**: User taps "Bottle", taps "4oz", taps "Save". The UI instantly updates the timeline without waiting for a network request.

### B. The Local Persistence Layer (Dexie.js)
- **Responsibility**: Act as the single source of truth for the UI to guarantee sub-millisecond response times and full offline capability.
- **Schema**: A single `events` table with fields: `id` (UUID), `type` (sleep | feed | diaper), `value` (duration, ounces, condition), `timestamp` (ISO string), and `sync_status` (pending | synced).

### C. The Sync Engine (Zustand)
- **Responsibility**: Manage the queue of offline actions and push them to the cloud.
- **Logic**:
  1. Listen for standard browser `online` events or interval checks.
  2. Query Dexie for all rows where `sync_status === 'pending'`.
  3. Push batch payload to the API.
  4. On successful `200 OK` response, update local Dexie rows to `sync_status: 'synced'`.

### D. The API & Database Layer (Neon Serverless Postgres)
- **Responsibility**: Securely receive JSON payloads and permanently store them.
- **Logic**: A simple POST endpoint that accepts an array of events and performs an upsert (`INSERT ON CONFLICT`) based on the UUIDs to prevent duplicate entries if a sync is retried.

## 5. Rules of Engagement
- **No AI/LLM Dependencies**: Do not import LangChain, OpenAI, Anthropic, or any AI inference libraries. This app relies on manual UI taps.
- **Optimistic UI**: Never block a user interaction waiting for a `fetch()` request. Always write to Dexie first, update the React state, and handle the API push asynchronously.
- **Mobile Strictness**: Do not use hover states as primary interactions. Use Username instead of Work Email for any auth scaffolding. Use an ambient silver color palette.
- **No Complex CRDTs**: Do not use Yjs or Automerge. Rely on simple timestamp-based "last write wins" logic for syncing.
