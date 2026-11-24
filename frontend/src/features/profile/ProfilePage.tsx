import { Clock, IdCard, LogOut, Save, ShieldAlert, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout, updateProfile, type Session } from '@/api/auth'
import { errorMessage } from '@/api/errors'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Section } from '@/components/ui/Section'
import { useToast } from '@/components/ui/useToast'
import { useSession } from '@/hooks/useSession'
import { formatDateTime, formatRelative } from '@/lib/format'
import { initials } from '@/lib/initials'

/** The signed-in person's profile: their details, their display name, and logging out. */
export function ProfilePage() {
  const user = useSession()
  const navigate = useNavigate()
  const toast = useToast()

  // RequireAuth keeps logged-out visitors away, so this is only a safety net.
  if (!user) return null

  const signOut = () => {
    logout()
    navigate('/')
    toast.success('You are logged out.')
  }

  return (
    <>
      <PageHeader
        title="My profile"
        description="Your account in Bantay."
        leading={
          <span className="flex size-14 items-center justify-center rounded-full bg-navy-900 font-display text-lg font-semibold text-marigold-400 ring-4 ring-white">
            {initials(user.displayName)}
          </span>
        }
        actions={
          <Button variant="danger" onClick={signOut} icon={<LogOut />}>
            Log out
          </Button>
        }
      />

      <div className="space-y-6">
        <Alert tone="info" title="Accounts aren't connected to the server yet">
          The Bantay server doesn&apos;t have user accounts yet, so your login and profile are kept in this browser only.
          Logging out hides the app here, but it doesn&apos;t lock the data.
        </Alert>

        <div className="grid gap-6 lg:grid-cols-3">
          <Section title="Account" icon={<IdCard />}>
            <DescriptionList
              items={[
                { label: 'Username', value: `@${user.username}` },
                { label: 'Role', value: user.role },
                {
                  label: 'Logged in',
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5 text-gray-400" aria-hidden />
                      {formatDateTime(user.signedInAt)}{' '}
                      <span className="text-gray-500">({formatRelative(user.signedInAt)})</span>
                    </span>
                  ),
                },
              ]}
            />
          </Section>

          <Section title="Display name" description="How your name appears in Bantay." icon={<UserRound />} className="lg:col-span-2">
            <DisplayNameForm user={user} />
          </Section>
        </div>

        <Section title="Log out" icon={<ShieldAlert />}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-sm text-gray-500">
              Log out when you leave a shared computer. You&apos;ll need to log in again to open the dashboard.
            </p>
            <Button variant="danger" onClick={signOut} icon={<LogOut />}>
              Log out of Bantay
            </Button>
          </div>
        </Section>
      </div>
    </>
  )
}

function DisplayNameForm({ user }: { user: Session }) {
  const toast = useToast()
  const [name, setName] = useState(user.displayName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const changed = name.trim() !== user.displayName

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await updateProfile({ displayName: name })
      toast.success('Profile saved.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField htmlFor="profile-name" label="Display name" error={error} hint="For example, your full name.">
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          maxLength={80}
          autoComplete="name"
          aria-invalid={Boolean(error)}
        />
      </FormField>
      <div className="flex justify-end gap-3">
        {changed && (
          <Button onClick={() => setName(user.displayName)} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={!changed} loading={saving} icon={<Save />}>
          Save
        </Button>
      </div>
    </form>
  )
}
