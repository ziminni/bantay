import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Buttons shown at the bottom, right-aligned. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /**
   * Draw only the children — no header, padding or footer — for dialogs with
   * their own layout, like the login dialog. `title` then labels the dialog
   * for screen readers.
   */
  bare?: boolean
}

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-3xl', '2xl': 'max-w-4xl' }

/**
 * A centred dialog built on the native <dialog> element, which handles focus
 * trapping, the Escape key and the backdrop for us.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', bare = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === ref.current) onClose()
      }}
      aria-label={bare && typeof title === 'string' ? title : undefined}
      className={cn(
        'm-auto w-[calc(100%-2rem)] border-gray-200 bg-white p-0 text-navy-900 shadow-overlay backdrop:bg-navy-950/50 open:animate-fade-in',
        bare ? 'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border-0' : 'rounded-2xl border',
        widths[size],
      )}
    >
      {open && bare && children}
      {open && !bare && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
              {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
            </div>
            <CloseButton onClick={onClose} />
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-4">{footer}</footer>
          )}
        </div>
      )}
    </dialog>
  )
}

export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="-mt-1 -mr-2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-navy-900"
    >
      <X className="size-5" aria-hidden />
    </button>
  )
}
