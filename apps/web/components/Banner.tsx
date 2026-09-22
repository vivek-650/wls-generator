import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export function WarningBanner({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex gap-2 rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
      <div>
        <p className="font-medium">{title}</p>
        <ul className="mt-1 list-disc pl-4">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-sm border border-green-200 bg-green-50 p-2.5 text-sm text-green-800">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
