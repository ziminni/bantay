import { useState } from 'react'
import type { DetectedFaceRead } from '@/api/types'
import { formatSimilarity } from '@/lib/format'

/** The uploaded image with a name label and bounding box around each detected face. */
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
            const isNearTop = y1 / size.h < 0.08
            const name = f.match?.full_name ?? 'Unknown'
            const isMatch = f.accepted && f.match

            return (
              <div
                key={i}
                className={
                  isMatch
                    ? 'absolute border-2 border-emerald-400 outline-2 outline-emerald-950 shadow-xs'
                    : 'absolute border-2 border-white outline-2 outline-gray-900 shadow-xs'
                }
                style={{
                  left: `${(x1 / size.w) * 100}%`,
                  top: `${(y1 / size.h) * 100}%`,
                  width: `${((x2 - x1) / size.w) * 100}%`,
                  height: `${((y2 - y1) / size.h) * 100}%`,
                }}
              >
                <span
                  className={`absolute z-10 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold shadow-md ${
                    isNearTop ? 'top-1 left-1' : '-top-6 left-0'
                  } ${
                    isMatch
                      ? 'bg-emerald-600 text-white'
                      : f.match
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-900 text-white'
                  }`}
                  title={f.match ? `${name} (${formatSimilarity(f.match.similarity)})` : name}
                >
                  {name}
                  {f.match && (
                    <span className="ml-1 opacity-80 text-[10px] font-normal">
                      · {Math.round(f.match.similarity * 100)}%
                    </span>
                  )}
                </span>
              </div>
            )
          })}
      </div>
    </div>
  )
}
