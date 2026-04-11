// ──────────────────────────────────────────────
// Baby Tracker — Online Status Hook
// ──────────────────────────────────────────────

import { useState, useEffect } from "react";

/**
 * React hook that tracks whether the browser is online.
 * Uses the Navigator.onLine API + event listeners.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
