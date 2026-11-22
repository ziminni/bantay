import { Link } from 'react-router-dom'
import type { EntryDecision, RecognizeResult } from '@/api/types'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatSimilarity } from '@/lib/format'

/** The closest enrolled person for each face, and whether it passes the threshold. */
export function FaceResults({ result }: { result: RecognizeResult }) {
  if (result.faces.length === 0) {
    return <EmptyState title="No face found" description="Try a clearer, well-lit photo where the face looks at the camera." />
  }

  return (
    <ol className="space-y-3">
      {result.faces.map((f, i) => (
        <li key={i} className="rounded-md border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Face {i + 1}</p>
              {f.match ? (
                <>
                  <Link to={`/users/${f.match.person_id}`} className="font-medium text-gray-900 hover:underline">
                    {f.match.full_name}
                  </Link>
                  <p className="text-sm text-gray-500">{f.match.id_number}</p>
                </>
              ) : (
                <p className="font-medium text-gray-500">No one enrolled yet</p>
              )}
            </div>
            <StatusBadge on={f.accepted}>{f.accepted ? 'Match' : 'Not a match'}</StatusBadge>
          </div>

          {f.match && (
            <div className="mt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Similarity</span>
                <span className="font-medium tabular-nums">
                  {formatSimilarity(f.match.similarity)}{' '}
                  <span className="font-normal text-gray-500">/ needs {formatSimilarity(result.threshold)}</span>
                </span>
              </div>
              <div className="relative mt-1.5 h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-gray-700"
                  style={{ width: `${Math.max(0, Math.min(1, f.match.similarity)) * 100}%` }}
                />
                <div
                  className="absolute -top-1 h-4 w-0.5 bg-gray-900"
                  style={{ left: `${result.threshold * 100}%` }}
                  title="Threshold"
                />
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500">Detection confidence {formatSimilarity(f.det_score)}</p>
        </li>
      ))}
    </ol>
  )
}

const REASONS: Record<EntryDecision['reason'], string> = {
  logged: 'An entry was recorded.',
  cooldown: 'Not recorded: this person was already logged in this lab within the cooldown period.',
  below_threshold_unknown: 'The face did not reach the threshold, so it was recorded as an Unknown entry.',
  no_faces: 'No face was found in the photo, so nothing was recorded.',
  lab_inactive: 'Not recorded: the lab is inactive.',
}

/** What the entry rules decided, after "Test and record". */
export function DecisionResult({ decision }: { decision: EntryDecision }) {
  return (
    <Alert
      tone={decision.logged ? 'success' : 'warning'}
      title={decision.logged ? 'Entry recorded' : 'No entry recorded'}
      action={
        decision.entry && (
          <Link to={`/logs?range=today&lab_id=${decision.entry.lab_id}`} className="text-sm font-medium underline">
            See in logs
          </Link>
        )
      }
    >
      {REASONS[decision.reason]}
      {decision.entry?.person && ` Recognized as ${decision.entry.person.full_name}.`}
      {decision.similarity != null && ` Similarity ${formatSimilarity(decision.similarity)}.`}
    </Alert>
  )
}
