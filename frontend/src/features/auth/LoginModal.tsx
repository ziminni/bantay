import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, User, X } from 'lucide-react'
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '@/api/auth'
import { errorMessage } from '@/api/errors'
import { BrandMark } from '@/components/brand/BrandMark'
import { Logo } from '@/components/brand/Logo'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/cn'
import { safeNext } from '@/lib/safeNext'

/**
 * The sign-in dialog: a navy brand panel on the left and the form on the
 * right. On phones the panel shrinks to a band with the logo above the form.
 */
export function LoginModal({ open, onClose, next }: { open: boolean; onClose: () => void; next?: string | null }) {
  return (
    <Modal open={open} onClose={onClose} title="Log in to Bantay" size="2xl" bare>
      {open && (
        <div className="relative grid md:grid-cols-[0.95fr_1.05fr]">
          <BrandPanel />
          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <LoginForm redirectTo={safeNext(next)} />
          </div>
          {/* Last in the page order so the cursor starts in the username field, not here. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 rounded-lg p-2 text-navy-200 transition-colors hover:bg-white/10 hover:text-cream md:text-gray-400 md:hover:bg-gray-100 md:hover:text-navy-900"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      )}
    </Modal>
  )
}

/** Left side: the logo, the tagline and a small viewfinder catching a face. */
function BrandPanel() {
  return (
    <div className="relative overflow-hidden bg-navy-900 text-cream">
      {/* Faint framing grid, as on the landing page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(var(--color-cream)_1px,transparent_1px),linear-gradient(90deg,var(--color-cream)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_50%_45%,black,transparent_75%)]"
      />

      {/* Phones: a compact band with just the logo. */}
      <div className="relative flex items-center justify-center px-6 py-6 md:hidden">
        <Logo variant="lockup-on-dark" className="h-10 w-auto" />
      </div>

      {/* Tablets and up: the full panel. */}
      <div className="relative hidden h-full flex-col p-10 md:flex">
        <Logo variant="lockup-on-dark" className="h-11 w-auto self-start" />

        <div className="my-auto py-10">
          <Viewfinder />
          <h2 className="mt-8 font-display text-3xl leading-tight font-semibold">
            Lab entry,
            <br />
            <span className="text-marigold-400">on watch.</span>
          </h2>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-navy-200">
            Today&apos;s entries, the live cameras and the full history of every computer lab, in one place.
          </p>
        </div>

        <p className="flex items-center gap-2 text-xs text-navy-300">
          <span className="size-1.5 rounded-full bg-marigold-400" aria-hidden />
          Central Mindanao University
        </p>
      </div>
    </div>
  )
}

function Viewfinder() {
  const corner = 'absolute size-6 border-cream/70'
  return (
    <div aria-hidden className="relative flex size-36 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10">
      <span className={cn(corner, 'top-3 left-3 rounded-tl-xl border-t-[3px] border-l-[3px]')} />
      <span className={cn(corner, 'top-3 right-3 rounded-tr-xl border-t-[3px] border-r-[3px]')} />
      <span className={cn(corner, 'right-3 bottom-3 rounded-br-xl border-r-[3px] border-b-[3px]')} />
      <span className={cn(corner, 'bottom-3 left-3 rounded-bl-xl border-b-[3px] border-l-[3px]')} />
      <BrandMark tone="light" className="size-16" />
      <span className="absolute inset-x-6 h-0.5 animate-scan rounded-full bg-gradient-to-r from-transparent via-marigold-400 to-transparent shadow-[0_0_10px_2px_rgb(242_169_59/0.5)]" />
    </div>
  )
}

function LoginForm({ redirectTo }: { redirectTo: string }) {
  const id = useId()
  const navigate = useNavigate()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problems: typeof errors = {}
    if (!username.trim()) problems.username = 'Enter your username.'
    if (!password) problems.password = 'Enter your password.'
    setErrors(problems)
    setFormError(null)
    if (problems.username || problems.password) return

    setSubmitting(true)
    try {
      const s = await login(username, password)
      toast.success(`Welcome, ${s.displayName}.`)
      navigate(redirectTo)
    } catch (err) {
      setFormError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex h-full flex-col">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-marigold-600 uppercase">Welcome back</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-navy-900 sm:text-[1.75rem]">Log in to Bantay</h2>
        <p className="mt-1.5 text-sm text-gray-500">For lab administrators and department staff.</p>
      </div>

      <div className="mt-8 space-y-5">
        <FormField htmlFor={`${id}-user`} label="Username" error={errors.username}>
          <div className="relative">
            <User aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              id={`${id}-user`}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setErrors((x) => ({ ...x, username: undefined }))
              }}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              className="h-11 pl-10"
              placeholder="e.g. labadmin"
              aria-invalid={Boolean(errors.username)}
            />
          </div>
        </FormField>

        <FormField
          htmlFor={`${id}-pass`}
          label="Password"
          error={errors.password}
          hint={capsLock ? 'Caps Lock is on.' : undefined}
        >
          <div className="relative">
            <Lock aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              id={`${id}-pass`}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setErrors((x) => ({ ...x, password: undefined }))
              }}
              onKeyUp={checkCaps}
              onKeyDown={checkCaps}
              autoComplete="current-password"
              className="h-11 pr-11 pl-10"
              aria-invalid={Boolean(errors.password)}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
              aria-pressed={show}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-navy-900"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </FormField>

        {formError && <Alert tone="error">{formError}</Alert>}

        <Button type="submit" variant="primary" loading={submitting} className="group h-12 w-full text-[15px]">
          {submitting ? 'Logging in…' : 'Log in'}
          {!submitting && <ArrowRight className="transition-transform group-hover:translate-x-0.5" />}
        </Button>
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-xl bg-gray-50 p-4 text-xs leading-relaxed text-gray-500 ring-1 ring-gray-100">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-navy-500" aria-hidden />
        <p>
          Need an account? Ask the laboratory office. Log out when you leave a shared computer.
        </p>
      </div>
    </form>
  )
}
