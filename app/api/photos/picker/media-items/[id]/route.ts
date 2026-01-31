export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { accessToken } = await req.json();

  if (!accessToken) {
    return Response.json({ error: "Missing access token" }, { status: 401 });
  }

  const res = await fetch(
    `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${id}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return Response.json(await res.json());
}
