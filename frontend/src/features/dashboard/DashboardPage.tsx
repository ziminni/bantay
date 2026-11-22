import { useSearchParams } from 'react-router-dom'
import { getTodayStats } from '@/api/stats'
import { LabSelect } from '@/components/common/selects'
import { PageHeader } from '@/components/layout/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Section } from '@/components/ui/Section'
import { StatCard } from '@/components/ui/StatCard'
import { DASHBOARD_REFRESH_MS } from '@/config'
import { useAsync } from '@/hooks/useAsync'
import { formatLongDate } from '@/lib/format'
import { EntriesPerHourChart } from './components/EntriesPerHourChart'
import { LabTotalsList } from './components/LabTotalsList'
import { LatestEntriesList } from './components/LatestEntriesList'

const datePrefix = (date: string | undefined) => (date ? `${formatLongDate(date)} · ` : '')

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const labId = params.get('lab_id') ? Number(params.get('lab_id')) : undefined

  const stats = useAsync(() => getTodayStats({ lab_id: labId, latest: 10 }), [labId], {
    refreshInterval: DASHBOARD_REFRESH_MS,
  })
  const s = stats.data

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${datePrefix(stats.data?.date)}Updates every ${DASHBOARD_REFRESH_MS / 1000} seconds`}
        actions={
          <div className="w-full sm:w-56">
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
        <LoadingState />
      ) : stats.error && !s ? (
        <ErrorState error={stats.error} onRetry={stats.reload} />
      ) : s ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Entries today" value={s.entries_today.toLocaleString()} />
            <StatCard label="People today" value={s.distinct_persons_today.toLocaleString()} hint="Recognized, counted once" />
            <StatCard label="Unknown faces" value={s.unknown_today.toLocaleString()} hint="Not enrolled" />
            <StatCard
              label="Cameras online"
              value={`${s.cameras_online} / ${s.cameras_total}`}
              hint={s.cameras_online < s.cameras_total ? 'Some cameras need attention' : 'All cameras working'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Entries per hour" className="lg:col-span-2">
              <EntriesPerHourChart data={s.entries_per_hour} />
            </Section>
            <Section title="Entries per lab" description="Today">
              <LabTotalsList totals={labId ? s.per_lab.filter((t) => t.lab_id === labId) : s.per_lab} />
            </Section>
          </div>

          <Section
            title="Latest entries"
            flush
            actions={
              <ButtonLink to={labId ? `/logs?lab_id=${labId}` : '/logs'} size="sm">
                View all logs
              </ButtonLink>
            }
          >
            <LatestEntriesList entries={s.latest_entries} />
          </Section>
        </div>
      ) : null}
    </>
  )
}
