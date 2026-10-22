"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type PackageOption = {
  id: string
  name: string
  price: number
  guest_capacity: number | null
  features: string[]
}

export default function BookingForm({
  venueId,
  capacity,
  venuePrice,
  packages,
  initialPackageId,
}: {
  venueId: string
  capacity: number
  venuePrice: number
  packages: PackageOption[]
  initialPackageId: string
}) {
  const router = useRouter()
  const [eventType, setEventType] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [packageId, setPackageId] = useState(initialPackageId)
  const [visibleMonth, setVisibleMonth] = useState(() => new Date())
  const [unavailableDates, setUnavailableDates] = useState<string[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(true)
  const [availabilityError, setAvailabilityError] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedPackage = packages.find(pkg => pkg.id === packageId)
  const guestLimit = Math.min(capacity, selectedPackage?.guest_capacity ?? capacity, 1000)
  const displayedPrice = selectedPackage ? Number(selectedPackage.price) : venuePrice
  const today = new Date()
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const maxDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
  const maxDateValue = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  useEffect(() => {
    let active = true
    async function loadAvailability() {
      setAvailabilityLoading(true)
      setAvailabilityError('')
      const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      try {
        const response = await fetch(`/api/venues/${venueId}/availability?start=${monthStart}&end=${monthEnd}`)
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Could not check availability.')
        if (active) setUnavailableDates(result.unavailableDates ?? [])
      } catch {
        if (active) setAvailabilityError('Availability could not load. The venue will recheck your date when you submit.')
      } finally {
        if (active) setAvailabilityLoading(false)
      }
    }
    loadAvailability()
    return () => { active = false }
  }, [venueId, year, month, daysInMonth])

  function dateValue(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!eventDate) {
      setError('Choose an event date from the calendar.')
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId, packageId: packageId || undefined, eventType, eventDate, guestCount: Number(guestCount), notes }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error ?? 'We could not submit your booking. Please try again.')
        return
      }
      router.push('/dashboard/bookings')
      router.refresh()
    } catch {
      setError('A network error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="block text-sm font-medium text-gray-700">
        Package
        <select value={packageId} onChange={e => setPackageId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5">
          <option value="">Venue only — ₱{venuePrice.toLocaleString()}</option>
          {packages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} — ₱{Number(pkg.price).toLocaleString()}</option>)}
        </select>
        <span className="mt-1 block text-xs font-normal text-gray-500">A package price includes the listed event package and venue. Choose venue only to use the venue starting price.</span>
      </label>
      {selectedPackage && (
        <div className="rounded-xl bg-[#FAF7F5] p-4 text-sm text-gray-600">
          <p className="font-semibold text-[#1a1a1a]">{selectedPackage.name} includes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{selectedPackage.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
          {selectedPackage.guest_capacity && <p className="mt-2 text-xs">Package capacity: {selectedPackage.guest_capacity} guests</p>}
        </div>
      )}
      <div className="rounded-xl border border-gray-100 px-4 py-3">
        <p className="text-xs text-gray-500">Request total</p>
        <p className="font-display text-2xl font-bold text-[#1a1a1a]">₱{displayedPrice.toLocaleString()}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-gray-700">
          Event type
          <select required value={eventType} onChange={e => setEventType(e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5">
            <option value="">Select an event</option>
            <option>Wedding</option><option>Birthday</option><option>Debut</option><option>Corporate event</option><option>Other</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Number of guests
          <input required type="number" min={1} max={guestLimit} value={guestCount} onChange={e => setGuestCount(e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5" />
          <span className="mt-1 block text-xs font-normal text-gray-500">Maximum capacity for this selection: {guestLimit} guests</span>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">Choose event date</legend>
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setVisibleMonth(new Date(year, month - 1, 1))} disabled={year === today.getFullYear() && month === today.getMonth()} aria-label="Previous month" className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30">‹</button>
            <p className="font-semibold text-[#1a1a1a]">{monthLabel}</p>
            <button type="button" onClick={() => setVisibleMonth(new Date(year, month + 1, 1))} aria-label="Next month" className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day} className="py-1 font-medium text-gray-400">{day}</span>)}
            {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1
              const value = dateValue(day)
              const unavailable = unavailableDates.includes(value)
              const disabled = value < minDate || value > maxDateValue || unavailable || availabilityLoading
              return (
                <button key={value} type="button" disabled={disabled} onClick={() => setEventDate(value)} aria-pressed={eventDate === value} aria-label={`${value}${unavailable ? ', unavailable' : ''}`} className={`rounded-lg py-2 transition-colors disabled:cursor-not-allowed disabled:text-gray-300 ${unavailable ? 'line-through bg-gray-50' : ''} ${eventDate === value ? 'bg-[#9B2C4A] font-semibold text-white' : disabled ? 'text-gray-300' : 'text-gray-700 hover:bg-[#F5E6EA]'}`}>
                  {day}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded border border-gray-300 bg-white" />Available</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-gray-100 line-through" />Unavailable</span>
            {availabilityLoading && <span>Checking dates…</span>}
          </div>
          {eventDate && <p className="mt-3 text-sm font-medium text-[#9B2C4A]">Selected: {new Date(`${eventDate}T00:00:00`).toLocaleDateString()}</p>}
          {availabilityError && <p className="mt-2 text-xs text-amber-700">{availabilityError}</p>}
        </div>
      </fieldset>
      <label className="block text-sm font-medium text-gray-700">
        Notes (optional)
        <textarea maxLength={500} rows={4} value={notes} onChange={e => setNotes(e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5" placeholder="Share any details or requests for the venue." />
      </label>
      <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#9B2C4A] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#7A1F38] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
        {loading ? 'Submitting…' : 'Submit booking request'}
      </button>
      <p className="text-xs text-gray-500">Your request will be marked pending until the venue confirms it. A pending request does not reserve the date.</p>
    </form>
  )
}
