export function termsPeriod<
  T extends {
    kind: string;
    startsAt: Date;
    endsAt: Date;
    revokedAt: Date | null;
  },
>(periods: T[], now: Date): T | undefined {
  const rows = periods
    .filter((p) => p.startsAt <= now)
    .sort(
      (a, b) =>
        b.endsAt.getTime() - a.endsAt.getTime() ||
        Number(!!b.revokedAt) - Number(!!a.revokedAt),
    );
  return (
    rows.find((p) => p.kind === 'paid' && !p.revokedAt && p.endsAt > now) ??
    rows.find((p) => !p.revokedAt && p.endsAt > now) ??
    rows.find((p) => p.kind === 'paid') ??
    rows[0]
  );
}
