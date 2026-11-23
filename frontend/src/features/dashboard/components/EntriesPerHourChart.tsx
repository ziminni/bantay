import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HourBucket } from '@/api/types'
import { useNow } from '@/hooks/useNow'
import { formatHour, manilaHour } from '@/lib/format'

const NAVY = '#0e2a47'
const NAVY_SOFT = '#b9c6d3'
const MARIGOLD = '#f2a93b'

/**
 * Entries per hour of today. Shows 6 AM to 9 PM, widened if there were entries
 * outside those hours, so the chart is not mostly empty night-time bars.
 * The current hour is marigold; hours still to come are pale.
 */
export function EntriesPerHourChart({ data }: { data: HourBucket[] }) {
  const withEntries = data.filter((b) => b.count > 0).map((b) => b.hour)
  const from = Math.min(6, ...withEntries)
  const to = Math.max(21, ...withEntries)
  const rows = data.filter((b) => b.hour >= from && b.hour <= to).map((b) => ({ ...b, label: formatHour(b.hour) }))
  const total = data.reduce((sum, b) => sum + b.count, 0)
  const now = useNow()
  const nowHour = manilaHour(now.toISOString())
  const peak = data.reduce((best, b) => (b.count > best.count ? b : best), { hour: -1, count: 0 })

  return (
    <figure>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <p className="text-gray-500">
          <span className="font-display text-xl font-semibold text-navy-900 tabular-nums">{total.toLocaleString()}</span> entries
        </p>
        {peak.count > 0 && (
          <p className="text-gray-500">
            Busiest at <span className="font-medium text-navy-900">{formatHour(peak.hour)}</span>
          </p>
        )}
        <p className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: NAVY }} /> Past hours
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: MARIGOLD }} /> This hour
          </span>
        </p>
      </div>
      <div className="h-64" aria-hidden={total === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="#efebe3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tick={{ fill: '#5e7085' }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} tick={{ fill: '#8e9aa8' }} />
            <Tooltip
              cursor={{ fill: '#f2efe8' }}
              contentStyle={{
                background: NAVY,
                border: 'none',
                borderRadius: 10,
                color: '#f7f5f0',
                fontSize: 13,
                boxShadow: '0 8px 24px -8px rgb(9 28 49 / 0.4)',
              }}
              labelStyle={{ color: '#b9c6d3', marginBottom: 2 }}
              itemStyle={{ color: '#f7f5f0' }}
              formatter={(value) => [value, 'Entries']}
            />
            <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={28}>
              {rows.map((r) => (
                <Cell key={r.hour} fill={r.hour === nowHour ? MARIGOLD : r.hour > nowHour ? NAVY_SOFT : NAVY} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Entries per hour today, {total} in total.</figcaption>
    </figure>
  )
}
