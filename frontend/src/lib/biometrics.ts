export interface BiometricPoseStep {
  id: string
  title: string
  instruction: string
  subtext: string
  angleIcon: string
  photosToCapture: number
}

export const BIOMETRIC_STEPS: BiometricPoseStep[] = [
  {
    id: 'front',
    title: '1. Front Center',
    instruction: 'Look straight at the camera',
    subtext: 'Align your face inside the oval frame with a neutral expression.',
    angleIcon: '😐',
    photosToCapture: 2,
  },
  {
    id: 'turn_left',
    title: '2. Turn Head Left',
    instruction: 'Slowly turn your head to the left',
    subtext: 'Rotate about 15°–25° to capture your left profile contours.',
    angleIcon: '⬅️',
    photosToCapture: 2,
  },
  {
    id: 'turn_right',
    title: '3. Turn Head Right',
    instruction: 'Now slowly turn your head to the right',
    subtext: 'Rotate about 15°–25° to capture your right profile contours.',
    angleIcon: '➡️',
    photosToCapture: 2,
  },
  {
    id: 'tilt_up',
    title: '4. Tilt Up',
    instruction: 'Tilt your chin slightly upward',
    subtext: 'Helps recognize you when looking down at entrance kiosks.',
    angleIcon: '⬆️',
    photosToCapture: 1,
  },
  {
    id: 'tilt_down',
    title: '5. Tilt Down',
    instruction: 'Tilt your head slightly downward',
    subtext: 'Helps recognize you from overhead CCTV entrance angles.',
    angleIcon: '⬇️',
    photosToCapture: 1,
  },
  {
    id: 'smile',
    title: '6. Natural Expression',
    instruction: 'Look straight and give a gentle smile',
    subtext: 'Captures expression variation and confirms facial liveness.',
    angleIcon: '😊',
    photosToCapture: 2,
  },
]

export const TOTAL_BIOMETRIC_TARGET = BIOMETRIC_STEPS.reduce((acc, s) => acc + s.photosToCapture, 0)
