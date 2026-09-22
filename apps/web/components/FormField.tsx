import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Button } from "./ui/button";

interface FieldWrapperProps {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export function FieldWrapper({ label, htmlFor, children }: FieldWrapperProps) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function TextInput({
  label,
  id,
  className = "",
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldWrapper label={label} htmlFor={id}>
      <input id={id} className={`${inputClass} ${className}`} {...props} />
    </FieldWrapper>
  );
}

export function TextAreaField({
  label,
  id,
  className = "",
  ...props
}: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldWrapper label={label} htmlFor={id}>
      <textarea id={id} className={`${inputClass} ${className}`} {...props} />
    </FieldWrapper>
  );
}

// Thin wrappers around shadcn's `Button` (components/ui/button.tsx) that
// preserve this app's existing three-variant API — every call site across
// the app keeps working unchanged.

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button variant="default" className={`gap-2 ${className}`} {...props}>
      {children}
    </Button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button variant="outline" className={`gap-2 ${className}`} {...props}>
      {children}
    </Button>
  );
}

export function DangerButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button variant="destructive" size="sm" className={`gap-2 ${className}`} {...props}>
      {children}
    </Button>
  );
}
