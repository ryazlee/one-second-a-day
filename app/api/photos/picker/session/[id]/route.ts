import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> } // 👈 params is a Promise
) {
  const { id } = await params; // 👈 unwrap it

  const { accessToken } = await req.json();

  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const res = await fetch(`https://photospicker.googleapis.com/v1/sessions/${id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();
  return NextResponse.json(data);
}
