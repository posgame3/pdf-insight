type LogValue = string | number | boolean | null;

/**
 * Structured operational log. By construction it accepts only scalar metadata (codes, sizes, durations),
 * never document text, so uploaded content cannot leak into Cloudflare logs.
 */
export function logEvent(event: string, fields: Record<string, LogValue>): void {
  console.warn(JSON.stringify({ event, ...fields }));
}
