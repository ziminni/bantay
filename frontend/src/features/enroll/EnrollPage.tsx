import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPerson } from '@/api/persons'
import type { EnrollmentResult, PersonRead } from '@/api/types'
import { EnrollmentResultView } from '@/components/common/EnrollmentResultView'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Section } from '@/components/ui/Section'
import { Stepper } from '@/components/ui/Stepper'
import { PersonStep } from './components/PersonStep'
import { PhotoStep } from './components/PhotoStep'

const STEPS = ['Choose person', 'Add face photos', 'Done']

/**
 * Enroll a face in three steps. Open with ?person=<id> to skip straight to the
 * photos for someone already registered.
 */
export function EnrollPage() {
  const [params, setParams] = useSearchParams()
  const [person, setPerson] = useState<PersonRead | null>(null)
  const [result, setResult] = useState<EnrollmentResult | null>(null)
  const step = result ? 2 : person ? 1 : 0

  const preselect = params.get('person')
  useEffect(() => {
    if (!preselect) return
    getPerson(Number(preselect))
      .then((p) => {
        if (p.consent_given && p.active) setPerson(p)
      })
      .catch(() => undefined)
      .finally(() => setParams({}, { replace: true }))
  }, [preselect, setParams])

  const restart = () => {
    setPerson(null)
    setResult(null)
  }

  const addMore = async () => {
    if (!person) return
    setPerson(await getPerson(person.id))
    setResult(null)
  }

  return (
    <>
      <PageHeader title="Enroll" description="Register a person's face so Bantay can recognize them at lab entrances." />

      <div className="space-y-6">
        <Section>
          <Stepper steps={STEPS} current={step} />
        </Section>

        <Section
          title={STEPS[step]}
          description={
            step === 0
              ? 'Find someone already registered, or add a new person.'
              : step === 1
                ? 'Capture with camera or upload 3 to 5 clear photos of the face. Each photo must show exactly one face.'
                : undefined
          }
        >
          {step === 0 && <PersonStep onDone={setPerson} />}
          {step === 1 && person && <PhotoStep person={person} onBack={restart} onDone={setResult} />}
          {step === 2 && result && person && (
            <div className="space-y-6">
              <EnrollmentResultView result={result} />
              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-6">
                {!result.meets_minimum && <Button onClick={addMore}>Add more photos</Button>}
                <ButtonLink to={`/users/${person.id}`}>View record</ButtonLink>
                <Button variant="primary" onClick={restart}>
                  Enroll another person
                </Button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </>
  )
}
