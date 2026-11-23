import { useState, type ReactNode } from 'react'
import { errorMessage } from '@/api/errors'
import { Button } from './Button'
import { Modal } from './Modal'
import { Alert } from './Alert'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  /** Runs when the user confirms. The dialog closes on success and shows the error otherwise. */
  onConfirm: () => Promise<unknown> | void
  title: ReactNode
  children: ReactNode
  confirmLabel?: string
  destructive?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  destructive = false,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (busy) return
    setError(null)
    onClose()
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      setBusy(false)
      onClose()
    } catch (err) {
      setBusy(false)
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={confirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-gray-700">
        {children}
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Modal>
  )
}
