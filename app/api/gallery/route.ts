import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireStaffAal2 } from '@/lib/supabase/requireUser'

const imageInput = z.object({
  title: z.string().trim().min(2).max(120),
  category: z.enum(['wedding', 'reception', 'birthday', 'corporate', 'venue']),
  caption: z.string().trim().max(300).default(''),
  image_url: z.string().url().or(z.string().startsWith('/')),
  storage_path: z.string().min(1).nullable().default(null),
  sort_order: z.number().int().min(0).max(10000).default(0),
  is_active: z.boolean().default(true),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const management = new URL(req.url).searchParams.get('management') === '1'

  if (management) {
    const auth = await requireStaffAal2(req)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let query = supabase.from('gallery_images').select('*').order('sort_order').order('created_at', { ascending: false })
  if (!management) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) {
    console.error('[gallery] Could not load gallery:', error.code, error.message)
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return NextResponse.json({ error: 'The gallery database table is missing. Apply supabase/migrations/202610230015_gallery_management.sql in the Supabase SQL Editor.' }, { status: 500 })
    }
    if (error.code === '42501') {
      return NextResponse.json({ error: 'Supabase denied access to the gallery table. Reapply the gallery migration so its grants and RLS policies are installed.' }, { status: 500 })
    }
    return NextResponse.json({ error: management ? `Could not load gallery: ${error.message}` : 'Could not load gallery right now.' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffAal2(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const parsed = imageInput.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  if (!parsed.data.storage_path) return NextResponse.json({ error: 'Upload a photo before saving.' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase.from('gallery_images')
    .insert({ ...parsed.data, created_by: auth.user.id })
    .select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffAal2(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const parsed = z.object({ id: z.string().uuid() }).and(imageInput).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { id, ...updates } = parsed.data
  const supabase = await createClient()
  const { data: previous } = await supabase.from('gallery_images').select('storage_path').eq('id', id).maybeSingle()
  const { data, error } = await supabase.from('gallery_images')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Gallery photo not found.' }, { status: 404 })
  if (previous?.storage_path && previous.storage_path !== data.storage_path) {
    const { error: storageError } = await supabase.storage.from('gallery').remove([previous.storage_path])
    if (storageError) console.error('[gallery] Updated photo but old storage cleanup failed:', storageError.message)
  }
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireStaffAal2(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Photo id is required.' }, { status: 400 })
  const supabase = await createClient()
  const { data: photo, error: findError } = await supabase.from('gallery_images')
    .select('id, storage_path').eq('id', id).maybeSingle()
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
  if (!photo) return NextResponse.json({ error: 'Gallery photo not found.' }, { status: 404 })

  const { error } = await supabase.from('gallery_images').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (photo.storage_path) {
    const { error: storageError } = await supabase.storage.from('gallery').remove([photo.storage_path])
    if (storageError) console.error('[gallery] Photo row deleted but storage cleanup failed:', storageError.message)
  }
  return NextResponse.json({ message: 'Photo removed from the gallery.' })
}
