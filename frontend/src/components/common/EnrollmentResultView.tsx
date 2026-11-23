import type { EnrollmentResult } from '@/api/types'
import { Alert } from '@/components/ui/Alert'
import { MIN_ENROLLMENT_PHOTOS } from '@/lib/constants'
import { formatSimilarity, pluralize } from '@/lib/format'

/** What happened to each uploaded photo. */
export function EnrollmentResultView({ result }: { result: EnrollmentResult }) {
  const missing = MIN_ENROLLMENT_PHOTOS - result.total_embeddings

  return (
    <div className="space-y-6">
      {result.meets_minimum ? (
        <Alert tone="success" title="Enrollment complete">
          This person now has {pluralize(result.total_embeddings, 'face photo')} on file and will be recognized at
          lab entrances.
        </Alert>
      ) : (
        <Alert tone="warning" title="More photos needed">
          {pluralize(result.total_embeddings, 'face photo')} on file. Add at least {pluralize(missing, 'more photo')}{' '}
          so this person can be recognized reliably.
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Accepted ({result.accepted.length})</h3>
          {result.accepted.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No photo was accepted.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
              {result.accepted.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="truncate">{f.source_filename}</span>
                  <span className="shrink-0 text-gray-500">Quality {formatSimilarity(f.det_score)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">Rejected ({result.rejected.length})</h3>
          {result.rejected.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No photo was rejected.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
              {result.rejected.map((r) => (
                <li key={r.filename} className="px-4 py-2.5 text-sm">
                  <p className="truncate font-medium">{r.filename}</p>
                  <p className="text-gray-500">{r.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500">{result.note}</p>
    </div>
  )
}
