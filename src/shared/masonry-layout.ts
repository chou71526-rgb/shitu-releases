export function balanceMasonryColumns<T extends { width: number; height: number }>(items: T[], columnCount: number): T[][] {
  const count = Math.max(1, Math.min(columnCount, items.length));
  const columns = Array.from({ length: count }, () => [] as T[]);
  const estimatedHeights = Array.from({ length: count }, () => 0);

  for (const item of items) {
    let target = 0;
    for (let index = 1; index < count; index += 1) {
      if (estimatedHeights[index] < estimatedHeights[target]) target = index;
    }
    columns[target].push(item);
    const aspectHeight = item.height / Math.max(1, item.width);
    estimatedHeights[target] += Math.min(2.2, Math.max(.35, aspectHeight)) + .35;
  }

  return columns;
}
