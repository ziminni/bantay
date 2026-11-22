import { useState } from 'react'
import type { DetectedFaceRead } from '@/api/types'

/** The uploaded image with a numbered box around each detected face. */
export function ImageWithBoxes({ src, faces }: { src: string; faces: DetectedFaceRead[] }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  return (
    <div className="flex justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-100">
      {/* The boxes are placed relative to this wrapper, which is exactly the size of the image. */}
      <div className="relative">
      <img
        src={src}
        alt="Uploaded test"
        className="block max-h-[28rem] w-auto max-w-full"
        onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
      />
      {size &&
        faces.map((f, i) => {
          const [x1, y1, x2, y2] = f.bbox
          return (
            <div
              key={i}
              className="absolute border-2 border-white outline-2 outline-gray-900"
              style={{
                left: `${(x1 / size.w) * 100}%`,
                top: `${(y1 / size.h) * 100}%`,
                width: `${((x2 - x1) / size.w) * 100}%`,
                height: `${((y2 - y1) / size.h) * 100}%`,
              }}
            >
              <span className="absolute -top-6 left-0 rounded bg-gray-900 px-1.5 py-0.5 text-xs font-medium text-white">
                {i + 1}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
