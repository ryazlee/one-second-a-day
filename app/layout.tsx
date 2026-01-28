export const metadata = {
  title: "1 Second a Day",
  description: "Create a 1-second-a-day video from Google Photos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}