import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <nav className="site-footer-links" aria-label="Legal">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </nav>
        <p className="site-footer-note">
          One Second A Day is a free browser tool for personal one-second-a-day
          compilations. Processing stays on your device.
        </p>
      </div>
    </footer>
  );
}
