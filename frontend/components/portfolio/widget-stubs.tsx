import { Activity, Music } from "lucide-react";

import { GitHubIcon } from "@/components/icons";

// TODO Build 4: wire these to live data (GitHub contributions API,
// Spotify now-playing via the backend, Strava recent activity).
const widgets = [
  { icon: GitHubIcon, label: "GitHub activity" },
  { icon: Music, label: "Now playing" },
  { icon: Activity, label: "Latest run" },
];

export function WidgetStubs() {
  return (
    <section id="live" className="scroll-mt-20">
      <h2 className="section-label">03 / live</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {widgets.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex h-28 flex-col items-start justify-between rounded-xl border border-dashed p-4"
          >
            <Icon className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="font-mono text-[11px] text-muted-foreground/60">
                {"// coming in build 4"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
