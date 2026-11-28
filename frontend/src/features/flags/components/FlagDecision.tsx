import { Check, CheckCircle2, RotateCcw, ShieldAlert, Users, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '@/api/errors'
import { reopenFlag, reviewFlag } from '@/api/flags'
import type { FlagRead } from '@/api/types'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Section } from '@/components/ui/Section'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/cn'
import { formatDateTime, formatTime } from '@/lib/format'
import { PERSON_TYPE_LABELS } from '@/lib/constants'

/**
 * Who was inside when the flag was raised, with a tick for the person who
 * did it, then the decision. Remounted per flag (key) so state resets.
 */
export function FlagDecision({ flag, onReviewed }: { flag: FlagRead; onReviewed: (flag: FlagRead) => void }) {
  const toast = useToast()
  const pending = flag.status === 'PENDING'
  const [note, setNote] = useState(flag.review_note ?? '')
  const [responsible, setResponsible] = useState<Set<number>>(
    () => new Set(flag.persons_inside.filter((p) => p.responsible).map((p) => p.entry_id)),
  )
  const [busy, setBusy] = useState<'CONFIRMED' | 'DISMISSED' | 'REOPEN' | null>(null)

  const toggle = (entryId: number) =>
    setResponsible((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })

  const decide = async (status: 'CONFIRMED' | 'DISMISSED') => {
    setBusy(status)
    try {
      const updated = await reviewFlag(flag.id, {
        status,
        note,
        responsible_entry_ids: status === 'CONFIRMED' ? [...responsible] : [],
      })
      toast.success(status === 'CONFIRMED' ? 'Flag confirmed and saved to the audit log.' : 'Flag dismissed.')
      onReviewed(updated)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const reopen = async () => {
    setBusy('REOPEN')
    try {
      const updated = await reopenFlag(flag.id)
      toast.success('Flag moved back to pending.')
      onReviewed(updated)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  // Keyboard: C confirms, D dismisses (not while typing in the note).
  const decideRef = useRef(decide)
  useEffect(() => {
    decideRef.current = decide
  })
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || target.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'c') decideRef.current('CONFIRMED')
      if (e.key === 'd') decideRef.current('DISMISSED')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending])

  return (
    <>
      <Section
        title="Persons inside at that time"
        description={
          pending
            ? 'Everyone who entered this lab in the 3 hours before. Tick who did it, if you can tell from the snapshot.'
            : 'Everyone who entered this lab in the 3 hours before.'
        }
        icon={<Users />}
        flush
      >
        {flag.persons_inside.length === 0 ? (
          <p className="px-6 py-6 text-sm text-gray-500">No entries were logged in this lab before the flag.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {flag.persons_inside.map((p) => {
              const ticked = responsible.has(p.entry_id)
              return (
                <li key={p.entry_id} className={cn('flex items-center gap-3 px-5 py-3 sm:px-6', ticked && 'bg-red-50/60')}>
                  <Avatar name={p.person?.full_name} unknown={!p.person} />
                  <div className="min-w-0 flex-1">
                    {p.person ? (
                      <Link to={`/users/${p.person.id}`} className="block truncate text-sm font-medium text-navy-900 hover:underline">
                        {p.person.full_name}
                      </Link>
                    ) : (
                      <span className="block text-sm font-medium text-gray-600">Unknown person</span>
                    )}
                    <p className="truncate text-xs text-gray-500">
                      {p.person ? `${p.person.id_number} · ${PERSON_TYPE_LABELS[p.person.person_type]} · ` : `Entry #${p.entry_id} · `}
                      in since {formatTime(p.entered_at)}
                    </p>
                  </div>
                  {pending ? (
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors select-none',
                        ticked ? 'border-red-300 bg-white text-red-700' : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      )}
                    >
                      <input type="checkbox" checked={ticked} onChange={() => toggle(p.entry_id)} className="sr-only" />
                      <span
                        aria-hidden
                        className={cn(
                          'flex size-4 items-center justify-center rounded border',
                          ticked ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300',
                        )}
                      >
                        {ticked && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      Responsible
                    </label>
                  ) : (
                    p.responsible && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/15 ring-inset">
                        <ShieldAlert className="size-3.5" />
                        Responsible
                      </span>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {pending ? (
        <Section title="Decision" description="Saved with your name to the audit log.">
          <label htmlFor="review-note" className="mb-1.5 block text-sm font-medium text-navy-900">
            Review note <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <Textarea
            id="review-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you saw in the snapshot or entry, who you talked to…"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" loading={busy === 'CONFIRMED'} disabled={busy !== null} onClick={() => decide('CONFIRMED')} icon={<CheckCircle2 />}>
              Confirm{responsible.size > 0 ? ` · ${responsible.size} tagged` : ''}
            </Button>
            <Button loading={busy === 'DISMISSED'} disabled={busy !== null} onClick={() => decide('DISMISSED')} icon={<XCircle />}>
              Dismiss
            </Button>
            <span className="ml-auto hidden items-center gap-1.5 text-xs text-gray-500 md:flex">
              <Kbd>C</Kbd> confirm <Kbd>D</Kbd> dismiss <Kbd>J</Kbd>/<Kbd>K</Kbd> next/previous
            </span>
          </div>
        </Section>
      ) : (
        <Section>
          <div className="flex flex-wrap items-start gap-4">
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl',
                flag.status === 'CONFIRMED' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500',
              )}
            >
              {flag.status === 'CONFIRMED' ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-navy-900">
                {flag.status === 'CONFIRMED' ? 'Confirmed' : 'Dismissed'} by {flag.reviewed_by ?? 'an administrator'}
              </p>
              <p className="text-sm text-gray-500">{formatDateTime(flag.reviewed_at)}</p>
              {flag.review_note && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-navy-800">“{flag.review_note}”</p>}
            </div>
            <Button size="sm" variant="ghost" loading={busy === 'REOPEN'} onClick={reopen} icon={<RotateCcw />}>
              Reopen
            </Button>
          </div>
        </Section>
      )}
    </>
  )
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-gray-200 bg-white px-1 font-mono text-[10px] font-semibold text-navy-800 shadow-card">
      {children}
    </kbd>
  )
}
