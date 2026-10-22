import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/requireUser'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let bookingId: unknown
  try { bookingId = (await req.json()).bookingId } catch {
    return NextResponse.json({ error: 'A valid booking is required.' }, { status: 400 })
  }
  if (typeof bookingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
    return NextResponse.json({ error: 'A valid booking is required.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('resend_own_booking_notification', { p_booking_id: bookingId })
  if (error) {
    const rateLimited = error.message.includes('Please wait')
    return NextResponse.json({ error: rateLimited ? error.message : 'Could not resend the update. Please try again later.' }, { status: rateLimited ? 429 : 400 })
  }
  return NextResponse.json({ message: 'Booking update added to your notifications.' })
}
