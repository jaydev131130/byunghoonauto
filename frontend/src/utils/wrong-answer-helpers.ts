export function parseNumbers(input: string): number[] {
  if (!input.trim()) return [];
  return [
    ...new Set(
      input
        .split(/[,\s]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0),
    ),
  ].sort((a, b) => a - b);
}

export function getRelativeDate(dateStr: string): string {
  const created = new Date(dateStr + "Z");
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  if (diffMs < 0) return "방금";
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "1일 전";
  return `${diffDays}일 전`;
}
