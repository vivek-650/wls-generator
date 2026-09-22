"use client";

import type { ParsedExperienceEntry } from "@wlr/shared-types";
import { Plus } from "lucide-react";
import { DangerButton, SecondaryButton, TextAreaField, TextInput } from "../FormField";

const emptyEntry: ParsedExperienceEntry = {
  company: "",
  title: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  description: [],
};

export function ExperienceEditor({
  value,
  onChange,
}: {
  value: ParsedExperienceEntry[];
  onChange: (v: ParsedExperienceEntry[]) => void;
}) {
  function update(i: number, patch: Partial<ParsedExperienceEntry>) {
    onChange(value.map((entry, idx) => (idx === i ? { ...entry, ...patch } : entry)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...value, { ...emptyEntry }]);
  }

  return (
    <div className="space-y-4">
      {value.map((entry, i) => (
        <div key={i} className="border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput
                label="Company"
                value={entry.company ?? ""}
                onChange={(e) => update(i, { company: e.target.value })}
              />
              <TextInput
                label="Title"
                value={entry.title ?? ""}
                onChange={(e) => update(i, { title: e.target.value })}
              />
              <TextInput
                label="Start date"
                placeholder="YYYY-MM"
                value={entry.startDate ?? ""}
                onChange={(e) => update(i, { startDate: e.target.value })}
              />
              <TextInput
                label="End date"
                placeholder="YYYY-MM"
                value={entry.isCurrent ? "" : entry.endDate ?? ""}
                disabled={entry.isCurrent}
                onChange={(e) => update(i, { endDate: e.target.value })}
              />
            </div>
            <DangerButton type="button" onClick={() => remove(i)}>
              Remove
            </DangerButton>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={entry.isCurrent}
              onChange={(e) =>
                update(i, { isCurrent: e.target.checked, endDate: e.target.checked ? null : entry.endDate })
              }
            />
            Currently working here
          </label>
          <div className="mt-3">
            <TextAreaField
              label="Description (one bullet per line)"
              rows={3}
              value={entry.description.join("\n")}
              onChange={(e) => update(i, { description: e.target.value.split("\n") })}
            />
          </div>
        </div>
      ))}
      <SecondaryButton type="button" onClick={add}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Add experience
      </SecondaryButton>
    </div>
  );
}
