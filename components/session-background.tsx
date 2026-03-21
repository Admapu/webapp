"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

const DEFAULT_BACKGROUND = "/bg-new.jpg";
const AUTHENTICATED_BACKGROUNDS = ["/bg-new.jpg", "/bg-alt.jpg"] as const;
const STORAGE_KEY = "admapu-session-background";
const SESSION_KEY = "admapu-session-background-key";
const LAST_AUTH_BACKGROUND_KEY = "admapu-last-auth-background";

function pickRandomBackground(previousBackground?: string | null) {
  const candidates = AUTHENTICATED_BACKGROUNDS.filter((background) => background !== previousBackground);
  const pool = candidates.length > 0 ? candidates : AUTHENTICATED_BACKGROUNDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function SessionBackgroundWithPrivy() {
  const { authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address ?? null;
  const sessionKey = useMemo(() => {
    if (!ready) return "loading";
    if (!authenticated || !walletAddress) return "guest";
    return `authenticated:${walletAddress.toLowerCase()}`;
  }, [authenticated, ready, walletAddress]);
  const [background, setBackground] = useState<string>(DEFAULT_BACKGROUND);

  useEffect(() => {
    if (typeof window === "undefined" || sessionKey === "loading") {
      return;
    }

    if (sessionKey === "guest") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SESSION_KEY);
      setBackground(DEFAULT_BACKGROUND);
      return;
    }

    const storedBackground = window.localStorage.getItem(STORAGE_KEY);
    const storedSessionKey = window.localStorage.getItem(SESSION_KEY);

    if (
      storedBackground &&
      AUTHENTICATED_BACKGROUNDS.includes(storedBackground as (typeof AUTHENTICATED_BACKGROUNDS)[number]) &&
      storedSessionKey === sessionKey
    ) {
      setBackground(storedBackground);
      return;
    }

    const previousAuthenticatedBackground = window.localStorage.getItem(LAST_AUTH_BACKGROUND_KEY);
    const nextBackground = pickRandomBackground(previousAuthenticatedBackground);

    window.localStorage.setItem(STORAGE_KEY, nextBackground);
    window.localStorage.setItem(SESSION_KEY, sessionKey);
    window.localStorage.setItem(LAST_AUTH_BACKGROUND_KEY, nextBackground);
    setBackground(nextBackground);
  }, [sessionKey]);

  return <div aria-hidden="true" className="scene" style={{ backgroundImage: `linear-gradient(rgba(10, 1, 40, 0.38), rgba(10, 1, 40, 0.56)), url('${background}')` }} />;
}

export function SessionBackground() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return <div aria-hidden="true" className="scene" style={{ backgroundImage: `linear-gradient(rgba(10, 1, 40, 0.38), rgba(10, 1, 40, 0.56)), url('${DEFAULT_BACKGROUND}')` }} />;
  }

  return <SessionBackgroundWithPrivy />;
}
