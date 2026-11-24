import { listCameras } from '@/api/cameras'
import { listLabs } from '@/api/labs'
import { PageHeader } from '@/components/layout/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/LoadingState'
import { Section } from '@/components/ui/Section'
import { useAsync } from '@/hooks/useAsync'
import { LabWallCard } from './components/LabWallCard'

/** Step one of the camera wall: choose which lab to watch. */
export function CameraWallPage() {
  const data = useAsync(() => Promise.all([listLabs(), listCameras()]), [], { refreshInterval: 30_000 })
  const [labs, cameras] = data.data ?? [[], []]

  return (
    <>
      <PageHeader
        title="Camera Wall"
        description="Watch every camera in a lab at once, like a security monitor. Pick a lab to start."
      />

      {data.loading && !data.data ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : data.error && !data.data ? (
        <Section>
          <ErrorState error={data.error} onRetry={data.reload} />
        </Section>
      ) : labs.length === 0 ? (
        <Section>
          <EmptyState
            title="No laboratories yet"
            description="Add a lab and its cameras first."
            action={<ButtonLink to="/labs">Go to Labs</ButtonLink>}
          />
        </Section>
      ) : (
        <div className="grid animate-fade-in gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {labs.length > 1 && (
            <LabWallCard to="/wall/all" title="All labs" subtitle="Every camera, every lab" cameras={cameras} featured />
          )}
          {labs.map((lab) => (
            <LabWallCard
              key={lab.id}
              to={`/wall/${lab.id}`}
              title={lab.name}
              subtitle={lab.room}
              cameras={cameras.filter((c) => c.lab_id === lab.id)}
              inactive={!lab.active}
            />
          ))}
        </div>
      )}
    </>
  )
}
