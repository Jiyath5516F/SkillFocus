import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AppState } from '../../../shared/types';
import { FORECAST_TARGET, useForecast } from '../forecast';
import { SelectMenu } from './hui';
import { Badge, Card, CHART_TOOLTIP } from './ui';

const inWeeks = (w: number) =>
  new Date(Date.now() + w * 7 * 86_400_000).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

/** Career Twin forecast: deterministic projection with a study-time simulator (never saved). */
export function ForecastCard({ state }: { state: AppState }) {
  const [hours, setHours] = useState(state.profile.weeklyHours);
  const f = useForecast(state, hours);
  const options = [...new Set([4, 6, 8, 10, 12, 15, 20, state.profile.weeklyHours])]
    .sort((a, b) => a - b)
    .map((h) => ({ value: h, label: `${h} h / week${h === state.profile.weeklyHours ? ' (your plan)' : ''}` }));

  return (
    <Card
      title="Readiness forecast"
      subtitle="Projection if each milestone is completed and then verified by an assessment — not a promise, never saved"
      action={
        <SelectMenu
          label="Weekly study time"
          srOnlyLabel
          className="w-48"
          value={hours}
          onChange={setHours}
          options={options}
        />
      }
    >
      {!f ? (
        <p className="text-sm text-white/60">Run an analysis to get a roadmap first.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-white/80">
            <Badge tone="violet">Projection</Badge>
            {f.toTarget !== null ? (
              <span>
                At <b>{hours} h/week</b>, readiness could reach <b>{FORECAST_TARGET}%</b> in about{' '}
                <b>{Math.ceil(f.toTarget)} weeks</b> (around {inWeeks(f.toTarget)}).
              </span>
            ) : (
              <span>
                The current roadmap projects <b>{f.final.readiness}%</b> after about {Math.ceil(f.final.week)} weeks.
              </span>
            )}
            {hours !== state.profile.weeklyHours && <span className="text-white/60">(simulated study time)</span>}
          </div>
          <div
            className="h-60"
            role="img"
            aria-label={`Projected readiness rising from ${f.points[0].readiness}% to ${f.final.readiness}% over ${Math.ceil(f.final.week)} weeks.`}
          >
            <ResponsiveContainer>
              <LineChart data={f.points} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#ffffff14" />
                <XAxis
                  dataKey="week"
                  type="number"
                  domain={[0, 'dataMax']}
                  tick={{ fontSize: 11, fill: '#ffffffb3' }}
                  tickFormatter={(w) => `wk ${w}`}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#ffffffb3' }} />
                <ReferenceLine
                  y={FORECAST_TARGET}
                  stroke="#9ca3af"
                  strokeDasharray="4 3"
                  label={{
                    value: `${FORECAST_TARGET}% target`,
                    fontSize: 10,
                    fill: '#ffffffb3',
                    position: 'insideTopLeft',
                  }}
                />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(v) => [`${v}%`, 'Projected readiness']}
                  labelFormatter={(w, p) =>
                    `Week ${w}${p?.[0]?.payload?.milestone ? ` · after “${p[0].payload.milestone}”` : ''}`
                  }
                />
                <Line type="stepAfter" dataKey="readiness" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}
