"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Message = {
  id: string; content: string; is_read: boolean; created_at: string;
  sender_id: string;
  sender: { full_name: string; avatar_url: string | null } | null;
  venue_id: string | null;
  venue: { name: string } | null;
  package_id: string | null;
  package: { name: string } | null;
};

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [conversationVenueId, setConversationVenueId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      // Get current user id
      const meRes = await fetch("/api/auth/me").catch(() => null);
      // Fallback: read from /api/messages which returns sender info
      await loadMessages();
      setLoading(false);
    }
    init();
    // Poll every 10s
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages() {
    const res = await fetch("/api/messages");
    const json = await res.json();
    if (json.data) {
      setMessages(json.data);
      const latestVenueMessage = [...json.data].reverse().find((message: Message) => message.venue_id);
      setConversationVenueId(latestVenueMessage?.venue_id ?? null);
      // Detect my id and admin id from messages
      if (json.data.length > 0) {
        const first = json.data[0];
        // We'll infer via unread messages being addressed to us
      }
    }
    // Also get admin id
    const adminRes = await fetch("/api/admin/id").catch(() => null);
    if (adminRes?.ok) {
      const a = await adminRes.json();
      setAdminId(a.adminId);
      setMyId(a.myId);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true); setError("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: adminId, content: content.trim(), venueId: conversationVenueId ?? undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); return; }
      setContent("");
      await loadMessages();
    } catch {
      setError("Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] flex flex-col">
      {/* Header */}
      <div className="bg-[#9B2C4A] py-6 px-6 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <Link href="/dashboard" className="text-white/70 text-sm hover:text-white">← Dashboard</Link>
          <h1 className="text-white font-display text-xl font-bold mt-1">Messages</h1>
          <p className="text-white/60 text-xs">Chat with the venue team. Inquiries do not reserve a date or require payment.</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-4 flex flex-col">
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden" style={{ minHeight: 400, maxHeight: 560 }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <span className="text-4xl mb-3">💬</span>
                <p className="text-gray-400 text-sm">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === myId;
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? "bg-[#9B2C4A] text-white rounded-br-sm" : "bg-gray-100 text-[#1a1a1a] rounded-bl-sm"}`}>
                      {!isMe && <p className="text-[10px] font-semibold mb-1 text-[#9B2C4A]">{msg.sender?.full_name ?? "Admin"}</p>}
                      {msg.venue && <p className={`text-[10px] font-semibold mb-1 ${isMe ? "text-white/70" : "text-[#9B2C4A]"}`}>Re: {msg.venue.name}</p>}
                      {msg.package && <p className={`text-[10px] font-semibold mb-1 ${isMe ? "text-white/70" : "text-[#9B2C4A]"}`}>Package: {msg.package.name}</p>}
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-gray-400"}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-4">
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Type a message…"
                disabled={!adminId}
                className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent placeholder-gray-400"
              />
              <button type="submit" disabled={sending || !content.trim() || !adminId}
                className="px-5 py-2.5 rounded-full bg-[#9B2C4A] hover:bg-[#7A1F38] text-white text-sm font-semibold disabled:opacity-50 transition-colors flex-shrink-0">
                {sending ? "…" : "Send"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
