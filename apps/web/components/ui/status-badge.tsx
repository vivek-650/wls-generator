import { Badge } from "./badge";

const TONE_CLASSES = {
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
} as const;

export type BadgeTone = keyof typeof TONE_CLASSES;

/**
 * Thin wrapper around shadcn's `Badge` that keeps this app's existing
 * `tone` API (neutral/brand/success/warning/danger) — shadcn's own variant
 * set doesn't include colored status tones, so those come through as an
 * extra className shadcn-merge resolves on top of the base variant.
 */
export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: BadgeTone }) {
  return (
    <Badge variant="outline" className={`border-transparent ${TONE_CLASSES[tone]}`}>
      {children}
    </Badge>
  );
}
