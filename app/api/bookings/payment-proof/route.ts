import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/requireUser'

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Choose a payment receipt file.' }, { status: 400 })
  }

  const bookingId = form.get('bookingId')
  const proof = form.get('proof')
  if (typeof bookingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId) || !(proof instanceof File)) {
    return NextResponse.json({ error: 'Choose a valid booking and receipt file.' }, { status: 400 })
  }
  if (!MIME_EXTENSIONS[proof.type] || proof.size < 1 || proof.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Upload a JPG, PNG, WEBP, or PDF file up to 10 MB.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: booking, error: bookingError } = await supabase.from('bookings')
    .select('id').eq('id', bookingId).eq('user_id', auth.user.id)
    .eq('status', 'awaiting_payment').in('payment_proof_status', ['not_submitted', 'rejected']).single()
  if (bookingError || !booking) {
    return NextResponse.json({ error: 'This booking cannot accept a receipt. Refresh your bookings and try again.' }, { status: 409 })
  }

  const path = `${auth.user.id}/${bookingId}/${crypto.randomUUID()}.${MIME_EXTENSIONS[proof.type]}`
  let uploadError: { message: string } | null = null
  try {
    const result = await supabase.storage
      .from('booking-payment-proofs')
      .upload(path, proof, { contentType: proof.type, upsert: false })
    uploadError = result.error
  } catch (error) {
    console.error('[payment-proof] Receipt upload request failed:', error)
    return NextResponse.json({ error: 'The receipt upload failed. Your selected file is still available; please try again.' }, { status: 503 })
  }

  if (uploadError) {
    return NextResponse.json({ error: 'Could not upload the receipt. Please try again.' }, { status: 500 })
  }

  let submitError: { message: string } | null = null
  try {
    const result = await supabase.rpc('submit_booking_payment_proof', {
      p_booking_id: bookingId,
      p_storage_path: path,
    })
    submitError = result.error
  } catch (error) {
    console.error('[payment-proof] Receipt submission request failed:', error)
    submitError = { message: 'Request failed' }
  }

  if (submitError) {
    const { error: cleanupError } = await supabase.storage.from('booking-payment-proofs').remove([path])
    if (cleanupError) console.error('[payment-proof] Failed to clean up an unsubmitted receipt:', cleanupError.message)
    return NextResponse.json({ error: 'The receipt was not submitted. Your selected file is still available; please try again.' }, { status: 400 })
  }

  return NextResponse.json({ message: 'Payment proof submitted for review.' }, { status: 201 })
}
