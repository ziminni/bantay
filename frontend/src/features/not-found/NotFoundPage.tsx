import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center px-6 py-16 text-center">
      <Logo variant="stacked" className="w-44 opacity-90" />
      <p className="mt-10 font-display text-sm font-semibold tracking-[0.2em] text-marigold-600 uppercase">Error 404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-navy-900">Nothing to watch here</h1>
      <p className="mt-2 max-w-sm text-gray-500">The page you are looking for does not exist or was moved.</p>
      <ButtonLink to="/" variant="primary" className="mt-8" icon={<ArrowLeft />}>
        Back to the dashboard
      </ButtonLink>
    </div>
  )
}
