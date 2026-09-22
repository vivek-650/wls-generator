"use client";

import type { ParsedSkill } from "@wlr/shared-types";
import { X } from "lucide-react";
import { FormEvent, useState } from "react";

export function SkillsEditor({
  value,
  onChange,
}: {
  value: ParsedSkill[];
  onChange: (v: ParsedSkill[]) => void;
}) {
  const [skillInput, setSkillInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");

  function addSkill(e?: FormEvent) {
    e?.preventDefault();
    const skill = skillInput.trim();
    if (!skill) return;
    if (value.some((s) => s.skill.toLowerCase() === skill.toLowerCase())) {
      setSkillInput("");
      setCategoryInput("");
      return;
    }
    onChange([...value, { skill, category: categoryInput.trim() || null }]);
    setSkillInput("");
    setCategoryInput("");
  }

  function removeSkill(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.length === 0 && <p className="text-sm text-slate-400">No skills added yet.</p>}
        {value.map((s, i) => (
          <span
            key={`${s.skill}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700"
          >
            {s.skill}
            {s.category && <span className="text-brand-400">· {s.category}</span>}
            <button
              type="button"
              onClick={() => removeSkill(i)}
              className="text-brand-400 hover:text-brand-700"
              aria-label={`Remove ${s.skill}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={addSkill} className="mt-3 flex flex-wrap gap-2">
        <input
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          placeholder="Skill (e.g. React)"
          className="rounded-sm border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <input
          value={categoryInput}
          onChange={(e) => setCategoryInput(e.target.value)}
          placeholder="Category (optional)"
          className="rounded-sm border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          className="rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Add skill
        </button>
      </form>
    </div>
  );
}
