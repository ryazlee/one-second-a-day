/** Module-level Google token so fetches can refresh without React. */

type Refresher = () => Promise<{ accessToken: string; expiresIn: number }>;
type Persist = (token: string, expiresInSeconds: number) => void;

let token: string | null = null;
let expiresAt = 0;
let refresher: Refresher | null = null;
let persist: Persist | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAuthState(
  nextToken: string | null,
  nextExpiresAt: number
) {
  token = nextToken;
  expiresAt = nextExpiresAt;
}

export function registerAuthBridge(next: {
  refresher: Refresher;
  persist: Persist;
}) {
  refresher = next.refresher;
  persist = next.persist;
}

export function peekAccessToken(): string | null {
  return token;
}

export async function ensureFreshToken(
  options: { force?: boolean; minRemainingMs?: number } = {}
): Promise<string | null> {
  const minRemainingMs = options.minRemainingMs ?? 90_000;
  if (!options.force && token && expiresAt - Date.now() > minRemainingMs) {
    return token;
  }
  if (!refresher) return token;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const next = await refresher!();
      token = next.accessToken;
      expiresAt = Date.now() + Math.max(60, next.expiresIn) * 1000;
      persist?.(next.accessToken, next.expiresIn);
      return token;
    } catch {
      return token;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
