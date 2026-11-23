/** What makes a good enrollment photo — the same conditions the documentation lists as accuracy limits. */
export function PhotoTips() {
  return (
    <div className="rounded-md border border-gray-200 p-4 text-sm space-y-3">
      <div>
        <p className="font-medium text-gray-900">For the best recognition</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li>One person per photo, face clearly inside the oval.</li>
          <li>Good, even lighting — no strong shadow or backlight.</li>
          <li>No mask, cap or sunglasses.</li>
          <li>Center facing first, then turn slightly left and right (~15°).</li>
        </ul>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="font-medium text-cyan-950 flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-cyan-500" />
          <span>Screen Flash Liveness</span>
        </p>
        <p className="mt-1 text-xs text-gray-600 leading-relaxed">
          The camera flashes colors during capture to verify natural skin reflection, matching banking-grade KYC anti-spoofing standards.
        </p>
      </div>
    </div>
  )
}
