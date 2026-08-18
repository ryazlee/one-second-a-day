import { LegalDoc } from "@/src/components/LegalDoc";
import { privacyMeta, privacySections } from "@/src/content/legal";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · One Second A Day",
  description: "Privacy Policy for One Second A Day",
};

export default function PrivacyPage() {
  return (
    <main className="app-main">
      <div className="shell-inner">
        <p className="legal-back">
          <Link href="/">← Back</Link>
        </p>
        <LegalDoc
          title={privacyMeta.title}
          updated={privacyMeta.updated}
          sections={privacySections}
        />
      </div>
    </main>
  );
}
