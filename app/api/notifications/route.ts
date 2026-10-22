import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/requireUser'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  let notificationId: string | null = null
  try {
    const body = await req.json()
    if (typeof body?.notificationId === 'string') notificationId = body.notificationId
  } catch {
    // An empty body keeps the existing mark-all behavior for older callers.
  }

  let query = supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', auth.user.id)
    .eq('is_read', false)
  if (notificationId) query = query.eq('id', notificationId)

  const { error } = await query
  if (error) return NextResponse.json({ error: 'Could not update notification.' }, { status: 500 })

  return NextResponse.json({ message: notificationId ? 'Notification marked as read' : 'All notifications marked as read' })
}
