export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function fetchWithRetry(
  input: string,
  init: RequestInit & {
    timeoutMs?: number;
    retries?: number;
    retryOn?: (response: Response) => boolean;
  } = {}
): Promise<Response> {
  const {
    timeoutMs = 60_000,
    retries = 3,
    retryOn,
    ...rest
  } = init;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const parent = rest.signal;
    const onAbort = () => controller.abort();
    parent?.addEventListener("abort", onAbort);

    try {
      const response = await fetch(input, {
        ...rest,
        signal: controller.signal,
        cache: rest.cache ?? "no-store",
      });

      const retryable =
        retryOn?.(response) ?? shouldRetryStatus(response.status);

      if (!response.ok && retryable && attempt < retries) {
        lastError = new Error(`HTTP ${response.status}`);
        await wait(400 * 2 ** attempt);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      const aborted =
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError");
      if (parent?.aborted) throw error;
      if (attempt >= retries) {
        if (aborted) throw new Error("Timed out talking to Google Photos");
        throw error;
      }
      await wait(400 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", onAbort);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Network request failed");
}

export function friendlyHttpError(status: number, kind: "photo" | "video") {
  const noun = kind === "photo" ? "photo" : "video";
  if (status === 401) return "Google sign-in expired — tap to sign in again";
  if (status === 403) {
    return `Couldn’t download this ${noun} (link expired). Retrying…`;
  }
  if (status === 404) {
    return `This ${noun} isn’t ready yet — Google may still be processing it`;
  }
  if (status === 429) return "Google Photos is rate-limiting downloads — retrying";
  return `Failed to fetch ${noun} (${status})`;
}
