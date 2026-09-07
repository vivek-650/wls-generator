"use client";

import type { ParsedEducationEntry } from "@wlr/shared-types";
import { DangerButton, SecondaryButton, TextInput } from "../FormField";

const emptyEntry: ParsedEducationEntry = {
  institution: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
};

export function EducationEditor({
  value,
  onChange,
}: {
  value: ParsedEducationEntry[];
  onChange: (v: ParsedEducationEntry[]) => void;
}) {
  function update(i: number, patch: Partial<ParsedEducationEntry>) {
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
        <div key={i} className="rounded-md border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="grid flex-1 grid-cols-2 gap-3">
              <TextInput
                label="Institution"
                value={entry.institution ?? ""}
                onChange={(e) => update(i, { institution: e.target.value })}
              />
              <TextInput
                label="Degree"
                value={entry.degree ?? ""}
                onChange={(e) => update(i, { degree: e.target.value })}
              />
              <TextInput
                label="Field of study"
                value={entry.field ?? ""}
                onChange={(e) => update(i, { field: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  label="Start date"
                  placeholder="YYYY-MM"
                  value={entry.startDate ?? ""}
                  onChange={(e) => update(i, { startDate: e.target.value })}
                />
                <TextInput
                  label="End date"
                  placeholder="YYYY-MM"
                  value={entry.endDate ?? ""}
                  onChange={(e) => update(i, { endDate: e.target.value })}
                />
              </div>
            </div>
            <DangerButton type="button" onClick={() => remove(i)}>
              Remove
            </DangerButton>
          </div>
        </div>
      ))}
      <SecondaryButton type="button" onClick={add}>
        + Add education
      </SecondaryButton>
    </div>
  );
}
