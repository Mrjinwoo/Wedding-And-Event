# Supabase email templates for server-side auth

The app's `/auth/callback` supports Supabase token-hash verification. Use these
links in Supabase Dashboard → Authentication → Email Templates so invite and
password recovery links work when opened in a different browser from the one
that requested them.

For each template, keep its existing subject and surrounding text, and replace
the confirmation link with the matching URL below. The app sends `RedirectTo`
with a `next` query parameter, so append the token parameters with `&`.

## Invite user

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite">Accept invitation</a>
```

## Reset password

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

After updating the templates, send a fresh invitation or password reset email.
Previously sent links may be expired, already used, or still use the old flow.
