"use client";

import { Button } from "@/src/components/Button";
import Link from "next/link";

export function Landing({
  onLogin,
  loginError,
  signingIn,
}: {
  onLogin: () => void;
  loginError: string | null;
  signingIn?: boolean;
}) {
  return (
    <section className="landing">
      <h1 className="landing__brand">1 Second a Day</h1>
      <p className="landing__headline">Your year, one second at a time.</p>
      <p className="landing__lead">
        Pick videos (or photos) from Google Photos, keep one second per clip,
        and export a clean MP4 in your browser — no watermark.
      </p>
      <ol className="landing__steps">
        <li>Connect Google Photos</li>
        <li>Pick clips from any dates</li>
        <li>Trim each to one second</li>
        <li>Export</li>
      </ol>
      <div className="landing__cta">
        <Button
          label={signingIn ? "Connecting…" : "Continue with Google"}
          onClick={onLogin}
          disabled={signingIn}
          className="landing__cta-btn"
        />
      </div>
      {loginError ? (
        <p className="landing__error">{loginError}</p>
      ) : null}
      <p className="landing__note muted">
        By continuing, you agree to the <Link href="/terms">Terms</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </section>
  );
}
