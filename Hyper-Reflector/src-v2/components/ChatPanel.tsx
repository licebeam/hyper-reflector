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
    const sent = onSend(text)
    if (sent) setInput('')
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
          <p className="text-gray-500 text-sm text-center pt-8">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.role === 'user' && (
              <span>
                <span
                  className={`font-semibold text-sm ${
                    msg.senderUid === currentUserUid
                      ? 'text-orange-400'
                      : 'text-blue-400'
                  }`}
                >
                  {msg.userName}
                </span>
                <span className="text-gray-500 text-xs ml-1.5">
                  {formatTime(msg.timeStamp)}
                </span>
                <span className="text-gray-100 text-sm ml-2">{msg.text}</span>
              </span>
            )}
            {msg.role === 'system' && (
              <span className="text-gray-500 text-xs italic">{msg.text}</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 p-3 flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          maxLength={MAX_LENGTH}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="px-3 py-1.5 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
