import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/requireUser'

// Returns the admin user ID so staff/clients can address messages to admin.
// Authenticated clients, staff, and admins use this to address the venue team.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { data: adminId } = await supabase.rpc('get_venue_admin_id')

  return NextResponse.json({ adminId: adminId ?? null, myId: auth.user.id })
}
