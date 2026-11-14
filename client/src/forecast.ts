// Forecast logic shared by Overview and Career Twin (kept free of chart code so it doesn't enlarge the first load).
import { useMemo } from 'react';
import { forecastReadiness, weeksToReach } from '../../shared/engine';
import type { AppState } from '../../shared/types';

/** Readiness level the forecast reports a projected date for. */
export const FORECAST_TARGET = 70;

/** Shared helper: projected timeline for the current roadmap at a given weekly study time. */
export function useForecast(state: AppState, weeklyHours: number) {
  return useMemo(() => {
    if (!state.roadmap) return null;
    const done = new Set(
      Object.values(state.progress)
        .filter((p) => p.status === 'done')
        .map((p) => p.key),
    );
    const points = forecastReadiness(
      state.profile,
      state.evidence,
      state.profile.targetRoleId,
      state.roadmap.milestones,
      done,
      weeklyHours,
    );
    return { points, toTarget: weeksToReach(points, FORECAST_TARGET), final: points[points.length - 1] };
  }, [state, weeklyHours]);
}
