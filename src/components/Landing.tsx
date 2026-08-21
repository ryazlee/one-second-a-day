"use client";

import { Button } from "@/src/components/Button";
import MakerCredit from "@/src/components/MakerCredit";
import { APP_NAME, APP_TAGLINE } from "@/src/content/app";
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
      <h1 className="landing__brand">{APP_NAME}</h1>
      <p className="landing__headline">{APP_TAGLINE}</p>
      <MakerCredit />
      <p className="landing__lead">
        {APP_NAME} is a free web application that helps you create a
        one-second-a-day video from your own Google Photos library. You pick
        the clips, trim each day to one second, and export a compilation on
        your device — no app store download and no watermark on your days.
      </p>

      <div className="landing__purpose">
        <h2>Purpose of this app</h2>
        <p>
          People take videos all year and rarely watch them. {APP_NAME} turns
          those clips into a short film: one second per day, in order, with an
          optional date stamp. The result is a personal recap you can save to
          Camera Roll or share.
        </p>
        <p>
          All trimming and encoding run in your browser. We do not keep a copy
          of your Photos library on our servers.
        </p>
      </div>

      <ol className="landing__steps">
        <li>Sign in with Google and open the Photos picker</li>
        <li>Choose videos or photos from any dates</li>
        <li>Trim each included clip to one second</li>
        <li>Export an MP4 on this device</li>
      </ol>

      <div className="landing__purpose">
        <h2>Why we ask for Google Photos</h2>
        <p>
          {APP_NAME} uses the Google Photos Picker so you can select specific
          videos and photos. The app only receives the items you explicitly
          pick — not your entire library. That media is loaded into this
          browser session so you can preview, trim, and export. Signing out
          deletes the access token from this device.
        </p>
        <p>
          Operator: Ryan Lee ·{" "}
          <a href="mailto:ryan.j.lee99@gmail.com">ryan.j.lee99@gmail.com</a>
        </p>
      </div>

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
