import { ArrowRight, Flag, History, IdCard, ImagePlus, Pencil, Power, PowerOff, ScanFace, ShieldAlert, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listEntries } from '@/api/entries'
import { errorMessage } from '@/api/errors'
import { listFlags } from '@/api/flags'
import { deletePerson, getPerson, listFaces, updatePerson } from '@/api/persons'
import type { EntryLogRead, FlagRead } from '@/api/types'
import { ActiveBadge } from '@/components/common/badges'
import { FLAG_TYPES, FlagStatusBadge, FlagTypeIcon } from '@/components/common/flags'
import { Avatar } from '@/components/ui/Avatar'
import { PersonForm } from '@/components/common/PersonForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { Section } from '@/components/ui/Section'
import { useToast } from '@/components/ui/useToast'
import { EntriesTable } from '@/features/entry-logs/components/EntriesTable'
import { EntryDetail } from '@/features/entry-logs/components/EntryDetail'
import { useAsync } from '@/hooks/useAsync'
import { MIN_ENROLLMENT_PHOTOS, PERSON_TYPE_LABELS } from '@/lib/constants'
import { formatDate, formatRelative, formatTime, pluralize } from '@/lib/format'
import { AddFacesModal } from './components/AddFacesModal'
import { FaceList } from './components/FaceList'

type Dialog = 'edit' | 'faces' | 'deactivate' | 'delete' | null

export function UserDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const toast = useToast()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [entry, setEntry] = useState<EntryLogRead | null>(null)

  const person = useAsync(() => getPerson(id), [id])
  const faces = useAsync(() => listFaces(id), [id])
  const entries = useAsync(() => listEntries({ person_id: id, size: 10 }), [id])
  const flags = useAsync(async () => {
    const all = await listFlags()
    return all.filter((f) => f.persons_inside.some((pi) => pi.person?.id === id))
  }, [id])

  const p = person.data
  if (person.loading && !p) return <LoadingState />
  if (!p) return <ErrorState error={person.error} onRetry={person.reload} />

  const refresh = () => {
    person.reload()
    faces.reload()
    flags.reload()
  }
  const needsPhotos = p.embedding_count < MIN_ENROLLMENT_PHOTOS
  const taggedIncidents = flags.data?.filter((f) => f.persons_inside.some((pi) => pi.person?.id === id && pi.responsible)) ?? []

  return (
    <>
      <PageHeader
        back={{ to: '/users', label: 'Users' }}
        leading={<Avatar name={p.full_name} size="lg" className="ring-4 ring-white" />}
        title={p.full_name}
        description={`${p.id_number} · ${PERSON_TYPE_LABELS[p.person_type]}${p.department ? ` · ${p.department}` : ''}`}
        actions={
          <>
            <Button onClick={() => setDialog('edit')} icon={<Pencil />}>
              Edit
            </Button>
            {p.active ? (
              <Button onClick={() => setDialog('deactivate')} icon={<PowerOff />}>
                Deactivate
              </Button>
            ) : (
              <Button
                icon={<Power />}
                onClick={async () => {
                  try {
                    await updatePerson(p.id, { active: true })
                    toast.success(`${p.full_name} is active again.`)
                    person.reload()
                  } catch (err) {
                    toast.error(errorMessage(err))
                  }
                }}
              >
                Activate
              </Button>
            )}
            <Button variant="danger" onClick={() => setDialog('delete')} icon={<Trash2 />}>
              Delete
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {taggedIncidents.length > 0 && (
          <Alert
            tone="error"
            title={`${pluralize(taggedIncidents.length, 'confirmed incident')} tagged`}
            action={
              <ButtonLink size="sm" variant="danger" to={`/flags?status=CONFIRMED`}>
                Review flags
              </ButtonLink>
            }
          >
            This person was identified as responsible for {taggedIncidents.map((f: FlagRead) => FLAG_TYPES[f.type].label.toLowerCase()).join(', ')}.
          </Alert>
        )}
        {!p.active && (
          <Alert title="This person is inactive">Bantay will not recognize them until they are activated again.</Alert>
        )}
        {!p.consent_given ? (
          <Alert
            tone="warning"
            title="Consent not signed"
            action={
              <Button size="sm" onClick={() => setDialog('edit')}>
                Record consent
              </Button>
            }
          >
            Face photos cannot be added until the consent form is signed.
          </Alert>
        ) : (
          needsPhotos &&
          p.active && (
            <Alert
              tone="warning"
              title={p.embedding_count === 0 ? 'Not enrolled yet' : 'More face photos needed'}
              action={
                <Button size="sm" variant="primary" onClick={() => setDialog('faces')} icon={<ImagePlus />}>
                  Add face photos
                </Button>
              }
            >
              {pluralize(p.embedding_count, 'face')} on file; at least {MIN_ENROLLMENT_PHOTOS} are needed for reliable recognition.
            </Alert>
          )
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Section title="Details" icon={<IdCard />}>
            <DescriptionList
              items={[
                { label: 'ID number', value: p.id_number },
                { label: 'Type', value: PERSON_TYPE_LABELS[p.person_type] },
                { label: 'Department', value: p.department ?? '—' },
                {
                  label: 'Consent',
                  value: p.consent_given ? `Signed${p.consent_signed_at ? ` on ${formatDate(p.consent_signed_at)}` : ''}` : 'Not signed',
                },
                { label: 'Status', value: <ActiveBadge active={p.active} /> },
                { label: 'Registered', value: formatDate(p.created_at) },
              ]}
            />
          </Section>

          <Section
            title="Face photos"
            icon={<ScanFace />}
            description={`${pluralize(p.embedding_count, 'face')} on file. Photos themselves are never stored.`}
            className="lg:col-span-2"
            flush
            actions={
              <Button size="sm" onClick={() => setDialog('faces')} disabled={!p.consent_given} icon={<ImagePlus />}>
                Add photos
              </Button>
            }
          >
            {faces.data ? <FaceList personId={p.id} faces={faces.data} onChanged={refresh} /> : <LoadingState />}
          </Section>
        </div>

        {flags.data && flags.data.length > 0 && (
          <Section
            title="Flagged incidents"
            description="Behaviour alerts in labs where this person was present"
            icon={<Flag />}
            flush
          >
            <ul className="divide-y divide-gray-100">
              {flags.data.map((f: FlagRead) => {
                const isResp = f.persons_inside.some((pi) => pi.person?.id === id && pi.responsible)
                return (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <FlagTypeIcon type={f.type} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link to={`/flags/${f.id}`} className="truncate text-sm font-semibold text-navy-900 hover:underline">
                            {FLAG_TYPES[f.type].label}
                          </Link>
                          {isResp && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-red-600/15">
                              <ShieldAlert className="size-3" />
                              Tagged responsible
                            </span>
                          )}
                          <FlagStatusBadge status={f.status} />
                        </div>
                        <p className="truncate text-xs text-gray-500">
                          {f.lab_name} · {f.camera_name ?? 'Room'} · {formatTime(f.occurred_at)} ({formatRelative(f.occurred_at)})
                        </p>
                      </div>
                    </div>
                    <ButtonLink to={`/flags/${f.id}`} size="sm" variant="ghost">
                      Evidence
                      <ArrowRight />
                    </ButtonLink>
                  </li>
                )
              })}
            </ul>
          </Section>
        )}

        <Section
          title="Recent entries"
          icon={<History />}
          flush
          actions={
            <ButtonLink size="sm" variant="ghost" to={`/logs?person_id=${p.id}`}>
              View all
              <ArrowRight />
            </ButtonLink>
          }
        >
          <EntriesTable
            rows={entries.data?.items}
            loading={entries.loading}
            onOpen={setEntry}
            hidePerson
            empty={<EmptyState title="No entries yet" description="Entries appear when this person walks into a lab." />}
          />
        </Section>
      </div>

      <Modal open={dialog === 'edit'} onClose={() => setDialog(null)} title="Edit person" size="lg">
        <PersonForm
          person={p}
          onSubmit={async ({ id_number: _ignored, ...changes }) => {
            await updatePerson(p.id, changes)
            toast.success('Changes saved.')
            setDialog(null)
            person.reload()
          }}
          renderActions={({ submitting, formId }) => (
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-5">
              <Button onClick={() => setDialog(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" form={formId} variant="primary" loading={submitting}>
                Save changes
              </Button>
            </div>
          )}
        />
      </Modal>

      <AddFacesModal person={p} open={dialog === 'faces'} onClose={() => setDialog(null)} onUploaded={refresh} />

      <ConfirmDialog
        open={dialog === 'deactivate'}
        onClose={() => setDialog(null)}
        title={`Deactivate ${p.full_name}?`}
        confirmLabel="Deactivate"
        onConfirm={async () => {
          await updatePerson(p.id, { active: false })
          toast.success(`${p.full_name} deactivated.`)
          person.reload()
        }}
      >
        <p>Bantay will stop recognizing this person. Their face data and past entries are kept, and you can activate them again later.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title={`Delete ${p.full_name}?`}
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          await deletePerson(p.id)
          toast.success(`${p.full_name} deleted and their face data erased.`)
          navigate('/users')
        }}
      >
        <p>This erases the person and all their face data, as required when someone withdraws consent (RA 10173).</p>
        <p>Their past entries stay in the log for the lab&apos;s records, but will no longer show their name.</p>
        <p className="font-medium text-gray-900">This cannot be undone.</p>
      </ConfirmDialog>

      <EntryDetail
        entry={entry}
        onClose={() => setEntry(null)}
        onDeleted={() => {
          setEntry(null)
          entries.reload()
        }}
      />
    </>
  )
}
