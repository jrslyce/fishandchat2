export const CAST_GAUGE_PERIOD_SECONDS = 1.2;

export interface CastGauge {
  sweetSpot: number;
  sweetSpotWidth: number;
}

export function randomSweetSpot(): CastGauge {
  // Width is the half-extent of the non-zero-precision zone. It must be small
  // relative to the track (the UI renders the band at sweetSpot +/- width), and
  // sweetSpot's 0.3-0.7 range keeps the whole band inside the track.
  return {
    sweetSpot: 0.3 + Math.random() * 0.4,
    sweetSpotWidth: 0.18,
  };
}

/** Oscillating 0..1 slider value at the given elapsed aiming time. */
export function gaugeValue(aimElapsedSeconds: number): number {
  return (Math.sin((aimElapsedSeconds / CAST_GAUGE_PERIOD_SECONDS) * Math.PI * 2) + 1) / 2;
}

/** 0 (miss) .. 1 (perfect) based on distance from the sweet spot. */
export function castPrecision(value: number, gauge: CastGauge): number {
  const distance = Math.abs(value - gauge.sweetSpot);
  return Math.max(0, 1 - distance / gauge.sweetSpotWidth);
}

/** Precision scales into 0-10 bonus effective skill, per the design doc. */
export function precisionSkillBonus(precision: number): number {
  return Math.round(precision * 10);
}
