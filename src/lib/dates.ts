export function dayKeyFromIso(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function formatDayLabel(dayKey: string): string {
  const date = new Date(`${dayKey}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatStamp(dayKey: string): string {
  const date = new Date(`${dayKey}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatSeconds(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "0:00.0";
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}
