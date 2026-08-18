import { APP_DESCRIPTION, APP_NAME } from "@/src/content/app";
import { Providers } from "./providers";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata = {
  title: APP_NAME,
  applicationName: APP_NAME,
  description: APP_DESCRIPTION,
  verification: {
    google: "tWnMVazQifLr9I-uIWsSSt0P2W7hJ8ngXofE1Ab6mNY",
  },
  icons: {
    icon: [
      { url: `${basePath}/favicon.ico`, sizes: "any" },
      { url: `${basePath}/icon.png`, type: "image/png" },
    ],
    apple: [{ url: `${basePath}/apple-touch-icon.png` }],
  },
};

const themeInitScript = `
try {
  var saved = localStorage.getItem('one-second-a-day-theme');
  var dark =
    saved === 'dark' ||
    (saved !== 'light' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) {
    document.documentElement.classList.add('theme-dark');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', '#111827');
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#fafafa" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
