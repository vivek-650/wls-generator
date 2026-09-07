export function WarningBanner({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc pl-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      {message}
    </div>
  );
}

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
      {children}
    </div>
  );
}
