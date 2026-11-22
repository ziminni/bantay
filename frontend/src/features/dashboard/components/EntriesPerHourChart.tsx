import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HourBucket } from '@/api/types'
import { formatHour } from '@/lib/format'

/**
 * Entries per hour of today. Shows 6 AM to 9 PM, widened if there were entries
 * outside those hours, so the chart is not mostly empty night-time bars.
 */
export function EntriesPerHourChart({ data }: { data: HourBucket[] }) {
  const withEntries = data.filter((b) => b.count > 0).map((b) => b.hour)
  const from = Math.min(6, ...withEntries)
  const to = Math.max(21, ...withEntries)
  const rows = data.filter((b) => b.hour >= from && b.hour <= to).map((b) => ({ ...b, label: formatHour(b.hour) }))
  const total = data.reduce((sum, b) => sum + b.count, 0)

  return (
    <figure>
      <div className="h-64" aria-hidden={total === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip
              cursor={{ fill: '#f3f4f6' }}
              formatter={(value) => [value, 'Entries']}
              labelFormatter={(label) => `${label}`}
            />
            <Bar dataKey="count" fill="#374151" radius={[3, 3, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Entries per hour today, {total} in total.
      </figcaption>
    </figure>
  )
}
