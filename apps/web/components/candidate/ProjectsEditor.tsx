"use client";

import type { ParsedProjectEntry } from "@wlr/shared-types";
import { DangerButton, SecondaryButton, TextAreaField, TextInput } from "../FormField";

const emptyEntry: ParsedProjectEntry = {
  name: "",
  description: [],
  techStack: [],
};

export function ProjectsEditor({
  value,
  onChange,
}: {
  value: ParsedProjectEntry[];
  onChange: (v: ParsedProjectEntry[]) => void;
}) {
  function update(i: number, patch: Partial<ParsedProjectEntry>) {
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
            <div className="flex-1 space-y-3">
              <TextInput
                label="Project name"
                value={entry.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <TextInput
                label="Tech stack (comma-separated)"
                value={entry.techStack.join(", ")}
                onChange={(e) =>
                  update(i, {
                    techStack: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                  })
                }
              />
              <TextAreaField
                label="Description (one bullet per line)"
                rows={3}
                value={entry.description.join("\n")}
                onChange={(e) => update(i, { description: e.target.value.split("\n") })}
              />
            </div>
            <DangerButton type="button" onClick={() => remove(i)}>
              Remove
            </DangerButton>
          </div>
        </div>
      ))}
      <SecondaryButton type="button" onClick={add}>
        + Add project
      </SecondaryButton>
    </div>
  );
}
