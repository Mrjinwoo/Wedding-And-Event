import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(3).max(1000),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: venueId } = await params
  if (!z.string().uuid().safeParse(venueId).success) return NextResponse.json({ error: 'Invalid venue.' }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to post a review.' }, { status: 401 })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Choose a rating and write a review of 3 to 1000 characters.' }, { status: 400 })
  const { error } = await supabase.from('venue_reviews').insert({ venue_id: venueId, user_id: user.id, ...parsed.data })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'You have already reviewed this venue.' }, { status: 409 })
    if (error.code === '42501') return NextResponse.json({ error: 'Only customers with a past confirmed booking can review this venue.' }, { status: 403 })
    return NextResponse.json({ error: 'Could not submit your review.' }, { status: 400 })
  }
  return NextResponse.json({ success: true }, { status: 201 })
}
