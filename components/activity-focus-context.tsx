"use client";

import { createContext, useContext } from "react";

/**
 * Focus mode context untuk /activity — satu wallet difokuskan, feed
 * terfilter ke event yang menyentuh wallet itu. Null di luar provider.
 */
export interface ActivityFocusValue {
  focused: string | null;
  focusWallet: (address: string) => void;
  clearFocus: () => void;
}

export const ActivityFocusContext = createContext<ActivityFocusValue | null>(null);

export function useActivityFocus(): ActivityFocusValue {
  const value = useContext(ActivityFocusContext);
  if (value === null) {
    throw new Error("useActivityFocus must be used inside ActivityFocusContext.");
  }
  return value;
}
