export type LegalSection = {
  heading: string;
  body: string[];
};

export const privacyMeta = {
  title: "Privacy Policy",
  updated: "August 18, 2026",
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
      "Your selected media is not uploaded to our servers for storage. Temporary in-browser caches may exist only on your device while you use the editor.",
      "Sign-in and Photos Picker requests go to Google’s services under Google’s terms and privacy policy.",
      "A media proxy may briefly stream files you selected so your browser can play and export them. That proxy does not retain Google user data after the request finishes.",
    ],
  },
  {
    heading: "Cookies and local storage",
    body: [
      "We store your Google OAuth access token in your browser’s local storage so you can stay signed in across page reloads. Signing out or clearing this site’s data deletes it.",
      "We may keep a short-lived Google Photos Picker session identifier in session storage while a picker tab is open. Closing the tab or signing out removes it.",
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
    heading: "Retention and deletion of Google user data",
    body: [
      "This section describes the retention and deletion of Google user data accessed through Google APIs, including OAuth tokens, Google Photos Picker session identifiers, and the media and metadata you select.",
      "We do not retain Google user data on our servers. We do not create a user account database, and we do not store, archive, or back up your Google Photos library or selected clips on any server we control.",
      "Retention on your device: the Google OAuth access token is retained in local storage until it expires, you sign out, or you clear this site’s data. Selected Google Photos media and related metadata are held in browser memory (and temporary browser caches) only while you use the editor.",
      "Deletion: signing out immediately deletes the stored access token and in-memory Google user data from this app. You can also delete remaining local copies by clearing this site’s data in your browser settings for ryazlee.github.io.",
      "You can revoke this app’s access to your Google account at any time at https://myaccount.google.com/permissions. Revoking access invalidates tokens so we can no longer access your Google user data.",
      "Because we do not keep a server-side copy of Google user data, there is nothing for us to delete from our servers after you sign out. Exported videos you download are saved only on your device; we do not keep a copy. To request confirmation of deletion, email ryan.j.lee99@gmail.com.",
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
      "Questions about privacy, retention, or deletion of Google user data: email ryan.j.lee99@gmail.com, or open an issue on the project repository.",
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
