import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/requireUser'
import { attachUserProfiles } from '@/lib/bookings'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const page  = parseInt(searchParams.get('page')  ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const from  = (page - 1) * limit

  const isAdmin = auth.profile.role === 'admin'

  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .range(from, from + limit - 1)
    .order('created_at', { ascending: false })

  if (!isAdmin) query = query.eq('user_id', auth.user.id)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const dataWithProfiles = await attachUserProfiles(supabase, data)
  return NextResponse.json({ data: dataWithProfiles, total: count, page, limit })
}
