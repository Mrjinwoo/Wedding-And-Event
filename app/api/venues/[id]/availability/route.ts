import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid venue.' }, { status: 400 })
  }

  const startDate = req.nextUrl.searchParams.get('start') ?? ''
  const endDate = req.nextUrl.searchParams.get('end') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json({ error: 'Provide a valid date range.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_venue_unavailable_dates', {
    p_venue_id: id,
    p_start_date: startDate,
    p_end_date: endDate,
  })

  if (error) {
    console.error('[venue availability] Failed to load unavailable dates:', error.message)
    return NextResponse.json({ error: 'Could not load availability.' }, { status: 503 })
  }

  return NextResponse.json({ unavailableDates: (data ?? []).map((row: { event_date: string }) => row.event_date) })
}
