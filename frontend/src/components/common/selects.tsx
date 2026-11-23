import type { SelectHTMLAttributes } from 'react'
import { listCameras } from '@/api/cameras'
import { listLabs } from '@/api/labs'
import { Select } from '@/components/ui/Input'
import { useAsync } from '@/hooks/useAsync'

type BaseProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & { placeholder?: string }

/** A dropdown of laboratories, loaded from the API. */
export function LabSelect({ placeholder = 'All labs', activeOnly = false, ...rest }: BaseProps & { activeOnly?: boolean }) {
  const { data } = useAsync(() => listLabs(activeOnly ? { active: true } : {}), [activeOnly])
  const options = (data ?? []).map((l) => ({
    value: String(l.id),
    label: l.active ? l.name : `${l.name} (inactive)`,
  }))
  return <Select options={options} placeholder={placeholder} {...rest} />
}

/** A dropdown of cameras, optionally limited to one laboratory. */
export function CameraSelect({ labId, placeholder = 'All cameras', ...rest }: BaseProps & { labId?: number }) {
  const { data } = useAsync(() => listCameras(labId ? { lab_id: labId } : {}), [labId])
  const options = (data ?? []).map((c) => ({
    value: String(c.id),
    label: labId ? c.name : `${c.name} — ${c.lab_name ?? ''}`,
  }))
  return <Select options={options} placeholder={placeholder} {...rest} />
}
