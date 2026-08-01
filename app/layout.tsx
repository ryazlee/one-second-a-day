import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "1 Second a Day",
  description: "Make a watermark-free one-second-a-day video from Google Photos",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png" }],
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
