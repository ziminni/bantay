export interface BiometricPoseStep {
  id: 'center' | 'turn_left' | 'turn_right' | 'tilt_up' | 'tilt_down'
  title: string
  instruction: string
  subtext: string
  angleIcon: string
  targetYaw: number // -1 (left) to +1 (right)
  targetPitch: number // -1 (up) to +1 (down)
  photosToCapture: number
}

export const BIOMETRIC_STEPS: BiometricPoseStep[] = [
  {
    id: 'center',
    title: '1. Front Center',
    instruction: 'Look straight at the camera',
    subtext: 'Align your face inside the oval frame and hold still.',
    angleIcon: '🎯',
    targetYaw: 0,
    targetPitch: 0,
    photosToCapture: 2,
  },
  {
    id: 'turn_left',
    title: '2. Turn Head Left',
    instruction: 'Slowly turn your head to the left',
    subtext: 'Rotate about 15°–25° to match the left angle indicator.',
    angleIcon: '⬅️',
    targetYaw: -0.22,
    targetPitch: 0,
    photosToCapture: 2,
  },
  {
    id: 'turn_right',
    title: '3. Turn Head Right',
    instruction: 'Now slowly turn your head to the right',
    subtext: 'Rotate about 15°–25° to match the right angle indicator.',
    angleIcon: '➡️',
    targetYaw: 0.22,
    targetPitch: 0,
    photosToCapture: 2,
  },
  {
    id: 'tilt_up',
    title: '4. Tilt Chin Up',
    instruction: 'Tilt your chin slightly upward',
    subtext: 'Raise your head slightly to capture upward facial perspective.',
    angleIcon: '⬆️',
    targetYaw: 0,
    targetPitch: -0.18,
    photosToCapture: 2,
  },
  {
    id: 'tilt_down',
    title: '5. Tilt Head Down',
    instruction: 'Tilt your head slightly downward',
    subtext: 'Lower your chin slightly to capture downward facial perspective.',
    angleIcon: '⬇️',
    targetYaw: 0,
    targetPitch: 0.18,
    photosToCapture: 2,
  },
]

export const TOTAL_BIOMETRIC_TARGET = BIOMETRIC_STEPS.reduce((acc, s) => acc + s.photosToCapture, 0)
