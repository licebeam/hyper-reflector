import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import type { V2Message } from '../types'

const MAX_LENGTH = 120

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

type ChatPanelProps = {
  messages: V2Message[]
  currentUserUid?: string
  onSend: (text: string) => boolean
}

export function ChatPanel({ messages, currentUserUid, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    if (onSend(text)) setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
        {messages.length === 0 && (
          <p className="text-sm text-center pt-8" style={{ color: 'var(--v2-muted)' }}>
            No messages yet. Say hello!
          </p>
        )}

        {messages.map(msg => (
          <div key={msg.id}>
            {msg.role === 'user' && (
              <span>
                <span
                  className="font-semibold text-sm"
                  style={{
                    color: msg.senderUid === currentUserUid
                      ? 'var(--v2-name-self)'
                      : 'var(--v2-name-other)',
                  }}
                >
                  {msg.userName}
                </span>
                <span className="text-xs ml-1.5" style={{ color: 'var(--v2-muted)' }}>
                  {formatTime(msg.timeStamp)}
                </span>
                <span className="text-sm ml-2" style={{ color: 'var(--v2-chat-msg)' }}>
                  {msg.text}
                </span>
              </span>
            )}
            {msg.role === 'system' && (
              <span className="text-xs italic" style={{ color: 'var(--v2-muted)' }}>
                {msg.text}
              </span>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="border-t p-3 flex gap-2 shrink-0"
        style={{ borderColor: 'var(--v2-border)' }}
      >
        <input
          type="text"
          value={input}
          maxLength={MAX_LENGTH}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 rounded px-3 py-1.5 text-sm border outline-none transition-colors"
          style={{
            background: 'var(--v2-hover)',
            borderColor: 'var(--v2-border)',
            color: 'var(--v2-text)',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--v2-accent)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--v2-border)')}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="px-3 py-1.5 rounded text-sm flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-accent-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--v2-accent)')}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
