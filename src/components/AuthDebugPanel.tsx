import { useEffect, useState } from "react";
import { clearAuthDebug, readAuthDebug, snapshotAuthDebug, type AuthDebugEntry } from "@/lib/auth-debug";

export function AuthDebugPanel({ title = "Auth debug" }: { title?: string }) {
  const [entries, setEntries] = useState<AuthDebugEntry[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const refresh = () => setEntries(readAuthDebug());
    window.addEventListener("knox-auth-debug", refresh);
    window.addEventListener("storage", refresh);
    refresh();
    void snapshotAuthDebug("debug panel mounted");
    return () => {
      window.removeEventListener("knox-auth-debug", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const latest = entries[0];
  return (
    <div className="fixed inset-x-2 bottom-2 z-50 rounded-xl border bg-card/95 p-3 text-card-foreground shadow-pop backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <button className="text-left text-xs font-bold" onClick={() => setOpen((v) => !v)}>
          {title}: {latest?.label ?? "no events"}
        </button>
        <button className="rounded-full border px-2 py-1 text-[10px] font-semibold" onClick={clearAuthDebug}>
          Clear
        </button>
      </div>
      {open && (
        <div className="mt-2 max-h-52 overflow-auto rounded-lg bg-muted p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          {entries.length === 0 ? (
            <div>No auth debug events yet.</div>
          ) : (
            entries.slice(0, 10).map((entry, i) => (
              <div key={`${entry.at}-${i}`} className="border-b border-border py-1 last:border-0">
                <div className="font-semibold text-foreground">{entry.label}</div>
                <div>{new Date(entry.at).toLocaleTimeString()}</div>
                <pre className="whitespace-pre-wrap break-words">{JSON.stringify(entry.details ?? {}, null, 2)}</pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}