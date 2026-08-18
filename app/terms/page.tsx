import { LegalDoc } from "@/src/components/LegalDoc";
import { termsMeta, termsSections } from "@/src/content/legal";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · One Second A Day",
  description: "Terms of Service for One Second A Day",
};

export default function TermsPage() {
  return (
    <main className="app-main">
      <div className="shell-inner">
        <p className="legal-back">
          <Link href="/">← Back</Link>
        </p>
        <LegalDoc
          title={termsMeta.title}
          updated={termsMeta.updated}
          sections={termsSections}
        />
      </div>
    </main>
  );
}
