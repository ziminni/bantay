/** What makes a good enrollment photo — the same conditions the documentation lists as accuracy limits. */
export function PhotoTips() {
  return (
    <div className="rounded-md border border-gray-200 p-4 text-sm">
      <p className="font-medium text-gray-900">For the best recognition</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
        <li>One person per photo, face clearly visible.</li>
        <li>Good, even lighting — no strong shadow or backlight.</li>
        <li>No mask, cap or sunglasses.</li>
        <li>Face the camera, then turn slightly left and right in other photos.</li>
      </ul>
    </div>
  )
}
