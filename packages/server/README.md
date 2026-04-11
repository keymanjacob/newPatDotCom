# Baby Tracker Server 🖥️

The backend API for the Baby Tracker application, providing persistent storage and high-performance data aggregation.

## 🚀 Overview

Built with **Express** and **TypeScript**, the server acts as the central synchronization point for all client data. It is optimized for **Neon PostgreSQL**, utilizing its serverless nature to provide cost-effective and scalable storage.

## 🛠 Features

-   **Event Synchronization**: Endpoint to receive and store time-ordered events from multiple clients.
-   **Trend Aggregation**: Complex SQL-based aggregation for:
    -   Daily sleep totals (Night vs. Nap classification).
    -   Daily formula intake volume.
    -   Diaper counts.
-   **Activity Timeline**: Optimized retrieval of recent activities with metadata.
-   **Safe SQL Integration**: Direct integration with Neon for low-latency queries.

## 📡 API Routes

| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/events` | Sync local events to the database |
| `GET` | `/api/trends` | Get daily sleep and volume stats for a week/month |
| `GET` | `/api/activity` | Get timeline activities for today |

## 🏗 Database Schema

The server uses a flat `events` table with a flexible `value` JSONB column to support multiple event types:
-   **Fead**: Method (bottle/breast), amount (oz), timestamp.
-   **Sleep**: Action (start/stop), duration, timestamp.
-   **Diaper**: Condition (wet/dirty), timestamp.

### Performance
The server uses **composite indexes** on `(babyId, timestamp, type)` to ensure that trend aggregations remain fast even as the database grows to thousands of records.

## 💻 Configuration

Ensure you have a `.env` file with:
```env
DATABASE_URL=postgres://...
PORT=3001
```

## 🚀 Development
```bash
pnpm dev
```
The server will be available at `http://localhost:3001`.
