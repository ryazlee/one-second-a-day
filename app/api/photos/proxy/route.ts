import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function retryable(status: number) {
  return (
    status === 404 ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUpstream(url: string, accessToken: string) {
  let last: Response | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: "follow",
      });
      if (res.ok) return res;
      last = res;
      if (!retryable(res.status) || attempt === 3) return res;
      await sleep(400 * 2 ** attempt);
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(400 * 2 ** attempt);
    }
  }

  return last;
}

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

  let res: Response | null;
  try {
    res = await fetchUpstream(target.toString(), accessToken);
  } catch {
    return NextResponse.json(
      { error: "Timed out fetching media from Google Photos" },
      { status: 504 }
    );
  }

  if (!res) {
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch media", status: res.status },
      { status: res.status }
    );
  }

  const contentType = res.headers.get("Content-Type") || "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
  };
  const length = res.headers.get("Content-Length");
  if (length) headers["Content-Length"] = length;

  return new NextResponse(res.body, { headers });
}
