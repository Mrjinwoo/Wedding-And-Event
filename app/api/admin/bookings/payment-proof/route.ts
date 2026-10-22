import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaffAal2 } from '@/lib/supabase/requireUser'

export async function GET(req: NextRequest) {
  const auth = await requireStaffAal2(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const bookingId = new URL(req.url).searchParams.get('bookingId')
  if (!bookingId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
    return NextResponse.json({ error: 'A valid booking is required.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: booking, error } = await supabase.from('bookings')
    .select('payment_proof_path').eq('id', bookingId).single()
  if (error || !booking?.payment_proof_path) return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 })

  const { data, error: signError } = await supabase.storage.from('booking-payment-proofs')
    .createSignedUrl(booking.payment_proof_path, 120)
  if (signError || !data?.signedUrl) return NextResponse.json({ error: 'Could not open the receipt.' }, { status: 500 })
  return NextResponse.json({ signedUrl: data.signedUrl })
}
