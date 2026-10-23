import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/requireUser'

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_my_message_conversations')
  if (error) {
    console.error('[admin/conversation-users] Failed to load conversations:', error.message)
    return NextResponse.json({ error: 'Could not load conversations.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
