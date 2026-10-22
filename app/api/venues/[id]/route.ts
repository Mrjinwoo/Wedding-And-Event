import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/venues/[id] — public, no auth required
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .eq('review_status', 'approved')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
  }

  return NextResponse.json({ data })
}
