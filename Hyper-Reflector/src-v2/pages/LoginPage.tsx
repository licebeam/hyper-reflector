import { useState } from 'react'
import { loginEmail } from '../../src/utils/firebase'
import type { FirebaseError } from 'firebase/app'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      await loginEmail(email.trim(), password)
      // onAuthStateChanged in AppV2 handles state transition
    } catch (err) {
      const fe = err as FirebaseError
      const isCredentialError = [
        'auth/invalid-credential',
        'auth/wrong-password',
        'auth/user-not-found',
        'auth/invalid-email',
      ].includes(fe.code)
      setError(isCredentialError ? 'Incorrect email or password.' : 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSubmit(e as any)
  }

  return (
    <div className="h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 w-80 shadow-xl">
        <h1 className="text-orange-500 text-xl font-bold mb-1">Hyper Reflector</h1>
        <p className="text-gray-400 text-sm mb-6">Sign in to join the lobby</p>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium">Email</label>
            <input
              autoFocus
              type="email"
              value={email}
              maxLength={100}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="hyper@reflector.com"
              disabled={loading}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                maxLength={160}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
                disabled={loading}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-16 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors disabled:opacity-50"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPass(p => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300 transition-colors px-1"
              >
                {showPass ? 'hide' : 'show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="mt-1 bg-orange-500 text-white rounded py-2 font-medium text-sm hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-gray-700">
          <button
            className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
            onClick={() => { localStorage.setItem('appVersion', 'v1'); window.location.reload() }}
          >
            Switch to V1
          </button>
        </div>
      </div>
    </div>
  )
}
