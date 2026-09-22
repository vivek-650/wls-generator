"use client";

import type { ParsedCertificationEntry } from "@wlr/shared-types";
import { Plus } from "lucide-react";
import { DangerButton, SecondaryButton, TextInput } from "../FormField";

const emptyEntry: ParsedCertificationEntry = {
  name: "",
  issuer: "",
  date: "",
};

export function CertificationsEditor({
  value,
  onChange,
}: {
  value: ParsedCertificationEntry[];
  onChange: (v: ParsedCertificationEntry[]) => void;
}) {
  function update(i: number, patch: Partial<ParsedCertificationEntry>) {
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
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput
                label="Name"
                value={entry.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <TextInput
                label="Issuer"
                value={entry.issuer ?? ""}
                onChange={(e) => update(i, { issuer: e.target.value })}
              />
              <TextInput
                label="Date"
                placeholder="YYYY-MM"
                value={entry.date ?? ""}
                onChange={(e) => update(i, { date: e.target.value })}
              />
            </div>
            <DangerButton type="button" onClick={() => remove(i)}>
              Remove
            </DangerButton>
          </div>
        </div>
      ))}
      <SecondaryButton type="button" onClick={add}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Add certification
      </SecondaryButton>
    </div>
  );
}
