export function formatScore(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}


