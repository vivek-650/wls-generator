import { Loader2 } from "lucide-react";

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <Loader2 className={`animate-spin text-current ${className}`} aria-hidden="true" />;
}

export function FullPageSpinner() {
  return (
    <div className="flex h-screen w-full items-center justify-center text-brand-600">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
