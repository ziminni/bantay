import { Gauge } from 'lucide-react'
import type { FlagRead } from '@/api/types'
import { FLAG_TYPES } from '@/components/common/flags'
import { Section } from '@/components/ui/Section'
import { cn } from '@/lib/cn'
import { formatEvidenceValue } from './FlagQueue'

/**
 * "No black box": the measured value next to the threshold, so the reviewer
 * sees how far past the line the rule was (slide 25, rule set r1).
 */
export function RuleEvidence({ flag }: { flag: FlagRead }) {
  const e = flag.evidence
  const isBinary = e.unit === 'object'
  const max = e.direction === 'below' ? 1 : Math.max(e.value, e.threshold) * 1.25
  const valuePct = Math.min(100, (e.value / max) * 100)
  const thresholdPct = Math.min(100, (e.threshold / max) * 100)
  const margin = e.direction === 'above' ? e.value / e.threshold : e.threshold / Math.max(e.value, 0.01)

  return (
    <Section title="Rule evidence" description={`Rule ${e.rule_set} · ${FLAG_TYPES[flag.type].rule}`} icon={<Gauge />}>
      {!isBinary && (
        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-sm text-gray-500">{e.metric}</p>
            <p className="font-display text-2xl font-semibold text-navy-900 tabular-nums">{formatEvidenceValue(e.value, e.unit)}</p>
          </div>
          <div className="relative h-2.5 rounded-full bg-gray-100">
            <div
              className={cn('absolute inset-y-0 left-0 rounded-full', margin >= 1.3 ? 'bg-red-500' : 'bg-marigold-400')}
              style={{ width: `${valuePct}%` }}
            />
            <div
              className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded-full bg-navy-900"
              style={{ left: `${thresholdPct}%` }}
              title="Threshold"
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-gray-500">
            <span>{e.direction === 'below' ? 'Fires below the line' : 'Fires above the line'}</span>
            <span className="tabular-nums">Threshold {formatEvidenceValue(e.threshold, e.unit)}</span>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {isBinary && <Row label="Trigger" value={e.metric} />}
        {e.held_seconds != null && (
          <Row label="Held for" value={`${e.held_seconds} s${e.required_seconds != null ? ` (needs ${e.required_seconds} s)` : ''}`} />
        )}
        {e.track_id != null && <Row label="Track ID" value={`#${e.track_id}`} mono />}
        {e.zone && <Row label="Zone" value={e.zone} />}
        {e.object && <Row label="Object" value={e.object} />}
        <Row label="Rule set" value={e.rule_set} mono />
      </dl>
    </Section>
  )
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={cn('truncate font-medium text-navy-900', mono && 'font-mono text-[13px]')}>{value}</dd>
    </div>
  )
}
