import Link from "next/link";
import { adminPath, analyticsListPath, mediaListPath } from "@/lib/routes";
import { CmsBreadcrumb } from "@/components/cms/CmsBreadcrumb";
import { CmsFreshnessPanel, type CmsOperatorStatus } from "@/components/cms/CmsStates";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { getAnalyticsSnapshot } from "@/lib/cms/analytics";

const ANALYTICS_PATH = analyticsListPath;

export default async function AdminAnalyticsPage() {
  const context = await requireCmsAdmin(ANALYTICS_PATH);

  if (context.status === "forbidden") {
    return (
      <main className="min-h-screen bg-deep px-4 py-10 text-bone">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-bone/70">You are not authorized for CMS access.</p>
        </div>
      </main>
    );
  }

  const snapshot = await getAnalyticsSnapshot();

  // eslint-disable-next-line react-hooks/purity
  const lastRefreshedMs = Date.now();
  const operatorStatus: CmsOperatorStatus =
    snapshot.mediaGuardian.PROBLEMS === 0 ? "HEALTHY" : "DEGRADED";

  const breadcrumbs = [
    { label: "Admin", href: adminPath },
    { label: "Analytics", isCurrent: true },
  ];

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-6xl">
        <CmsBreadcrumb items={breadcrumbs} />

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="mt-2 text-2xl font-semibold">Analytics</h1>
            <p className="mt-1 max-w-xl text-sm text-bone/60">
              Current content + media health snapshot. No historical trends or user-level metrics.
            </p>
          </div>
          <CmsFreshnessPanel
            lastRefreshedMs={lastRefreshedMs}
            status={operatorStatus}
            reloadLabel="Refresh snapshot (read-only)"
          />
        </div>

        <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-bone/40">
          AUTHORITATIVE · SNAPSHOT ONLY · ZERO USER-LEVEL DATA
        </p>

        <section className="mt-6">
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
            Content
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            <MetricTile label="Series" value={snapshot.content.publishedSeries} />
            <MetricTile label="Episodes" value={snapshot.content.publishedEpisodes} />
            <MetricTile label="Short Films" value={snapshot.content.publishedShortFilms} />
            <MetricTile label="Home Rows" value={snapshot.content.homeRows} />
            <MetricTile label="Home Items" value={snapshot.content.homeRowItems} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
            Media Guardian
          </h2>
          <p className="mt-1 text-xs text-bone/50">
            Reconciled provider + CMS media truth.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <HealthTile label="Ready" value={snapshot.mediaGuardian.READY} variant="ready" />
            <HealthTile label="Processing" value={snapshot.mediaGuardian.PROCESSING} variant="processing" />
            <HealthTile label="Failed" value={snapshot.mediaGuardian.FAILED} variant="failed" />
            <HealthTile label="Missing" value={snapshot.mediaGuardian.MISSING} variant="missing" />
            <HealthTile label="Unassigned" value={snapshot.mediaGuardian.UNASSIGNED} variant="unassigned" />
            <HealthTile label="Problems" value={snapshot.mediaGuardian.PROBLEMS} variant="problems" />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
            Operations
          </h2>
          <div className="mt-3 divide-y divide-bone/10 border border-bone/10">
            <OpRow
              label="Assets requiring attention"
              value={snapshot.mediaGuardian.PROBLEMS}
              href={mediaListPath}
            />
            <OpRow
              label="Unassigned assets"
              value={snapshot.mediaGuardian.UNASSIGNED}
              href={mediaListPath}
            />
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-bone/10 bg-bone/[0.02] p-4">
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
            Playback Telemetry
          </h2>
          <p className="mt-1 text-xs text-bone/50">
            B-grade client telemetry. Derived from watch_progress. Snapshot only.
          </p>
          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-bone/40">
            DERIVED · TELEMETRY · {snapshot.playbackTelemetry.caveat}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MetricTile
              label="Series episode completion"
              value={snapshot.playbackTelemetry.completionRate.seriesEpisodes ?? null}
              format="percent"
            />
            <MetricTile
              label="Short film completion"
              value={snapshot.playbackTelemetry.completionRate.shortFilms ?? null}
              format="percent"
            />
            <MetricTile
              label="Series completion"
              value={snapshot.playbackTelemetry.seriesCompletionRate.overall ?? null}
              format="percent"
            />
          </div>

          {snapshot.playbackTelemetry.episodeDropoff.length > 0 && (
            <div className="mt-6">
              <h3 className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-bone/50">
                Episode drop-off
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-bone/10 text-bone/50">
                      <th className="py-1.5 pr-4 font-mono text-[0.6rem] uppercase tracking-wider">Series</th>
                      <th className="py-1.5 pr-4 font-mono text-[0.6rem] uppercase tracking-wider">Episode</th>
                      <th className="py-1.5 pr-4 font-mono text-[0.6rem] uppercase tracking-wider text-right">Reached N</th>
                      <th className="py-1.5 pr-4 font-mono text-[0.6rem] uppercase tracking-wider text-right">Reached N+1</th>
                      <th className="py-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-right">Drop-off</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.playbackTelemetry.episodeDropoff.map((point) => (
                      <tr key={`${point.seriesSlug}-${point.episodeNumber}`} className="border-b border-bone/5 last:border-0">
                        <td className="py-1.5 pr-4 text-bone/80">{point.seriesSlug}</td>
                        <td className="py-1.5 pr-4 text-bone/80">
                          {point.episodeNumber}
                          {point.recordsReachingNext !== null && (
                            <span className="ml-1 text-bone/40">→ {point.episodeNumber + 1}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-4 text-right text-bone/80">{point.recordsReaching.toLocaleString()}</td>
                        <td className="py-1.5 pr-4 text-right text-bone/80">
                          {point.recordsReachingNext !== null ? point.recordsReachingNext.toLocaleString() : "—"}
                        </td>
                        <td className="py-1.5 text-right text-bone/80">
                          {point.dropoffRate !== null ? `${(point.dropoffRate * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <p className="mt-10 text-xs text-bone/40">
          C09B-01 Snapshot-only analytics + C09B-02 Playback Telemetry. No historical data, no user-level metrics, no PII.
        </p>
      </div>
    </main>
  );
}

function MetricTile({
  label,
  value,
  format,
}: {
  label: string;
  value: number | null;
  format?: "number" | "percent";
}) {
  const displayValue =
    value === null
      ? "Not enough data"
      : format === "percent"
        ? `${(value * 100).toFixed(1)}%`
        : value.toLocaleString();

  return (
    <div className="border border-bone/10 bg-bone/[0.03] px-3 py-2 text-center">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-bone/50">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-bone">{displayValue}</p>
    </div>
  );
}

type HealthVariant = "ready" | "processing" | "failed" | "missing" | "unassigned" | "problems";

const HEALTH_COLORS: Record<HealthVariant, string> = {
  ready: "text-teal",
  processing: "text-bone",
  failed: "text-rose-100",
  missing: "text-rose-100",
  unassigned: "text-bone",
  problems: "text-rose-100",
};

function HealthTile({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: HealthVariant;
}) {
  return (
    <div className="border border-bone/10 bg-bone/[0.03] px-3 py-2 text-center">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-bone/50">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${HEALTH_COLORS[variant]}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function OpRow({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between py-2.5 transition-colors hover:text-bone"
    >
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/50">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xl font-semibold text-bone">{value.toLocaleString()}</span>
        <span className="text-xs font-medium text-teal">Open Media Guardian →</span>
      </div>
    </Link>
  );
}


