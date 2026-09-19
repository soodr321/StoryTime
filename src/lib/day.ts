/**
 * One answer to "what day is it" for the whole app.
 *
 * A reading day runs 4am to 4am, not midnight to midnight. A story that starts at 11:50pm and
 * finishes at 12:05am is one bedtime, not two: without this, the night count jumps by two, the
 * week strip lights two circles, and "one new sound a day" lets a second sound through at midnight.
 */
export const DAY_START_HOUR = 4;

/** The reading day a moment belongs to, as YYYY-MM-DD. Compare these, never Date objects. */
export function dayStamp(t: number | Date = Date.now()): string {
  const d = new Date(t);
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);   // small hours belong to the evening before
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const sameDay = (a: number | Date, b: number | Date = Date.now()) => dayStamp(a) === dayStamp(b);

/** Distinct reading days in a list of moments. */
export const countDays = (times: (number | string | Date)[]) => new Set(times.map((t) => dayStamp(typeof t === "string" ? new Date(t) : t))).size;
