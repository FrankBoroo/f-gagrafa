// The height of one bar in a chart whose tallest bar is `fullHeight`. Never negative: a
// day where refunds exceed receipts has a negative value, and SVG rejects negative heights.
export function barHeight(value: number, max: number, fullHeight: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return (value / max) * fullHeight;
}
