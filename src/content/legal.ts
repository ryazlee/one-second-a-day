export type LegalSection = {
  heading: string;
  body: string[];
};

export const privacyMeta = {
  title: "Privacy Policy",
  updated: "August 1, 2026",
};

export const privacySections: LegalSection[] = [
  {
    heading: "Overview",
    body: [
      "1 Second a Day is a browser tool that helps you build a one-second-a-day video from clips you select in Google Photos. This policy explains what information is used when you visit the site and how it is handled.",
    ],
  },
  {
    heading: "Information we access",
    body: [
      "Google account access: when you sign in with Google, we request permission to use the Google Photos Picker so you can choose videos from your library. We receive a short-lived access token from Google for that purpose.",
      "Selected media: only the videos (and related metadata such as timestamps) that you explicitly pick in the Google Photos Picker are loaded into your browser session.",
      "No account on our servers: we do not create a user account database for this site, and we do not store your Google password.",
    ],
  },
  {
    heading: "How information is used",
    body: [
      "To show your selected clips in the editor, let you trim one second per day, and compile an export video entirely in your browser.",
      "To burn an optional date stamp onto exported clips and append a short end card crediting this site.",
      "We do not sell your personal information or Google user data.",
      "We do not use your Google Photos content for advertising, training unrelated models, or sharing with data brokers.",
    ],
  },
  {
    heading: "Where processing happens",
    body: [
      "Video download, trimming, date stamps, and MP4 encoding run locally in your browser.",
      "Your selected media is not uploaded to our servers for storage. Temporary in-browser caches may exist only on your device for the current session.",
      "Sign-in and Photos Picker requests go to Google’s services under Google’s terms and privacy policy.",
    ],
  },
  {
    heading: "Cookies and local storage",
    body: [
      "We may store your Google access token in session storage so you stay signed in while the tab is open. Clearing site data or signing out removes it.",
      "We do not use third-party advertising cookies on this site.",
    ],
  },
  {
    heading: "Third-party services",
    body: [
      "Google Photos Picker API and Google sign-in (Google Identity Services) for authentication and media selection.",
      "Hosting may be provided by GitHub Pages. Those providers process standard web request logs (such as IP address and user agent) according to their own policies.",
      "Optional client-side libraries (for example ffmpeg.wasm loaded from a CDN) may be fetched by your browser to encode exports locally.",
    ],
  },
  {
    heading: "Data retention and your choices",
    body: [
      "You can sign out at any time to clear the stored access token from this site.",
      "You can revoke this app’s access in your Google Account permissions settings.",
      "Exported videos you download are saved to your device; we do not keep a copy.",
    ],
  },
  {
    heading: "Children",
    body: [
      "This site is not directed at children under 13, and we do not knowingly collect personal information from children under 13.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "We may update this policy from time to time. The “Last updated” date at the top reflects the latest revision. Continued use of the site after a change means you accept the updated policy.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about privacy: open an issue on the project repository or email the site operator via the contact method listed on ryazlee.github.io.",
    ],
  },
];

export const termsMeta = {
  title: "Terms of Service",
  updated: "August 1, 2026",
};

export const termsSections: LegalSection[] = [
  {
    heading: "Agreement",
    body: [
      "By using 1 Second a Day (“the Service”), you agree to these Terms of Service. If you do not agree, do not use the Service.",
    ],
  },
  {
    heading: "The Service",
    body: [
      "The Service is a free web tool that lets you select videos from Google Photos, choose one second per day, and export a compilation video in your browser.",
      "The Service is provided as-is and may change, break, or be discontinued at any time without notice.",
    ],
  },
  {
    heading: "Your Google account and content",
    body: [
      "You must use your own Google account and only select media you have the right to use.",
      "You are responsible for complying with Google’s terms and any laws that apply to your content and exports.",
      "You retain ownership of your media. You grant the Service permission to process selected media in your browser solely to provide editing and export features.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Do not misuse the Service, attempt to disrupt it, or use it to infringe others’ rights.",
      "Do not attempt to bypass Google authentication or access another person’s Photos library without authorization.",
    ],
  },
  {
    heading: "Exports and attribution",
    body: [
      "Exported videos may include an end card crediting this site. Aside from that credit screen, day clips are not watermarked by the Service.",
      "You are responsible for how you share or publish your exports.",
    ],
  },
  {
    heading: "No warranties",
    body: [
      "The Service is provided “as is” without warranties of any kind, including merchantability, fitness for a particular purpose, or non-infringement.",
      "We do not guarantee uninterrupted availability, perfect export quality, or compatibility with every browser or device.",
    ],
  },
  {
    heading: "Limitation of liability",
    body: [
      "To the fullest extent permitted by law, the operator of this Service is not liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, profits, or media arising from your use of the Service.",
    ],
  },
  {
    heading: "Third-party services",
    body: [
      "Google sign-in and Google Photos are provided by Google and subject to Google’s terms and policies. The Service is not affiliated with or endorsed by Google.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "We may update these terms from time to time. The “Last updated” date reflects the latest revision. Continued use after changes means you accept the new terms.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about these terms: open an issue on the project repository or email the site operator via the contact method listed on ryazlee.github.io.",
    ],
  },
];
