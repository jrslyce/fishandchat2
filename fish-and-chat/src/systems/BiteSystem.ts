export function rollWaitSeconds(waitMultiplier: number): number {
  const base = 6 + Math.random() * 8; // 6-14s
  return base * waitMultiplier;
}

export function isWithinReactionWindow(biteElapsedSeconds: number, reactionWindowMs: number): boolean {
  return biteElapsedSeconds * 1000 <= reactionWindowMs;
}
