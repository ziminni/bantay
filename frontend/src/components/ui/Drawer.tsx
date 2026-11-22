import { useEffect, useRef, type ReactNode } from 'react'
import { CloseButton } from './Modal'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** A panel that slides over the right side of the page, for viewing details without leaving a list. */
export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
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
        if (e.target === ref.current) onClose()
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-full w-full max-w-md border-l border-gray-200 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-gray-900/30"
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <CloseButton onClick={onClose} />
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-gray-200 px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
