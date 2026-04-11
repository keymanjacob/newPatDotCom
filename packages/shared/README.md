# Baby Tracker Shared 🧱

Shared TypeScript types, constants, and configurations used by both the client and server.

## 🚀 Overview

This package ensures a single source of truth for the data structures used throughout the application. It helps maintain type safety across the network boundary, reducing bugs related to API mismatches.

## 📁 Key Files

-   **`types.ts`**: The core domain model. Defines `BabyEvent`, `SleepValue`, `FeedValue`, `DiaperValue`, and all trend-related interfaces.
-   **`constants.ts`**: Centralized API route definitions and UI constants.
-   **`config.ts`**: Global configuration including the current baby profile (name, age, etc.).

## 🛠 Integration

To use this package in other packages:
```typescript
import { BabyEvent, BABY_PROFILE } from "@baby-tracker/shared";
```

## 🚀 Development
When types are changed, run a build at the root or within this directory to update the distribution:
```bash
pnpm build
```
