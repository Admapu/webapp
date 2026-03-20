"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

const DEFAULT_BACKGROUND = "/bg-new.jpg";
const AUTHENTICATED_BACKGROUNDS = ["/bg-new.jpg", "/bg-alt.jpg"] as const;
const STORAGE_KEY = "admapu-session-background";
const AUTH_KEY = "admapu-session-auth-state";

function pickRandomBackground() {
  return AUTHENTICATED_BACKGROUNDS[Math.floor(Math.random() * AUTHENTICATED_BACKGROUNDS.length)];
}

export function SessionBackground() {
  const { authenticated, ready } = usePrivy();
  const authState = useMemo(() => (ready ? (authenticated ? "authenticated" : "guest") : "loading"), [authenticated, ready]);
  const [background, setBackground] = useState<string>(DEFAULT_BACKGROUND);

  useEffect(() => {
    if (typeof window === "undefined" || authState === "loading") {
      return;
    }

    if (authState === "guest") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.setItem(AUTH_KEY, authState);
      setBackground(DEFAULT_BACKGROUND);
      return;
    }

    const storedBackground = window.localStorage.getItem(STORAGE_KEY);
    const storedAuthState = window.localStorage.getItem(AUTH_KEY);

    if (
      !storedBackground ||
      !AUTHENTICATED_BACKGROUNDS.includes(storedBackground as (typeof AUTHENTICATED_BACKGROUNDS)[number]) ||
      storedAuthState !== authState
    ) {
      const nextBackground = pickRandomBackground();
      window.localStorage.setItem(STORAGE_KEY, nextBackground);
      window.localStorage.setItem(AUTH_KEY, authState);
      setBackground(nextBackground);
      return;
    }

    setBackground(storedBackground);
  }, [authState]);

  return <div aria-hidden="true" className="scene" style={{ backgroundImage: `linear-gradient(rgba(10, 1, 40, 0.38), rgba(10, 1, 40, 0.56)), url('${background}')` }} />;
}
