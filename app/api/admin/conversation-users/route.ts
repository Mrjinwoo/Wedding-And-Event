import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaffAal2 } from '@/lib/supabase/requireUser'

export async function GET(req: NextRequest) {
  const auth = await requireStaffAal2(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { data: messageRows, error: messagesError } = await supabase
    .from('messages')
    .select('sender_id, receiver_id, created_at')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (messagesError) return NextResponse.json({ error: 'Could not load conversations.' }, { status: 500 })

  const lastActivity = new Map<string, string>()
  for (const message of messageRows ?? []) {
    const participantId = message.sender_id === auth.user.id ? message.receiver_id : message.sender_id
    if (participantId !== auth.user.id && !lastActivity.has(participantId)) {
      lastActivity.set(participantId, message.created_at)
    }
  }

  const participantIds = [...lastActivity.keys()]
  if (participantIds.length === 0) return NextResponse.json({ data: [] })

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('id', participantIds)

  if (profilesError) return NextResponse.json({ error: 'Could not load conversation contacts.' }, { status: 500 })

  const data = (profiles ?? [])
    .filter(profile => profile.role !== 'admin' && profile.role !== 'staff')
    .map(profile => ({ id: profile.id, full_name: profile.full_name ?? 'Customer', last_activity: lastActivity.get(profile.id) }))
    .sort((a, b) => (b.last_activity ?? '').localeCompare(a.last_activity ?? ''))

  return NextResponse.json({ data })
}
