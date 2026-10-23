import Link from 'next/link'

const CATEGORIES = [
  { value: 'all', label: 'All venues' },
  { value: 'wedding', label: 'Weddings' },
  { value: 'reception', label: 'Receptions' },
  { value: 'birthday', label: 'Birthdays' },
  { value: 'corporate', label: 'Corporate' },
] as const

export default function VenueCategoryPills({
  selected,
  packageId,
}: {
  selected: string
  packageId: string
}) {
  return (
    <nav className="mb-8 flex flex-wrap justify-center gap-2" aria-label="Filter venues by event type">
      {CATEGORIES.map(category => {
        const params = new URLSearchParams()
        if (category.value !== 'all') params.set('category', category.value)
        if (packageId) params.set('packageId', packageId)
        const query = params.toString()
        const href = query ? `/venue?${query}` : '/venue'
        const active = selected === category.value
        return (
          <Link
            key={category.value}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${active ? 'bg-[#9B2C4A] text-white' : 'border border-[#eadde0] bg-white text-[#55464a] hover:border-[#9B2C4A] hover:text-[#9B2C4A]'}`}
          >
            {category.label}
          </Link>
        )
      })}
    </nav>
  )
}
