import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { messageSchema } from '@/lib/validation'
import { requireUser } from '@/lib/supabase/requireUser'

// GET /api/messages
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const withUserId = searchParams.get('with')
  const isStaff = auth.profile.role === 'admin' || auth.profile.role === 'staff'

  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(full_name),
      receiver:profiles!messages_receiver_id_fkey(full_name),
      venue:venues!messages_venue_id_fkey(name),
      package:packages!messages_package_id_fkey(name)
    `)
    .order('created_at', { ascending: true })

  if (isStaff && withUserId) {
    const { data: staffProfiles } = await supabase.from('profiles').select('id').in('role', ['admin', 'staff'])
    const staffIds = (staffProfiles ?? []).map(profile => profile.id)
    if (staffIds.length === 0) return NextResponse.json({ data: [] })
    const staffIdList = `(${staffIds.join(',')})`
    query = query.or(
      `and(sender_id.eq.${withUserId},receiver_id.in.${staffIdList}),and(receiver_id.eq.${withUserId},sender_id.in.${staffIdList})`
    )
  } else {
    query = query.or(`sender_id.eq.${auth.user.id},receiver_id.eq.${auth.user.id}`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[messages] Failed to load messages:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('messages').update({ is_read: true })
    .eq('receiver_id', auth.user.id).eq('is_read', false)

  return NextResponse.json({ data })
}

// POST /api/messages
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const body = await req.json()
  const parsed = messageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { receiverId, content, bookingId, venueId, packageId } = parsed.data
  if (venueId) {
    const { data: venue } = await supabase.from('venues').select('id, name').eq('id', venueId).eq('is_active', true).eq('review_status', 'approved').single()
    if (!venue) return NextResponse.json({ error: 'Venue not found.' }, { status: 404 })
  }

  if (packageId) {
    const { data: selectedPackage } = await supabase.from('packages').select('id, name').eq('id', packageId).single()
    if (!selectedPackage) return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
  }

  const { data, error } = await supabase.from('messages').insert({
    sender_id:   auth.user.id,
    receiver_id: receiverId,
    content,
    booking_id:  bookingId ?? null,
    venue_id: venueId ?? null,
    package_id: packageId ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: notificationError } = await supabase.rpc('notify_message_recipient', { p_message_id: data.id })
  if (notificationError) console.error('[messages] Failed to notify recipient:', notificationError.message)

  return NextResponse.json({ data }, { status: 201 })
}
