export function rhythmPoints(count, completed) {
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? .5 : i / (count - 1);
    return { x: 28 + 304 * t, y: 70 - 200 * t * (1 - t), state: i < completed ? 'done' : i === completed ? 'current' : 'future' };
  });
}
export function budgetFraction(logged, target) {
  return target > 0 ? Math.max(0, Math.min(1, logged / target)) : 0;
}
