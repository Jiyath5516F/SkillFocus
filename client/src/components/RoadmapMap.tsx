// roadmap.sh-style layout in Mira's dark Headless UI style: a glowing indigo spine of skill nodes, with
// remediation steps and resources fanning out on curved, dotted connectors. Layout is computed deterministically so the SVG
// connectors line up exactly with the nodes. Every node opens a Headless UI Popover with full details.
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { ArrowTopRightOnSquareIcon, CheckIcon } from '@heroicons/react/20/solid';
import { LEVEL_LABELS, RESOURCE_BY_ID, skillName } from '../../../shared/catalog';
import type { Milestone, MilestoneProgress, MilestoneStatus, Resource } from '../../../shared/types';
import { Segmented } from './hui';
import { Badge } from './ui';

const STATUS_OPTIONS: { value: MilestoneStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

// Mira palette (indigo accent on the dark Headless UI canvas)
const BLUE = '#818cf8';

// Canvas geometry (px). The canvas scrolls horizontally on narrow screens, like roadmap.sh.
const W = 1000,
  CX = W / 2;
const MAIN_W = 230,
  MAIN_H = 46;
const SUB_W = 250,
  SUB_H = 40,
  SUB_GAP = 10;
const LEFT_X = 30,
  RIGHT_X = W - 30 - SUB_W;
const GROUP_GAP = 46,
  TOP = 200;

interface Group {
  main: Milestone;
  fixes: Milestone[];
}
type Side = { kind: 'fix'; m: Milestone } | { kind: 'res'; r: Resource };

function groupBySkill(milestones: Milestone[]): Group[] {
  const groups: Group[] = [];
  for (const m of milestones) {
    const g = groups.find((x) => x.main.skillId === m.skillId);
    if (m.kind === 'learn' || !g) groups.push({ main: m, fixes: [] });
    else g.fixes.push(m);
  }
  return groups;
}

function layout(groups: Group[]) {
  let y = TOP;
  const blocks = groups.map((g, i) => {
    const res: Side[] = g.main.resourceIds
      .map((id) => RESOURCE_BY_ID[id])
      .filter(Boolean)
      .map((r) => ({ kind: 'res', r }));
    const fixes: Side[] = g.fixes.map((m) => ({ kind: 'fix', m }));
    // Remediation goes on the side with more room; alternate sides between groups like roadmap.sh.
    const left = i % 2 === 0 ? (fixes.length ? fixes : res) : fixes.length ? res : [];
    const right = i % 2 === 0 ? (fixes.length ? res : []) : fixes.length ? fixes : res;
    const colH = (n: number) => (n ? n * SUB_H + (n - 1) * SUB_GAP : 0);
    const h = Math.max(MAIN_H, colH(left.length), colH(right.length));
    const cy = y + h / 2;
    const place = (items: Side[], x: number) =>
      items.map((it, k) => ({ it, x, y: cy - colH(items.length) / 2 + k * (SUB_H + SUB_GAP) }));
    const block = { g, cy, mainY: cy - MAIN_H / 2, left: place(left, LEFT_X), right: place(right, RIGHT_X) };
    y += h + GROUP_GAP;
    return block;
  });
  return { blocks, height: y };
}

/** Curved dotted connector from the main node edge to a side node, fanning like roadmap.sh. */
function fan(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function CheckBadge({ status }: { status: MilestoneStatus }) {
  if (status === 'done')
    return (
      <span
        title="Done"
        className="absolute -top-2.5 -right-2.5 flex size-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-neutral-950"
      >
        <CheckIcon className="size-3.5 text-black" />
      </span>
    );
  if (status === 'in_progress')
    return (
      <span
        title="In progress"
        className="absolute -top-2 -right-2 size-4 rounded-full bg-amber-400 ring-2 ring-neutral-950"
      />
    );
  return null;
}

function Details({
  m,
  status,
  editable,
  onStatus,
}: {
  m: Milestone;
  status: MilestoneStatus;
  editable: boolean;
  onStatus: (s: MilestoneStatus) => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        {m.kind === 'remediation' ? (
          <Badge tone="rose">Targeted remediation</Badge>
        ) : (
          <Badge tone="brand">
            {skillName(m.skillId)} → {LEVEL_LABELS[m.targetLevel]}
          </Badge>
        )}
        <Badge tone={m.authoredBy === 'ai' ? 'violet' : 'amber'}>
          {m.authoredBy === 'ai' ? 'AI-personalised' : 'Rule-based'}
        </Badge>
      </div>
      <p className="font-semibold text-white">{m.title}</p>
      <p className="text-white/70">{m.reason}</p>
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-white/60">Practical exercise</div>
        <p className="text-white/80">{m.exercise}</p>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-white/60">
          Resources · ~{m.effortHours}h
        </div>
        <ul className="space-y-1">
          {m.resourceIds
            .map((id) => RESOURCE_BY_ID[id])
            .filter(Boolean)
            .map((r) => (
              <li key={r.id}>
                <a href={r.url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200">
                  {r.title} <ArrowTopRightOnSquareIcon aria-hidden className="inline size-3.5" />
                </a>{' '}
                <span className="text-white/60">· {r.provider}</span>
              </li>
            ))}
        </ul>
      </div>
      {editable && (
        <Segmented label={`Status for ${m.title}`} value={status} options={STATUS_OPTIONS} onChange={onStatus} />
      )}
    </div>
  );
}

function NodeButton({
  m,
  status,
  editable,
  onStatus,
  className,
  style,
  children,
}: {
  m: Milestone;
  status: MilestoneStatus;
  editable: boolean;
  onStatus: (s: MilestoneStatus) => void;
  className: string;
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <Popover className="absolute" style={style}>
      <PopoverButton
        className={`relative flex h-full w-full items-center justify-center rounded-lg px-3 text-center text-white ring-1 backdrop-blur transition focus:outline-none data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-white ${className}`}
      >
        {children}
        <CheckBadge status={status} />
      </PopoverButton>
      <PopoverPanel
        anchor="bottom"
        transition
        className="z-50 w-80 rounded-xl bg-neutral-900/95 p-4 shadow-2xl ring-1 ring-white/15 backdrop-blur-xl [--anchor-gap:8px] transition duration-150 ease-out data-closed:opacity-0"
      >
        <Details m={m} status={status} editable={editable} onStatus={onStatus} />
      </PopoverPanel>
    </Popover>
  );
}

export function RoadmapMap({
  milestones,
  progress,
  roleTitle,
  editable,
  onStatus,
}: {
  milestones: Milestone[];
  progress: Record<string, MilestoneProgress>;
  roleTitle: string;
  editable: boolean;
  onStatus: (key: string, s: MilestoneStatus) => void;
}) {
  const { blocks, height } = layout(groupBySkill(milestones));
  const st = (m: Milestone): MilestoneStatus => progress[m.key]?.status ?? 'todo';
  const lastCy = blocks.length ? blocks[blocks.length - 1].cy : TOP;

  return (
    <div className="overflow-x-auto rounded-xl bg-white/[0.02] ring-1 ring-white/10">
      <div className="relative mx-auto" style={{ width: W, height: height + 60 }}>
        {/* Legend, roadmap.sh style */}
        <div className="absolute top-5 left-5 space-y-1.5 rounded-xl bg-white/5 px-4 py-3 text-xs text-white/80 ring-1 ring-white/10 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500">
              <CheckIcon className="size-3 text-black" />
            </span>{' '}
            Done
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3.5 rounded-full bg-amber-400" /> In progress
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-5 rounded bg-indigo-500/30 ring-1 ring-indigo-400/70" /> Skill
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-5 rounded bg-rose-500/20 ring-1 ring-rose-400/50" /> Remediation from your assessment
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-5 rounded bg-white/5 ring-1 ring-white/15" /> Resource (opens in a new tab)
          </div>
        </div>
        <div className="absolute top-5 right-5 max-w-56 rounded-xl bg-white/5 px-4 py-3 text-xs text-white/70 ring-1 ring-white/10 backdrop-blur">
          Click any node for the reason, exercise, resources and status.
        </div>

        <svg aria-hidden className="pointer-events-none absolute inset-0" width={W} height={height + 60}>
          {/* dotted lead-in above the title, then the solid spine */}
          <defs>
            <linearGradient id="spine" gradientUnits="userSpaceOnUse" x1={CX} y1={TOP - 30} x2={CX} y2={lastCy + 70}>
              <stop offset="0" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="0.5" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#6366f1" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <line
            x1={CX}
            y1={0}
            x2={CX}
            y2={TOP - 78}
            stroke={BLUE}
            strokeOpacity={0.6}
            strokeWidth={2.5}
            strokeDasharray="0.5 7"
            strokeLinecap="round"
          />
          <line
            x1={CX}
            y1={TOP - 30}
            x2={CX}
            y2={lastCy + 70}
            stroke="url(#spine)"
            strokeWidth={3}
            style={{ filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.6))' }}
          />
          {blocks.map((b) => [
            ...b.left.map((n, k) => (
              <path
                key={`l${b.g.main.key}${k}`}
                d={fan(CX - MAIN_W / 2, b.cy, n.x + SUB_W, n.y + SUB_H / 2)}
                fill="none"
                stroke={BLUE}
                strokeOpacity={0.75}
                strokeWidth={2.5}
                strokeDasharray="0.5 7"
                strokeLinecap="round"
              />
            )),
            ...b.right.map((n, k) => (
              <path
                key={`r${b.g.main.key}${k}`}
                d={fan(CX + MAIN_W / 2, b.cy, n.x, n.y + SUB_H / 2)}
                fill="none"
                stroke={BLUE}
                strokeOpacity={0.75}
                strokeWidth={2.5}
                strokeDasharray="0.5 7"
                strokeLinecap="round"
              />
            )),
          ])}
        </svg>

        <div className="absolute flex justify-center" style={{ left: 0, width: W, top: TOP - 78 }}>
          <h3 className="rounded-full bg-neutral-950 px-6 py-2 text-xl font-bold tracking-tight text-white ring-1 ring-white/15">
            {roleTitle}
          </h3>
        </div>

        <ol aria-label="Roadmap">
          {blocks.map((b) => (
            <li key={b.g.main.key}>
              <NodeButton
                m={b.g.main}
                status={st(b.g.main)}
                editable={editable}
                onStatus={(s) => onStatus(b.g.main.key, s)}
                className={`text-sm font-semibold ${st(b.g.main) === 'done' ? 'bg-emerald-500/15 ring-emerald-400/60' : 'bg-indigo-500/25 ring-indigo-400/70 hover:bg-indigo-500/35'} shadow-[0_0_24px_-8px_rgba(129,140,248,0.8)]`}
                style={{ left: CX - MAIN_W / 2, top: b.mainY, width: MAIN_W, height: MAIN_H }}
              >
                {skillName(b.g.main.skillId)}
              </NodeButton>
              {[...b.left, ...b.right].map(({ it, x, y }) =>
                it.kind === 'fix' ? (
                  <NodeButton
                    key={it.m.key}
                    m={it.m}
                    status={st(it.m)}
                    editable={editable}
                    onStatus={(s) => onStatus(it.m.key, s)}
                    className={`text-xs leading-tight ${st(it.m) === 'done' ? 'bg-emerald-500/10 ring-emerald-400/40' : 'bg-rose-500/15 ring-rose-400/50 hover:bg-rose-500/25'}`}
                    style={{ left: x, top: y, width: SUB_W, height: SUB_H }}
                  >
                    <span className="line-clamp-2">{it.m.title}</span>
                  </NodeButton>
                ) : (
                  <a
                    key={it.r.id}
                    href={it.r.url}
                    target="_blank"
                    rel="noreferrer"
                    title={`${it.r.title} · ${it.r.provider}`}
                    className="absolute flex items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 text-center text-xs leading-tight text-white/80 ring-1 ring-white/10 backdrop-blur hover:bg-white/10 hover:text-white"
                    style={{ left: x, top: y, width: SUB_W, height: SUB_H }}
                  >
                    <span className="truncate">{it.r.title}</span>
                    <ArrowTopRightOnSquareIcon aria-hidden className="size-3.5 shrink-0" />
                  </a>
                ),
              )}
            </li>
          ))}
        </ol>

        <div className="absolute flex justify-center" style={{ left: 0, width: W, top: lastCy + 70 }}>
          <span className="rounded-full bg-emerald-500/15 px-5 py-2 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/40">
            Ready for {roleTitle}
          </span>
        </div>
      </div>
    </div>
  );
}
