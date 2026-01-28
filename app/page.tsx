"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Restore token on refresh
  useEffect(() => {
    const stored = sessionStorage.getItem("google_access_token");
    if (stored) {
      setAccessToken(stored);
    }
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "GOOGLE_OAUTH_SUCCESS") {
        const token = event.data.accessToken;
        setAccessToken(token);
        sessionStorage.setItem("google_access_token", token);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function loginWithGoogle() {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      "/api/oauth/login",
      "google-oauth",
      `width=${width},height=${height},left=${left},top=${top}`
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>1 Second a Day</h1>

      {!accessToken ? (
        <button onClick={loginWithGoogle}>
          Login with Google
        </button>
      ) : (
        <>
          <p>✅ Logged in</p>
          <button
            onClick={() => {
              sessionStorage.removeItem("google_access_token");
              setAccessToken(null);
            }}
          >
            Log out
          </button>
        </>
      )}
    </main>
  );
}
