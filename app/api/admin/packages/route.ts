import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/requireUser'

const packageInput = z.object({
  name: z.string().trim().min(2, 'Package name must be at least 2 characters.').max(100),
  price: z.number().finite().min(0, 'Price cannot be negative.'),
  guest_capacity: z.number().int().positive().nullable(),
  features: z.array(z.string().trim().min(1).max(160)).max(30),
  is_popular: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(10000),
})

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { data, error } = await supabase.from('packages').select('*').order('sort_order').order('name')
  if (error) return NextResponse.json({ error: 'Could not load packages.' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const parsed = packageInput.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase.from('packages').insert(parsed.data).select('*').single()
  if (error?.code === '23505') return NextResponse.json({ error: 'A package with that name already exists.' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const parsed = z.object({ id: z.string().uuid() }).and(packageInput).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { id, ...updates } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.from('packages').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').maybeSingle()
  if (error?.code === '23505') return NextResponse.json({ error: 'A package with that name already exists.' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
  return NextResponse.json({ data })
}
