export function roundToCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
