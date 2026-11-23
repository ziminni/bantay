import { Eye, EyeOff, Lock, LogIn, User } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '@/api/auth'
import { errorMessage } from '@/api/errors'
import { BrandMark } from '@/components/brand/BrandMark'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/useToast'

/** The sign-in dialog opened from the landing page. */
export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Log in to Bantay" description="For lab administrators and department staff.">
      {open && <LoginForm />}
    </Modal>
  )
}

function LoginForm() {
  const id = useId()
  const navigate = useNavigate()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!username.trim()) next.username = 'Enter your username.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    setFormError(null)
    if (next.username || next.password) return

    setSubmitting(true)
    try {
      const s = await login(username, password)
      toast.success(`Welcome, ${s.username}.`)
      navigate('/dashboard')
    } catch (err) {
      setFormError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="flex justify-center pb-1">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-navy-900 shadow-raised">
          <BrandMark tone="light" className="size-10" />
        </span>
      </div>

      <FormField htmlFor={`${id}-user`} label="Username" error={errors.username}>
        <div className="relative">
          <User aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            id={`${id}-user`}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setErrors((x) => ({ ...x, username: undefined }))
            }}
            autoComplete="username"
            autoFocus
            className="pl-9"
            placeholder="e.g. labadmin"
            aria-invalid={Boolean(errors.username)}
          />
        </div>
      </FormField>

      <FormField htmlFor={`${id}-pass`} label="Password" error={errors.password}>
        <div className="relative">
          <Lock aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            id={`${id}-pass`}
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setErrors((x) => ({ ...x, password: undefined }))
            }}
            autoComplete="current-password"
            className="pr-10 pl-9"
            aria-invalid={Boolean(errors.password)}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-navy-900"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </FormField>

      {formError && <Alert tone="error">{formError}</Alert>}

      <Button type="submit" variant="primary" loading={submitting} icon={<LogIn />} className="h-11 w-full">
        Log in
      </Button>

      <p className="text-center text-xs text-gray-500">Accounts are given out by the laboratory office.</p>
    </form>
  )
}
