export async function GET(req: Request) {
  const auth = req.headers.get("authorization");

  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  const res = await fetch(
    "https://photoslibrary.googleapis.com/v1/mediaItems:search",
    {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pageSize: 100,
        filters: {
          mediaTypeFilter: {
            mediaTypes: ["VIDEO"],
          },
        },
      }),
    }
  );

  return Response.json(await res.json());
}
