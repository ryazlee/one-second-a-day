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
          Made for personal one-second-a-day compilations — processing stays in
          your browser.
        </p>
      </div>
    </footer>
  );
}
