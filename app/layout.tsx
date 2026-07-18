import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "1 Second a Day",
  description: "Make a watermark-free one-second-a-day video from Google Photos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="app-shell">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
