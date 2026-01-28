"use client";

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>1 Second a Day</h1>
      <p>Login with Google to generate your video.</p>

      <button
        onClick={() => {
          window.location.href = "/api/oauth/login";
        }}
      >
        Login with Google
      </button>
    </main>
  );
}
