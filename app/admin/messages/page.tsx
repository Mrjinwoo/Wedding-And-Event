'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

interface Profile { id: string; full_name: string }
interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  is_read: boolean
  venue_id: string | null
  venue: { name: string } | null
  package_id: string | null
  package: { name: string } | null
  sender: { full_name: string } | null
  receiver: { full_name: string } | null
}
interface InquiryAlert { id: string; title: string; body: string; link: string; is_read: boolean }

export default function AdminMessagesPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [adminId, setAdminId] = useState<string | null>(null)
  const [conversationVenue, setConversationVenue] = useState<{ id: string; name: string } | null>(null)
  const [conversationPackage, setConversationPackage] = useState<{ id: string; name: string } | null>(null)
  const [inquiryAlerts, setInquiryAlerts] = useState<InquiryAlert[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load contacts available to staff/admin and honor a queue deep link.
  useEffect(() => {
    const requestedUserId = new URLSearchParams(window.location.search).get('userId')
    fetch('/api/admin/conversation-users')
      .then(r => r.json())
      .then(d => {
        const rows: Profile[] = d.data ?? []
        setUsers(rows)
        if (requestedUserId) setSelectedUser(rows.find(user => user.id === requestedUserId) ?? { id: requestedUserId, full_name: 'Customer' })
      })
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => setInquiryAlerts((d.data ?? []).filter((notification: InquiryAlert) => notification.title.startsWith('Venue inquiry:') || notification.title.startsWith('Package inquiry:'))))
  }, [])

  // Get admin id
  useEffect(() => {
    fetch('/api/admin/id').then(r => r.json()).then(d => setAdminId(d.myId))
  }, [])

  // Load messages for selected user
  useEffect(() => {
    if (!selectedUser) return
    fetch(`/api/messages?with=${selectedUser.id}`)
      .then(r => r.json())
      .then(d => {
        const rows: Message[] = d.data ?? []
        setMessages(rows)
        const matchingMessage = rows.find(message => message.sender_id === selectedUser.id || message.receiver_id === selectedUser.id)
        const customerName = matchingMessage?.sender_id === selectedUser.id
          ? matchingMessage.sender?.full_name
          : matchingMessage?.receiver?.full_name
        if (customerName && customerName !== selectedUser.full_name) {
          setSelectedUser(current => current?.id === selectedUser.id ? { ...current, full_name: customerName } : current)
        }
        const latestVenueMessage = [...rows].reverse().find(message => message.venue_id && message.venue)
        setConversationVenue(latestVenueMessage?.venue_id && latestVenueMessage.venue
          ? { id: latestVenueMessage.venue_id, name: latestVenueMessage.venue.name }
          : null)
        const latestPackageMessage = [...rows].reverse().find(message => message.package_id && message.package)
        setConversationPackage(latestPackageMessage?.package_id && latestPackageMessage.package
          ? { id: latestPackageMessage.package_id, name: latestPackageMessage.package.name }
          : null)
      })
  }, [selectedUser])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || !selectedUser) return
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: selectedUser.id, content: input.trim(), venueId: conversationVenue?.id }),
    })
    setInput('')
    // Refresh messages
    fetch(`/api/messages?with=${selectedUser.id}`)
      .then(r => r.json())
      .then(d => setMessages(d.data ?? []))
  }

  function prepareBookingInvitation() {
    const bookingPath = conversationVenue
      ? `/venue/${conversationVenue.id}/book${conversationPackage ? `?packageId=${conversationPackage.id}` : ''}`
      : conversationPackage ? `/venue?packageId=${conversationPackage.id}` : null
    if (!bookingPath) return
    const subject = [conversationPackage?.name, conversationVenue?.name].filter(Boolean).join(' at ')
    const bookingUrl = `${window.location.origin}${bookingPath}`
    setInput(`Thanks for your inquiry${subject ? ` about ${subject}` : ''}. You can continue to a booking request here: ${bookingUrl}. The date is not held until the venue approves the request.`)
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] flex flex-col">
      {/* Header */}
      <div className="bg-[#1a1a1a] py-6 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-display text-2xl font-bold">Admin Panel</h1>
            <p className="text-white/50 text-xs mt-0.5">Messages</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-white/70 hover:text-white text-sm transition-colors">Dashboard</Link>
            <Link href="/admin/users" className="text-white/70 hover:text-white text-sm transition-colors">Users</Link>
            <Link href="/admin/bookings" className="text-white/70 hover:text-white text-sm transition-colors">Bookings</Link>
            <Link href="/admin/venues" className="text-white/70 hover:text-white text-sm transition-colors">Venues</Link>
            <LogoutButton className="text-sm font-semibold px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50" />
          </div>
        </div>
      </div>

      {inquiryAlerts.length > 0 && (
        <section className="mx-auto mt-6 w-full max-w-7xl px-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-sm font-semibold text-amber-900">New inquiries</p>
            <div className="space-y-2">
              {inquiryAlerts.map(alert => (
                <Link key={alert.id} href={alert.link} className="block text-sm text-amber-900 hover:underline">
                  <span className="font-medium">{alert.title}</span> · {alert.body}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex gap-6 flex-1">
        {/* User list */}
        <div className="w-64 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-shrink-0 h-fit">
          <p className="px-4 py-3 text-xs font-semibold text-gray-500 border-b border-gray-100 uppercase tracking-wide">Users</p>
          {users.length === 0 && <p className="px-4 py-6 text-sm text-gray-400 text-center">No users found.</p>}
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className={`w-full text-left px-4 py-3 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedUser?.id === u.id ? 'bg-[#9B2C4A]/10 font-semibold text-[#9B2C4A]' : 'text-[#1a1a1a]'}`}
            >
              {u.full_name}
            </button>
          ))}
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden" style={{ minHeight: 500 }}>
          {!selectedUser ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a user to view messages</div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="font-semibold text-[#1a1a1a]">{selectedUser.full_name}</p>
                {(conversationVenue || conversationPackage) && (
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">{[conversationVenue?.name, conversationPackage?.name].filter(Boolean).join(' · ')}</p>
                    <button onClick={prepareBookingInvitation} className="text-xs font-semibold text-[#9B2C4A] hover:underline">Invite to book</button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {messages.length === 0 && <p className="text-center text-gray-400 text-sm">No messages yet.</p>}
                {messages.map(m => {
                  const isAdmin = m.sender_id === adminId
                  return (
                    <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${isAdmin ? 'bg-[#9B2C4A] text-white' : 'bg-gray-100 text-[#1a1a1a]'}`}>
                        {m.venue && <p className={`mb-1 text-[10px] font-semibold ${isAdmin ? 'text-white/70' : 'text-[#9B2C4A]'}`}>Re: {m.venue.name}</p>}
                        {m.package && <p className={`mb-1 text-[10px] font-semibold ${isAdmin ? 'text-white/70' : 'text-[#9B2C4A]'}`}>Package: {m.package.name}</p>}
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={`text-xs mt-1 ${isAdmin ? 'text-white/60' : 'text-gray-400'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]/30"
                />
                <button
                  onClick={sendMessage}
                  className="bg-[#9B2C4A] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#7a2239] transition-colors"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
