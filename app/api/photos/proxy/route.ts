import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const accessToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  if (!url || !accessToken) {
    return NextResponse.json(
      { error: "Missing url or access token" },
      { status: 400 }
    );
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const allowedHosts = new Set([
    "lh3.googleusercontent.com",
    "lh4.googleusercontent.com",
    "lh5.googleusercontent.com",
    "lh6.googleusercontent.com",
    "video-downloads.googleusercontent.com",
    "gp3.googleusercontent.com",
  ]);

  if (
    !allowedHosts.has(target.hostname) &&
    !target.hostname.endsWith(".googleusercontent.com")
  ) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  const res = await fetch(target.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: "follow",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch media", status: res.status },
      { status: res.status }
    );
  }

  const contentType = res.headers.get("Content-Type") || "application/octet-stream";
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
