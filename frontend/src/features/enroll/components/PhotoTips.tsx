/** What makes a good enrollment photo — the same conditions the documentation lists as accuracy limits. */
export function PhotoTips() {
  return (
    <div className="space-y-4 rounded-2xl bg-navy-900 p-5 text-sm text-navy-100">
      <div>
        <p className="font-display font-semibold text-cream">For the best recognition</p>
        <ul className="mt-3 space-y-2 text-navy-100 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:top-2 [&>li]:before:left-0 [&>li]:before:size-1.5 [&>li]:before:rounded-full [&>li]:before:bg-marigold-400">
          <li>One person per photo, face clearly inside the oval.</li>
          <li>Good, even lighting — no strong shadow or backlight.</li>
          <li>No mask, cap or sunglasses.</li>
          <li>Center facing first, then follow the prompts left, right, up and down.</li>
        </ul>
      </div>

      <div className="border-t border-white/10 pt-4">
        <p className="flex items-center gap-1.5 font-medium text-cream">
          <span className="size-2 rounded-full bg-marigold-400" />
          <span>Screen Flash Liveness</span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-navy-200">
          The camera flashes colors during capture to verify natural skin reflection, matching banking-grade KYC anti-spoofing standards.
        </p>
      </div>
    </div>
  )
}
