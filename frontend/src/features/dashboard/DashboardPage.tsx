import { ArrowRight, BarChart3, DoorOpen, Flag, Monitor, ScanFace, ScrollText, ShieldAlert, UserRoundCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { getTodayStats } from '@/api/stats'
import { LabSelect } from '@/components/common/selects'
import { PageHeader } from '@/components/layout/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/LoadingState'
import { Section } from '@/components/ui/Section'
import { StatCard } from '@/components/ui/StatCard'
import { DASHBOARD_REFRESH_MS } from '@/config'
import { useAsync } from '@/hooks/useAsync'
import { useFlagCounts } from '@/hooks/useFlagCounts'
import { formatLongDate } from '@/lib/format'
import { EntriesPerHourChart } from './components/EntriesPerHourChart'
import { LabTotalsList } from './components/LabTotalsList'
import { LatestEntriesList } from './components/LatestEntriesList'
import { PendingFlagsList } from './components/PendingFlagsList'

const datePrefix = (date: string | undefined) => (date ? `${formatLongDate(date)} · ` : '')

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const labId = params.get('lab_id') ? Number(params.get('lab_id')) : undefined

  const stats = useAsync(() => getTodayStats({ lab_id: labId, latest: 10 }), [labId], {
    refreshInterval: DASHBOARD_REFRESH_MS,
  })
  const flagCounts = useFlagCounts(10_000)
  const pendingFlags = flagCounts?.PENDING ?? 0
  const s = stats.data

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${datePrefix(stats.data?.date)}Updates every ${DASHBOARD_REFRESH_MS / 1000} seconds`}
        actions={
          <div className="w-full sm:w-60">
            <label htmlFor="dashboard-lab" className="sr-only">
              Laboratory
            </label>
            <LabSelect
              id="dashboard-lab"
              value={labId ? String(labId) : ''}
              onChange={(e) => setParams(e.target.value ? { lab_id: e.target.value } : {}, { replace: true })}
            />
          </div>
        }
      />

      {stats.loading && !s ? (
        <DashboardSkeleton />
      ) : stats.error && !s ? (
        <Section>
          <ErrorState error={stats.error} onRetry={stats.reload} />
        </Section>
      ) : s ? (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
            <StatCard featured label="Entries today" value={s.entries_today.toLocaleString()} hint="Every walk-in, all labs" icon={<DoorOpen />} />
            <StatCard
              label="People today"
              value={s.distinct_persons_today.toLocaleString()}
              hint="Recognized, counted once"
              icon={<UserRoundCheck />}
            />
            <StatCard label="Unknown faces" value={s.unknown_today.toLocaleString()} hint="Not enrolled" icon={<ScanFace />} />
            <Link to={labId ? `/flags?lab_id=${labId}` : '/flags'} className="block transition-transform hover:-translate-y-0.5">
              <StatCard
                label="Pending flags"
                value={pendingFlags.toLocaleString()}
                hint={pendingFlags > 0 ? `${pendingFlags} waiting for review` : 'All flags reviewed'}
                alert={pendingFlags > 0}
                icon={pendingFlags > 0 ? <ShieldAlert className="text-marigold-500" /> : <Flag />}
              />
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section
              title="Entries per hour"
              description="When people walked in today"
              icon={<BarChart3 />}
              className="lg:col-span-2"
            >
              <EntriesPerHourChart data={s.entries_per_hour} />
            </Section>
            <Section title="Entries per lab" description="Today" icon={<Monitor />}>
              <LabTotalsList totals={labId ? s.per_lab.filter((t) => t.lab_id === labId) : s.per_lab} />
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section
              title="Latest entries"
              description="The ten most recent, newest first"
              icon={<ScrollText />}
              flush
              className="lg:col-span-2"
              actions={
                <ButtonLink to={labId ? `/logs?lab_id=${labId}` : '/logs'} size="sm" variant="ghost">
                  View all logs
                  <ArrowRight />
                </ButtonLink>
              }
            >
              <LatestEntriesList entries={s.latest_entries} />
            </Section>

            <Section
              title="Pending flags"
              description="Behaviour alerts waiting for review"
              icon={<Flag />}
              flush
              className="lg:col-span-1"
            >
              <PendingFlagsList labId={labId} />
            </Section>
          </div>
        </div>
      ) : null}
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading the dashboard" className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}
