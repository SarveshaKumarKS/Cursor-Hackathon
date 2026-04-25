// Small time-formatting and slot helpers shared across UI components.

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function fmtCountdown(ms) {
  if (ms == null || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtClock(ms) {
  if (ms == null) return "";
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

export function fmtRelativeWindow(ms) {
  if (ms == null) return "";
  const now = Date.now();
  const target = new Date(ms);
  const diff = target.getTime() - now;
  const absHours = Math.abs(diff) / (60 * 60 * 1000);
  if (absHours < 24) {
    // Same calendar window: show clock only.
    return fmtClock(ms);
  }
  return `${WEEKDAY_LABELS[target.getDay()]} ${fmtClock(ms)}`;
}

// Convert a Date to <input type="datetime-local"> string in local TZ.
export function toLocalInputValue(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const da = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${y}-${mo}-${da}T${h}:${mi}`;
}

export function fromLocalInputValue(s) {
  if (!s) return null;
  return new Date(s);
}

export function minuteToClockLabel(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, "0")}${ampm}`;
}
