/** Where to go after logging in. Only pages inside the app, never another site. */
export function safeNext(value: string | null | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'
}
