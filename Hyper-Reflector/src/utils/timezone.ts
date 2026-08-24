export const COMMON_TIMEZONES: { id: string; label: string }[] = [
  { id: "Pacific/Honolulu", label: "Honolulu" },
  { id: "America/Anchorage", label: "Anchorage" },
  { id: "America/Los_Angeles", label: "Los Angeles" },
  { id: "America/Denver", label: "Denver" },
  { id: "America/Chicago", label: "Chicago" },
  { id: "America/New_York", label: "New York" },
  { id: "America/Mexico_City", label: "Mexico City" },
  { id: "America/Sao_Paulo", label: "São Paulo" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Paris", label: "Paris" },
  { id: "Europe/Berlin", label: "Berlin" },
  { id: "Europe/Moscow", label: "Moscow" },
  { id: "Africa/Cairo", label: "Cairo" },
  { id: "Africa/Johannesburg", label: "Johannesburg" },
  { id: "Asia/Dubai", label: "Dubai" },
  { id: "Asia/Karachi", label: "Karachi" },
  { id: "Asia/Kolkata", label: "Kolkata" },
  { id: "Asia/Bangkok", label: "Bangkok" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Hong_Kong", label: "Hong Kong" },
  { id: "Asia/Shanghai", label: "Shanghai" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Asia/Seoul", label: "Seoul" },
  { id: "Australia/Perth", label: "Perth" },
  { id: "Australia/Sydney", label: "Sydney" },
  { id: "Pacific/Auckland", label: "Auckland" },
  { id: "UTC", label: "UTC" },
];

export function detectBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getUtcOffsetLabel(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date());
  const offset = parts.find((p) => p.type === "timeZoneName")?.value;
  return offset ?? "UTC";
}

// Converts a wall-clock date+time as it would read *in the given IANA zone*
// into a real UTC instant. No date library needed: treat the wall-clock
// components as if they were UTC to get a candidate instant, see what wall
// time that candidate actually reads as when formatted in the target zone,
// then correct by the drift. This naturally accounts for DST since the drift
// is derived from the zone's actual offset at that date.
export function zonedTimeToUtcIso(dateStr: string, timeStr: string, timeZone: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const candidateUtc = Date.UTC(year, month - 1, day, hour, minute);

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(candidateUtc)).map((p) => [p.type, p.value])
  );
  const asZoned = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  const driftMs = candidateUtc - asZoned;
  return new Date(candidateUtc + driftMs).toISOString();
}

// Inverse of `zonedTimeToUtcIso`: given a stored UTC instant, recovers the
// wall-clock date/time as it would have read in the given zone — used to
// pre-fill the date/time inputs when editing an existing tournament.
export function utcInstantToZonedInputs(isoInstant: string, timeZone: string): { date: string; time: string } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(isoInstant)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// `isoInstant` is a real UTC instant, so this always renders in the viewer's
// own local time regardless of what timezone it was originally scheduled in.
export function formatViewerLocal(isoInstant: string): string {
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) return isoInstant;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatInZone(isoInstant: string, timeZone: string): string {
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) return isoInstant;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });
}
