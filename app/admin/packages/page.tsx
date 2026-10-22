import { redirect } from 'next/navigation'
import { requireUserPage } from '@/lib/supabase/requireUser'
import PackagesManager from './PackagesManager'

export default async function AdminPackagesPage() {
  const result = await requireUserPage({ roles: ['admin'], requireAal2: true })
  if ('redirect' in result) redirect(result.redirect)
  return <PackagesManager />
}
