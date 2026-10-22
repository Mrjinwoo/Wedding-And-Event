import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/requireUser'
import { inquirySchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const parsed = inquirySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const supabase = await createClient()
  let venue: { id: string; name: string; is_active: boolean; review_status: string } | null = null
  let selectedPackage: { id: string; name: string; is_active: boolean } | null = null
  if (parsed.data.venueId) {
    const { data } = await supabase.from('venues').select('id, name, is_active, review_status').eq('id', parsed.data.venueId).single()
    venue = data
    if (!venue?.is_active || venue.review_status !== 'approved') return NextResponse.json({ error: 'This venue is no longer available.' }, { status: 404 })
  }
  if (parsed.data.packageId) {
    const { data } = await supabase.from('packages').select('id, name, is_active').eq('id', parsed.data.packageId).single()
    selectedPackage = data
    if (!selectedPackage?.is_active) return NextResponse.json({ error: 'This package is no longer available.' }, { status: 404 })
  }

  const { data: adminId, error: adminLookupError } = await supabase.rpc('get_venue_admin_id')
  if (adminLookupError || !adminId) {
    return NextResponse.json({ error: 'The venue team cannot receive inquiries right now. Please try again later.' }, { status: 503 })
  }

  const { name, email, phone, eventType, eventDate, guests, message } = parsed.data
  const content = [
    venue ? `Venue inquiry: ${venue.name}` : null,
    selectedPackage ? `Package inquiry: ${selectedPackage.name}` : null,
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || 'Not provided'}`,
    `Event: ${eventType}`,
    `Date: ${eventDate || 'Flexible'}`,
    `Expected guests: ${guests || 'Not specified'}`,
    '',
    'Message:',
    message,
  ].filter(line => line !== null).join('\n')

  const { data: inquiry, error } = await supabase.from('messages').insert({
    sender_id: auth.user.id,
    receiver_id: adminId,
    venue_id: venue?.id ?? null,
    package_id: selectedPackage?.id ?? null,
    content,
    booking_id: null,
  }).select('id').single()

  if (error) return NextResponse.json({ error: 'Could not send your inquiry. Please try again.' }, { status: 500 })

  const { error: notificationError } = await supabase.rpc('notify_message_recipient', { p_message_id: inquiry.id })
  if (notificationError) console.error('[inquiries] Failed to notify venue admin:', notificationError.message)

  await logActivity({
    userId: auth.user.id,
    action: 'SEND_VENUE_INQUIRY',
    entity: 'messages',
    entityId: inquiry.id,
    details: { venueId: venue?.id ?? null, venueName: venue?.name ?? null, packageId: selectedPackage?.id ?? null, packageName: selectedPackage?.name ?? null },
  })

  return NextResponse.json({ message: 'Inquiry sent', id: inquiry.id }, { status: 201 })
}
