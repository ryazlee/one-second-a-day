import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const accessToken = req.headers.get("Authorization")?.replace("Bearer ", "");

  if (!url || !accessToken) {
    return NextResponse.json(
      { error: "Missing url or access token" },
      { status: 400 }
    );
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch media", status: res.status },
      { status: res.status }
    );
  }

  const contentType = res.headers.get("Content-Type") || "application/octet-stream";
  const blob = await res.blob();

  return new NextResponse(blob, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
