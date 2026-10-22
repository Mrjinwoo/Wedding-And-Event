// Keep the Supabase SSR cookie usable by the browser Supabase client. The
// separate `lv` auth marker is HttpOnly; these session cookies cannot be
// HttpOnly while browser auth operations are used by the app.
export const SUPABASE_COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}
