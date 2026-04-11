# Baby Tracker Client 📱

The frontend for the Baby Tracker application, built as an offline-first Progressive Web App (PWA).

## 🚀 Overview

The client uses **React 19** and **Vite** for a high-performance, smooth user experience. It is designed to be fully functional offline, using **Dexie.js** as a local database that synchronizes with the server when a connection is available.

## 🎨 Key Features

-   **Two Main Views**:
    -   **Today**: Log feeding (bottle), sleep/naps, and diapers. View a real-time activity timeline.
    -   **Trends**: Weekly and monthly view of baby's progress with dynamic charts.
-   **Premium UI**: Custom CSS design system with a focus on dark mode, glassmorphism, and mobile-first interactions.
-   **Data Visualization**: Uses **Recharts** for:
    -   **Sleep Summary**: Horizontal stacked bars showing Night Sleep vs. Naps.
    -   **Daily Volume**: Vertical bar chart for formula intake tracking.

## 🏗 Architecture details

### Local-First Persistence
All user actions are first committed to **IndexedDB** via Dexie. The UI updates instantly, providing a zero-latency experience regardless of network status.

### Sync Engine
A custom sync engine runs in the background, monitoring local changes and sending them to the API. It handles retries and ensures data consistency between multiple devices.

### Custom Hooks
-   `useTrends`: Fetches trend data from the API but falls back to local Dexie aggregation if the server is unreachable.
-   `useTodayActivity`: Computes the timeline and summary statistics directly from local storage.

## 🛠 Tech Stack
-   **React 19**
-   **Vite**
-   **Dexie.js**
-   **Recharts**
-   **Zustand**
-   **Vanilla CSS**

## 💻 Running Local Development
```bash
pnpm dev
```
The app will be available at `http://localhost:5173`.
