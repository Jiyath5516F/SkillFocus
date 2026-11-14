// Styled Headless UI primitives (Tailwind / headlessui.com look) used across Mira.
import {
  Checkbox, Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle, Field, Input, Label,
  Listbox, ListboxButton, ListboxOption, ListboxOptions, Radio, RadioGroup, Textarea,
} from '@headlessui/react';
import type { ReactNode } from 'react';

const inputCls = 'block w-full rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600';

function ChevronIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="size-4 text-gray-500"><path fillRule="evenodd" d="M5.22 10.22a.75.75 0 0 1 1.06 0L8 11.94l1.72-1.72a.75.75 0 1 1 1.06 1.06l-2.25 2.25a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 0 1 0-1.06ZM10.78 5.78a.75.75 0 0 1-1.06 0L8 4.06 6.28 5.78a.75.75 0 0 1-1.06-1.06l2.25-2.25a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" /></svg>;
}
function CheckIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={`size-5 ${className}`}><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" /></svg>;
}

export interface Option<T extends string | number> { value: T; label: string }

/** Listbox select (keyboard type-ahead, arrow keys, aria-expanded/activedescendant handled by Headless UI). */
export function SelectMenu<T extends string | number>({ label, value, onChange, options, className = '', placeholder, srOnlyLabel }: {
  label: string; value: T | null; onChange: (v: T) => void; options: Option<T>[]; className?: string; placeholder?: string; srOnlyLabel?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Field className={className}>
      <Label className={srOnlyLabel ? 'sr-only' : 'mb-1 block text-sm font-medium text-gray-900'}>{label}</Label>
      <Listbox value={value ?? undefined} onChange={onChange}>
        <ListboxButton className="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pr-2 pl-3 text-left text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600">
          <span className="col-start-1 row-start-1 truncate pr-6">{current?.label ?? <span className="text-gray-500">{placeholder ?? "Select…"}</span>}</span>
          <span className="col-start-1 row-start-1 self-center justify-self-end"><ChevronIcon /></span>
        </ListboxButton>
        <ListboxOptions anchor="bottom start" transition
          className="z-50 max-h-60 w-(--button-width) overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 [--anchor-gap:4px] focus:outline-none data-leave:transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0">
          {options.map((o) => (
            <ListboxOption key={String(o.value)} value={o.value} className="group relative cursor-default py-2 pr-9 pl-3 text-gray-900 select-none data-focus:bg-indigo-600 data-focus:text-white data-focus:outline-none">
              <span className="block truncate font-normal group-data-selected:font-semibold">{o.label}</span>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 group-not-data-selected:hidden group-data-focus:text-white"><CheckIcon /></span>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </Field>
  );
}

/** Segmented control built on RadioGroup (arrow keys move between options). */
export function Segmented<T extends string>({ label, value, onChange, options, disabled }: { label: string; value: T; onChange: (v: T) => void; options: Option<T>[]; disabled?: boolean }) {
  return (
    <RadioGroup value={value} onChange={onChange} aria-label={label} disabled={disabled} className="inline-flex shrink-0 rounded-md bg-white p-0.5 shadow-xs ring-1 ring-inset ring-gray-300">
      {options.map((o) => (
        <Radio key={o.value} value={o.value}
          className="cursor-pointer rounded px-2.5 py-1 text-xs font-semibold text-gray-600 focus:outline-none data-checked:bg-indigo-600 data-checked:text-white data-focus:ring-2 data-focus:ring-indigo-600 data-disabled:opacity-50">
          {o.label}
        </Radio>
      ))}
    </RadioGroup>
  );
}

export function TextField({ label, value, onChange, type = 'text', min, max, hint }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; min?: number; max?: number; hint?: string }) {
  return (
    <Field>
      <Label className="mb-1 block text-sm font-medium text-gray-900">{label}</Label>
      <Input type={type} min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      {hint && <Description className="mt-1 text-xs text-gray-500">{hint}</Description>}
    </Field>
  );
}

export function TextAreaField({ label, value, onChange, rows = 2, srOnlyLabel }: { label: string; value: string; onChange: (v: string) => void; rows?: number; srOnlyLabel?: boolean }) {
  return (
    <Field>
      <Label className={srOnlyLabel ? 'sr-only' : 'mb-1 block text-sm font-medium text-gray-900'}>{label}</Label>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </Field>
  );
}

/** Checkbox chip (Headless UI Checkbox with an accessible label). */
export function CheckChip({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Field className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ring-1 ring-inset ${checked ? 'bg-indigo-50 text-indigo-700 ring-indigo-600' : 'bg-white text-gray-700 ring-gray-300'}`}>
      <Checkbox checked={checked} onChange={onChange} className="group flex size-4 items-center justify-center rounded border border-gray-300 bg-white data-checked:border-indigo-600 data-checked:bg-indigo-600 data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-indigo-600">
        <CheckIcon className="hidden size-3.5 text-white group-data-checked:block" />
      </Checkbox>
      <Label className="cursor-pointer">{label}</Label>
    </Field>
  );
}

/** Confirmation modal (focus trap, Escape, aria-modal via Headless UI Dialog). */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onClose, danger }: { open: boolean; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; danger?: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-200 data-leave:duration-150" />
      <div className="fixed inset-0 z-10 flex min-h-full items-center justify-center p-4">
        <DialogPanel transition className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl transition-all data-closed:scale-95 data-closed:opacity-0 data-enter:duration-200 data-leave:duration-150">
          <DialogTitle className="text-base font-semibold text-gray-900">{title}</DialogTitle>
          <div className="mt-2 text-sm text-gray-600">{children}</div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={() => { onConfirm(); onClose(); }} className={`rounded-md px-3 py-2 text-sm font-semibold text-white shadow-xs ${danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>{confirmLabel}</button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
