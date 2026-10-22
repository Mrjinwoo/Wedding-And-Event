import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { venueSchema } from '@/lib/validation'
import { logActivity, logAudit } from '@/lib/activity'
import { requireStaffAal2, requireAdmin } from '@/lib/supabase/requireUser'

// Permission matrix:
//   GET    — public (no auth required)
//   POST   — staff + admin, AAL2
//   PATCH  — staff + admin, AAL2
//   DELETE — admin only,    AAL2  (soft-delete via is_active=false)

export async function GET(req: NextRequest) {
  // Public — no auth required
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const management = searchParams.get('management') === '1'
  const search   = searchParams.get('search')   ?? ''
  const minPrice = searchParams.get('minPrice')
  const maxPrice = searchParams.get('maxPrice')
  const page     = parseInt(searchParams.get('page')  ?? '1')
  const limit    = parseInt(searchParams.get('limit') ?? '12')
  const from     = (page - 1) * limit

  if (management) {
    const auth = await requireStaffAal2(req)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    let managementQuery = supabase.from('venues').select('*', { count: 'exact' })
      .range(from, from + Math.min(limit, 1000) - 1).order('created_at', { ascending: false })
    if (search) managementQuery = managementQuery.ilike('name', `%${search}%`)
    const { data, error, count } = await managementQuery
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, total: count, page, limit, canReview: auth.profile.role === 'admin' })
  }

  let query = supabase.from('venues').select('*', { count: 'exact' })
    .eq('is_active', true).eq('review_status', 'approved')
    .range(from, from + limit - 1).order('created_at', { ascending: false })

  if (search)   query = query.ilike('name', `%${search}%`)
  if (minPrice) query = query.gte('price', minPrice)
  if (maxPrice) query = query.lte('price', maxPrice)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, total: count, page, limit })
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffAal2(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const body   = await req.json()
  const parsed = venueSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, description, location, capacity, price, imageUrl, isActive } = parsed.data
  const isAdmin = auth.profile.role === 'admin'
  const { data, error } = await supabase.from('venues').insert({
    name, description, location, capacity, price,
    image_url: imageUrl,
    is_active: isAdmin ? isActive : false,
    review_status: isAdmin && isActive ? 'approved' : 'pending_review',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await Promise.all([
    logActivity({ userId: auth.user.id, action: isAdmin && isActive ? 'CREATE_VENUE' : 'CREATE_VENUE_DRAFT', entity: 'venues', entityId: data.id }),
    logAudit({ performedBy: auth.user.id, action: 'CREATE_VENUE', targetTable: 'venues', targetId: data.id, newData: parsed.data as unknown as Record<string, unknown> }),
  ])
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffAal2(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { id, imageUrl, isActive, reviewStatus } = body
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const isAdmin = auth.profile.role === 'admin'
  if (!isAdmin && (isActive !== undefined || reviewStatus !== undefined || 'is_active' in body || 'review_status' in body)) {
    return NextResponse.json({ error: 'Only an admin can publish, reject, or deactivate a venue.' }, { status: 403 })
  }
  if (reviewStatus !== undefined && !isAdmin) {
    return NextResponse.json({ error: 'Only an admin can review venues.' }, { status: 403 })
  }
  if (reviewStatus !== undefined && (typeof reviewStatus !== 'string' || !['approved', 'rejected'].includes(reviewStatus))) {
    return NextResponse.json({ error: 'Select a valid review action.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (reviewStatus !== undefined) {
    if (reviewStatus === 'approved') {
      updates.review_status = 'approved'
      updates.is_active = true
    } else {
      updates.review_status = 'rejected'
      updates.is_active = false
    }
  } else {
    const parsed = venueSchema.safeParse({
      name: body.name,
      description: body.description,
      location: body.location,
      capacity: body.capacity,
      price: body.price,
      imageUrl,
      isActive: isAdmin ? isActive : false,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { name, description, location, capacity, price, imageUrl: validatedImage, isActive: validatedActive } = parsed.data
    Object.assign(updates, {
      name, description, location, capacity, price,
      image_url: validatedImage,
      ...(isAdmin ? { is_active: validatedActive } : { is_active: false, review_status: 'pending_review' }),
    })
  }

  const { error } = await supabase
    .from('venues')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await Promise.all([
    logActivity({
      userId: auth.user.id,
      action: reviewStatus === 'approved' ? 'APPROVE_VENUE' : reviewStatus === 'rejected' ? 'REJECT_VENUE' : 'UPDATE_VENUE',
      entity: 'venues', entityId: id,
    }),
    logAudit({ performedBy: auth.user.id, action: 'UPDATE_VENUE', targetTable: 'venues', targetId: String(id), newData: updates }),
  ])
  return NextResponse.json({ message: 'Venue updated' })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('venues').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await Promise.all([
    logActivity({ userId: auth.user.id, action: 'DELETE_VENUE', entity: 'venues', entityId: id }),
    logAudit({ performedBy: auth.user.id, action: 'DEACTIVATE_VENUE', targetTable: 'venues', targetId: id }),
  ])
  return NextResponse.json({ message: 'Venue deactivated' })
}
