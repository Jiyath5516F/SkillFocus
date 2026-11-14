// roadmap.sh-style visual roadmap: a central spine of skill nodes, with remediation steps and resources
// branching off on dotted connectors. Every node opens a Headless UI Popover with the full milestone details.
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { ArrowTopRightOnSquareIcon, CheckIcon, WrenchScrewdriverIcon } from '@heroicons/react/20/solid';
import { LEVEL_LABELS, RESOURCE_BY_ID, skillName } from '../../../shared/catalog';
import type { Milestone, MilestoneProgress, MilestoneStatus } from '../../../shared/types';
import { Segmented } from './hui';
import { Badge } from './ui';

const STATUS_OPTIONS: { value: MilestoneStatus; label: string }[] = [
  { value: 'todo', label: 'To do' }, { value: 'in_progress', label: 'In progress' }, { value: 'done', label: 'Done' },
];

interface Group { main: Milestone; fixes: Milestone[] }

function groupBySkill(milestones: Milestone[]): Group[] {
  const groups: Group[] = [];
  for (const m of milestones) {
    const g = groups.find((x) => x.main.skillId === m.skillId);
    if (m.kind === 'learn' || !g) groups.push({ main: m, fixes: [] });
    else g.fixes.push(m);
  }
  return groups;
}

function StatusMark({ status }: { status: MilestoneStatus }) {
  if (status === 'done') return <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-neutral-950" title="Done"><CheckIcon className="size-3.5 text-black" /></span>;
  if (status === 'in_progress') return <span className="absolute -top-1.5 -right-1.5 size-3.5 rounded-full bg-amber-400 ring-2 ring-neutral-950" title="In progress" />;
  return null;
}

function Details({ m, status, editable, onStatus }: { m: Milestone; status: MilestoneStatus; editable: boolean; onStatus: (s: MilestoneStatus) => void }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        {m.kind === 'remediation' ? <Badge tone="rose">Targeted remediation</Badge> : <Badge tone="brand">{skillName(m.skillId)} → {LEVEL_LABELS[m.targetLevel]}</Badge>}
        <Badge tone={m.authoredBy === 'ai' ? 'violet' : 'amber'}>{m.authoredBy === 'ai' ? 'AI-personalised' : 'Rule-based'}</Badge>
      </div>
      <p className="font-semibold text-white">{m.title}</p>
      <p className="text-white/70">{m.reason}</p>
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-white/60">Practical exercise</div>
        <p className="text-white/80">{m.exercise}</p>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-white/60">Resources · ~{m.effortHours}h</div>
        <ul className="space-y-1">
          {m.resourceIds.map((id) => RESOURCE_BY_ID[id]).filter(Boolean).map((r) => (
            <li key={r.id}><a href={r.url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200">{r.title} <ArrowTopRightOnSquareIcon aria-hidden className="inline size-3.5" /></a> <span className="text-white/60">· {r.provider}</span></li>
          ))}
        </ul>
      </div>
      {editable && <Segmented label={`Status for ${m.title}`} value={status} options={STATUS_OPTIONS} onChange={onStatus} />}
    </div>
  );
}

/** A node that opens its milestone details in a popover. */
function Node({ m, status, editable, onStatus, variant }: { m: Milestone; status: MilestoneStatus; editable: boolean; onStatus: (s: MilestoneStatus) => void; variant: 'main' | 'fix' }) {
  const look = variant === 'main'
    ? `w-60 px-4 py-3 text-sm font-semibold ${status === 'done' ? 'bg-emerald-500/15 ring-emerald-400/60' : 'bg-indigo-500/20 ring-indigo-400/60 hover:bg-indigo-500/30'}`
    : `max-w-56 px-3 py-2 text-xs font-medium ${status === 'done' ? 'bg-emerald-500/10 ring-emerald-400/40' : 'bg-rose-500/10 ring-rose-400/40 hover:bg-rose-500/20'}`;
  return (
    <Popover className="relative">
      <PopoverButton className={`relative block rounded-lg text-left text-white ring-1 backdrop-blur focus:outline-none data-focus:outline-2 data-focus:outline-white ${look}`}>
        {variant === 'fix' && <WrenchScrewdriverIcon aria-hidden className="mr-1 inline size-3.5 text-rose-300" />}
        {variant === 'main' ? skillName(m.skillId) : (m.concept ? m.title : m.title)}
        {variant === 'main' && <span className="mt-0.5 block text-xs font-normal text-white/60">{LEVEL_LABELS[m.targetLevel]} · ~{m.effortHours}h</span>}
        <StatusMark status={status} />
      </PopoverButton>
      <PopoverPanel anchor="bottom" transition
        className="z-50 w-80 rounded-xl bg-neutral-900/95 p-4 shadow-2xl ring-1 ring-white/15 backdrop-blur-xl [--anchor-gap:8px] transition duration-150 ease-out data-closed:opacity-0">
        <Details m={m} status={status} editable={editable} onStatus={onStatus} />
      </PopoverPanel>
    </Popover>
  );
}

function Connector({ side }: { side: 'left' | 'right' }) {
  return <span aria-hidden className={`hidden h-0 w-8 border-t-2 border-dotted border-indigo-400/50 md:block lg:w-12 ${side === 'left' ? '' : ''}`} />;
}

export function RoadmapMap({ milestones, progress, roleTitle, editable, onStatus }: {
  milestones: Milestone[]; progress: Record<string, MilestoneProgress>; roleTitle: string; editable: boolean; onStatus: (key: string, s: MilestoneStatus) => void;
}) {
  const groups = groupBySkill(milestones);
  const st = (m: Milestone): MilestoneStatus => progress[m.key]?.status ?? 'todo';

  const resourceChips = (m: Milestone, align: 'left' | 'right') => m.resourceIds.map((id) => RESOURCE_BY_ID[id]).filter(Boolean).map((r) => (
    <div key={r.id} className={`flex items-center ${align === 'left' ? 'justify-end' : 'justify-start'}`}>
      {align === 'right' && <Connector side="right" />}
      <a href={r.url} target="_blank" rel="noreferrer" className="max-w-56 truncate rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80 ring-1 ring-white/10 hover:bg-white/10 hover:text-white">
        {r.title} <ArrowTopRightOnSquareIcon aria-hidden className="inline size-3" />
      </a>
      {align === 'left' && <Connector side="left" />}
    </div>
  ));
  const fixChips = (g: Group, align: 'left' | 'right') => g.fixes.map((f) => (
    <div key={f.key} className={`flex items-center ${align === 'left' ? 'justify-end' : 'justify-start'}`}>
      {align === 'right' && <Connector side="right" />}
      <Node m={f} status={st(f)} editable={editable} onStatus={(s) => onStatus(f.key, s)} variant="fix" />
      {align === 'left' && <Connector side="left" />}
    </div>
  ));

  return (
    <div className="relative overflow-x-auto rounded-xl bg-white/[0.02] px-4 py-8 ring-1 ring-white/10">
      <ul className="mb-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-white/70" aria-label="Legend">
        <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-indigo-500/40 ring-1 ring-indigo-400/60" /> Skill milestone</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-rose-500/30 ring-1 ring-rose-400/50" /> Remediation from your assessment</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-white/10 ring-1 ring-white/20" /> Resource</li>
        <li className="flex items-center gap-1.5"><span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-500"><CheckIcon className="size-2.5 text-black" /></span> Done</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-amber-400" /> In progress</li>
      </ul>

      <div className="relative mx-auto min-w-0 max-w-5xl">
        <span aria-hidden className="absolute top-0 bottom-0 left-1/2 hidden w-0.5 -translate-x-1/2 bg-linear-to-b from-indigo-400/0 via-indigo-400/60 to-indigo-400/20 md:block" />
        <div className="relative mb-8 flex flex-col items-center">
          <span aria-hidden className="h-8 border-l-2 border-dotted border-indigo-400/50" />
          <h3 className="rounded-full bg-neutral-950 px-5 py-2 text-lg font-bold tracking-tight text-white ring-1 ring-white/15">{roleTitle}</h3>
        </div>
        <ol className="space-y-8">
          {groups.map((g, i) => {
            const fixesLeft = i % 2 === 0;
            return (
              <li key={g.main.key} className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_auto_1fr] md:gap-0">
                <div className="order-2 space-y-2 md:order-1">{fixesLeft ? fixChips(g, 'left') : null}{!fixesLeft ? resourceChips(g.main, 'left') : null}</div>
                <div className="order-1 flex justify-center md:order-2">
                  <div className="relative bg-neutral-950 rounded-lg"><Node m={g.main} status={st(g.main)} editable={editable} onStatus={(s) => onStatus(g.main.key, s)} variant="main" /></div>
                </div>
                <div className="order-3 space-y-2">{fixesLeft ? resourceChips(g.main, 'right') : fixChips(g, 'right')}</div>
              </li>
            );
          })}
        </ol>
        <div className="relative mt-8 flex justify-center">
          <span className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/40">Ready for {roleTitle}</span>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-white/60">Click any node for the reason, exercise, resources and status.</p>
    </div>
  );
}
