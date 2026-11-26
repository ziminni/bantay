import { ArrowLeft, Flag, FlaskConical } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getFlag, listFlags, subscribeFlags } from '@/api/flags'
import type { FlagRead, FlagStatus, FlagType } from '@/api/types'
import { FLAG_TYPE_ORDER, FLAG_TYPES, FlagStatusBadge, FlagTypeBadge } from '@/components/common/flags'
import { LabSelect } from '@/components/common/selects'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/LoadingState'
import { Section } from '@/components/ui/Section'
import { useAsync } from '@/hooks/useAsync'
import { useFlagCounts } from '@/hooks/useFlagCounts'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { FlagDecision } from './components/FlagDecision'
import { FlagQueue } from './components/FlagQueue'
import { FlagScene } from './components/FlagScene'
import { RuleEvidence } from './components/RuleEvidence'

type StatusFilter = FlagStatus | 'ALL'
const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'DISMISSED', label: 'Dismissed' },
  { value: 'ALL', label: 'All' },
]

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

/**
 * Review flags (slide 34): the queue on the left, and for the open flag the
 * snapshot or clip, the rule's measured values, who was inside, and the
 * decision. Filters live in the address so a view can be shared.
 */
export function FlagsPage() {
  const { id } = useParams()
  const selectedId = id ? Number(id) : undefined
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const status = (params.get('status') as StatusFilter | null) ?? 'PENDING'
  const type = (params.get('type') as FlagType | null) ?? undefined
  const labId = params.get('lab_id') ? Number(params.get('lab_id')) : undefined
  const search = params.toString() ? `?${params.toString()}` : ''

  // Reload whenever a flag is reviewed anywhere (bell, another tab of this page).
  const [version, setVersion] = useState(0)
  useEffect(() => subscribeFlags(() => setVersion((v) => v + 1)), [])

  const list = useAsync(
    () => listFlags({ status: status === 'ALL' ? undefined : status, type, lab_id: labId }),
    [status, type, labId, version],
    { refreshInterval: 15_000 },
  )
  const detail = useAsync(() => (selectedId ? getFlag(selectedId) : Promise.resolve(undefined)), [selectedId, version])
  const counts = useFlagCounts()
  const items = list.data ?? []

  // On a wide screen, open the first flag so the page is never half empty.
  useEffect(() => {
    if (!selectedId && items.length > 0 && isDesktop()) navigate(`/flags/${items[0].id}${search}`, { replace: true })
  }, [selectedId, items, navigate, search])

  const go = (flag: FlagRead | undefined) => flag && navigate(`/flags/${flag.id}${search}`)

  // J / K move through the queue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || target.closest('input, textarea, select, [contenteditable]')) return
      if (e.key !== 'j' && e.key !== 'k') return
      const idx = items.findIndex((f) => f.id === selectedId)
      go(items[e.key === 'j' ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1)])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /** After a decision, move on to the next flag still waiting. */
  const onReviewed = (updated: FlagRead) => {
    if (status === 'ALL' || updated.status === status) return
    const idx = items.findIndex((f) => f.id === updated.id)
    const rest = items.filter((f) => f.id !== updated.id)
    const next = rest[Math.min(idx, rest.length - 1)]
    navigate(next ? `/flags/${next.id}${search}` : `/flags${search}`, { replace: true })
  }

  const setFilter = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // Changing the filter closes the open flag; the first match opens instead.
    navigate({ pathname: '/flags', search: next.toString() ? `?${next.toString()}` : '' }, { replace: true })
  }

  const flag = detail.data

  return (
    <>
      <PageHeader
        title="Flags"
        description="Behaviour alerts wait here for a person to decide. Nothing counts against anyone until it is confirmed."
        actions={
          <div className="w-full sm:w-56">
            <label htmlFor="flags-lab" className="sr-only">
              Laboratory
            </label>
            <LabSelect id="flags-lab" value={labId ? String(labId) : ''} onChange={(e) => setFilter('lab_id', e.target.value || undefined)} />
          </div>
        }
      />

      <p className="-mt-5 mb-6 flex items-center gap-2 text-xs text-marigold-800">
        <FlaskConical className="size-3.5" aria-hidden />
        Sample flags in your real labs: the behaviour worker is not running yet. Persons inside come from the real entry log.
      </p>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Queue */}
        <aside className={cn('min-w-0 space-y-4', Boolean(selectedId) && 'hidden lg:block')}>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Status">
            {STATUS_TABS.map((t) => {
              const n = t.value === 'ALL' ? undefined : counts?.[t.value]
              const active = status === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter('status', t.value === 'PENDING' ? undefined : t.value)}
                  className={cn(
                    'flex flex-col items-center rounded-lg px-1 py-1.5 text-xs font-medium transition-colors',
                    active ? 'bg-white text-navy-900 shadow-card' : 'text-gray-500 hover:text-navy-900',
                  )}
                >
                  {t.label}
                  {n !== undefined && (
                    <span className={cn('text-sm font-semibold tabular-nums', t.value === 'PENDING' && n > 0 && 'text-marigold-600')}>{n}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-1.5" aria-label="Flag type">
            <TypeChip active={!type} onClick={() => setFilter('type', undefined)}>
              All types
            </TypeChip>
            {FLAG_TYPE_ORDER.map((t) => {
              const Icon = FLAG_TYPES[t].icon
              return (
                <TypeChip key={t} active={type === t} onClick={() => setFilter('type', type === t ? undefined : t)}>
                  <Icon className="size-3.5" aria-hidden />
                  {FLAG_TYPES[t].short}
                </TypeChip>
              )
            })}
          </div>

          {list.loading && !list.data ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[88px] rounded-xl" />
              ))}
            </div>
          ) : list.error && !list.data ? (
            <Section>
              <ErrorState error={list.error} onRetry={list.reload} />
            </Section>
          ) : items.length === 0 ? (
            <Section>
              <EmptyState
                icon={<Flag />}
                title={status === 'PENDING' ? 'All caught up' : 'No flags here'}
                description={status === 'PENDING' ? 'Every flag has been reviewed.' : 'Try another status, type or lab.'}
              />
            </Section>
          ) : (
            <FlagQueue flags={items} selectedId={selectedId} search={search} />
          )}
        </aside>

        {/* Detail */}
        <section className={cn('min-w-0', !selectedId && 'hidden lg:block')} aria-label="Selected flag">
          {selectedId && (
            <Link
              to={`/flags${search}`}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-navy-900 lg:hidden"
            >
              <ArrowLeft className="size-4" />
              All flags
            </Link>
          )}

          {!selectedId ? (
            <Section>
              <EmptyState icon={<Flag />} title="Pick a flag" description="Choose a flag on the left to see its evidence." />
            </Section>
          ) : detail.loading && !flag ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="aspect-video w-full rounded-2xl" />
            </div>
          ) : detail.error && !flag ? (
            <Section>
              <ErrorState error={detail.error} onRetry={detail.reload} />
            </Section>
          ) : flag ? (
            <div className="animate-fade-in space-y-5">
              <header className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <FlagTypeBadge type={flag.type} />
                    <FlagStatusBadge status={flag.status} />
                    <span className="font-mono text-xs text-gray-500">#{flag.id}</span>
                  </div>
                  <h2 className="truncate font-display text-2xl font-semibold tracking-tight text-navy-900">
                    {FLAG_TYPES[flag.type].label} — {flag.lab_name}, {flag.camera_name}
                  </h2>
                </div>
                <p className="text-sm text-gray-500 tabular-nums">{formatDateTime(flag.occurred_at)}</p>
              </header>

              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="min-w-0 space-y-5">
                  <FlagScene key={flag.id} flag={flag} />
                  <RuleEvidence flag={flag} />
                </div>
                <div className="min-w-0 space-y-5">
                  <FlagDecision key={`${flag.id}-${flag.status}`} flag={flag} onReviewed={onReviewed} />
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </>
  )
}

function TypeChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
        active ? 'border-navy-900 bg-navy-900 text-cream' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-navy-900',
      )}
    >
      {children}
    </button>
  )
}
