'use client'

import { useState } from 'react'

export default function ReviewForm({ venueId }: { venueId: string }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/venues/${venueId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not submit your review.')
      setComment('')
      setMessage('Thank you. Your review has been posted.')
      window.location.reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit your review.')
    } finally {
      setBusy(false)
    }
  }

  return <form onSubmit={submit} className="mt-5 space-y-3">
    <label className="block text-sm font-medium text-gray-700">Your rating
      <select value={rating} onChange={event => setRating(Number(event.target.value))} className="ml-3 rounded-lg border border-gray-300 px-3 py-2">
        {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} {value === 1 ? 'star' : 'stars'}</option>)}
      </select>
    </label>
    <label className="block text-sm font-medium text-gray-700">Your review
      <textarea required minLength={3} maxLength={1000} rows={4} value={comment} onChange={event => setComment(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Tell others about your event at this venue." />
    </label>
    <button disabled={busy} className="rounded-lg bg-[#9B2C4A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Posting…' : 'Post review'}</button>
    {message && <p role="status" className="text-sm text-gray-600">{message}</p>}
  </form>
}
