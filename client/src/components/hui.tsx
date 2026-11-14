// Styled Headless UI primitives (Tailwind / headlessui.com look) used across Mira.
import {
  Checkbox,
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Field,
  Input,
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Radio,
  RadioGroup,
  Textarea,
} from '@headlessui/react';
import { useState, type ReactNode } from 'react';

// Dark style mirrors the Headless UI documentation examples (bg-white/5 surfaces, white/25 focus outlines).
const inputCls =
  'block w-full rounded-lg border-none bg-white/5 px-3 py-1.5 text-sm/6 text-white placeholder:text-white/50 focus:outline-2 focus:-outline-offset-2 focus:outline-white/25';

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="size-4 text-white/60">
      <path
        fillRule="evenodd"
        d="M5.22 10.22a.75.75 0 0 1 1.06 0L8 11.94l1.72-1.72a.75.75 0 1 1 1.06 1.06l-2.25 2.25a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 0 1 0-1.06ZM10.78 5.78a.75.75 0 0 1-1.06 0L8 4.06 6.28 5.78a.75.75 0 0 1-1.06-1.06l2.25-2.25a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={`size-5 ${className}`}>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

/** Listbox select (keyboard type-ahead, arrow keys, aria-expanded/activedescendant handled by Headless UI). */
export function SelectMenu<T extends string | number>({
  label,
  value,
  onChange,
  options,
  className = '',
  placeholder,
  srOnlyLabel,
}: {
  label: string;
  value: T | null;
  onChange: (v: T) => void;
  options: Option<T>[];
  className?: string;
  placeholder?: string;
  srOnlyLabel?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Field className={className}>
      <Label className={srOnlyLabel ? 'sr-only' : 'mb-1 block text-sm font-medium text-white'}>{label}</Label>
      <Listbox value={value ?? undefined} onChange={onChange}>
        <ListboxButton className="grid w-full cursor-default grid-cols-1 rounded-lg bg-white/5 py-1.5 pr-2 pl-3 text-left text-sm/6 text-white focus:outline-2 focus:-outline-offset-2 focus:outline-white/25">
          <span className="col-start-1 row-start-1 truncate pr-6">
            {current?.label ?? <span className="text-white/60">{placeholder ?? 'Select…'}</span>}
          </span>
          <span className="col-start-1 row-start-1 self-center justify-self-end">
            <ChevronIcon />
          </span>
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          transition
          className="z-50 max-h-60 w-(--button-width) overflow-auto rounded-xl border border-white/5 bg-neutral-900/95 p-1 text-sm shadow-2xl backdrop-blur-xl [--anchor-gap:4px] focus:outline-none transition duration-100 ease-in data-leave:data-closed:opacity-0"
        >
          {options.map((o) => (
            <ListboxOption
              key={String(o.value)}
              value={o.value}
              className="group relative flex cursor-default items-center rounded-lg py-1.5 pr-9 pl-3 text-white select-none data-focus:bg-white/10"
            >
              <span className="block truncate font-normal group-data-selected:font-semibold">{o.label}</span>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-white group-not-data-selected:hidden">
                <CheckIcon className="size-4" />
              </span>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </Field>
  );
}

/** Segmented control built on RadioGroup (arrow keys move between options). */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      value={value}
      onChange={onChange}
      aria-label={label}
      disabled={disabled}
      className="inline-flex shrink-0 gap-0.5 rounded-full bg-white/5 p-0.5"
    >
      {options.map((o) => (
        <Radio
          key={o.value}
          value={o.value}
          className="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold text-white/70 focus:outline-none data-checked:bg-white/15 data-checked:text-white data-hover:bg-white/5 data-focus:outline-1 data-focus:outline-white data-disabled:opacity-50"
        >
          {o.label}
        </Radio>
      ))}
    </RadioGroup>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  min,
  max,
  hint,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <Field>
      <Label className="mb-1 block text-sm font-medium text-white">{label}</Label>
      <Input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
      {hint && <Description className="mt-1 text-xs text-white/60">{hint}</Description>}
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 2,
  srOnlyLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  srOnlyLabel?: boolean;
}) {
  return (
    <Field>
      <Label className={srOnlyLabel ? 'sr-only' : 'mb-1 block text-sm font-medium text-white'}>{label}</Label>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </Field>
  );
}

/** Checkbox chip (Headless UI Checkbox with an accessible label). */
export function CheckChip({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <Field
      className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ring-1 ring-inset ${checked ? 'bg-white/10 text-white ring-white/30' : 'bg-white/5 text-white/80 ring-white/10'}`}
    >
      <Checkbox
        checked={checked}
        onChange={onChange}
        className="group flex size-4 items-center justify-center rounded bg-white/10 p-0.5 ring-1 ring-inset ring-white/15 data-checked:bg-white data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-white"
      >
        <CheckIcon className="hidden size-3.5 text-black group-data-checked:block" />
      </Checkbox>
      <Label className="cursor-pointer">{label}</Label>
    </Field>
  );
}

/** Confirmation modal (focus trap, Escape, aria-modal via Headless UI Dialog). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  danger,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/60 transition-opacity data-closed:opacity-0 data-enter:duration-200 data-leave:duration-150"
      />
      <div className="fixed inset-0 z-10 flex min-h-full items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-md rounded-xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur-2xl transition-all duration-300 ease-out data-closed:scale-95 data-closed:opacity-0"
        >
          <DialogTitle className="text-base font-semibold text-white">{title}</DialogTitle>
          <div className="mt-2 text-sm text-white/70">{children}</div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white/5 px-3 py-1.5 text-sm/6 font-semibold text-white ring-1 ring-inset ring-white/10 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`rounded-md px-3 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 ${danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

/**
 * Type-ahead skill picker (Headless UI Combobox): choose a known skill, or add exactly what you typed as a new skill.
 */
export function SkillCombobox({
  label,
  options,
  onPick,
  onCreate,
}: {
  label: string;
  options: { id: string; name: string }[];
  onPick: (id: string) => void;
  onCreate: (name: string) => void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 8) : options.slice(0, 8);
  const exact = options.some((o) => o.name.toLowerCase() === q);
  const NEW = '__new__';
  return (
    <Field>
      <Label className="mb-1 block text-sm font-medium text-white">{label}</Label>
      <Combobox
        value={null}
        onChange={(v: string | null) => {
          if (!v) return;
          if (v === NEW) void onCreate(query.trim());
          else onPick(v);
          setQuery('');
        }}
        onClose={() => setQuery('')}
      >
        <ComboboxInput
          placeholder="Type a skill, e.g. KiCad, Figma, React…"
          displayValue={() => query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputCls}
        />
        <ComboboxOptions
          anchor="bottom start"
          transition
          className="z-50 max-h-64 w-(--input-width) overflow-auto rounded-xl border border-white/5 bg-neutral-900/95 p-1 text-sm shadow-2xl backdrop-blur-xl [--anchor-gap:4px] empty:invisible transition duration-100 ease-in data-leave:data-closed:opacity-0"
        >
          {filtered.map((o) => (
            <ComboboxOption
              key={o.id}
              value={o.id}
              className="cursor-default rounded-lg px-3 py-1.5 text-white select-none data-focus:bg-white/10"
            >
              {o.name}
            </ComboboxOption>
          ))}
          {q.length >= 2 && !exact && (
            <ComboboxOption
              value={NEW}
              className="cursor-default rounded-lg px-3 py-1.5 text-indigo-300 select-none data-focus:bg-white/10"
            >
              + Add “{query.trim()}” as a new skill
            </ComboboxOption>
          )}
        </ComboboxOptions>
      </Combobox>
      <Description className="mt-1 text-xs text-white/60">
        Not in the list? Type it and add it. New skills get search-based learning links.
      </Description>
    </Field>
  );
}
