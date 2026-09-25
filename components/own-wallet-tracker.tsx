"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

/**
 * Phase 0 instrumentation - fires own_wallet_checked once when the
 * connected wallet views its own profile. Mounted only under
 * WalletsLayout WagmiProvider. SearchWalletForm cannot do this: it
 * also renders inside the plain Navbar provider.
 */
export function OwnWalletTracker({
  profileAddress,
}: {
  profileAddress: string;
}) {
  const { address: connected } = useAccount();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!connected) return;
    if (connected.toLowerCase() === profileAddress.toLowerCase()) {
      fired.current = true;
      trackEvent(ANALYTICS_EVENTS.ownWalletChecked, {
        address: profileAddress.toLowerCase(),
      });
    }
  }, [connected, profileAddress]);

  return null;
}

