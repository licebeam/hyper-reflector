import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loginEmail } from '../utils/firebase'
import type { FirebaseError } from 'firebase/app'

type LoginPageProps = {
  onSignup?: () => void
}

export function LoginPage({ onSignup }: LoginPageProps = {}) {
  const { t } = useTranslation()
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
    } catch (err) {
      const fe = err as FirebaseError
      const isBadCred = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(fe.code)
      setError(isBadCred ? t('loginPage.incorrectCredentials') : t('loginPage.signInFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div
        className="rounded-xl p-8 w-80 shadow-xl border"
        style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}
      >
        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--v2-accent)' }}>
          {t('appV2.appName')}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--v2-muted)' }}>
          {t('loginPage.signInSubtitle')}
        </p>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--v2-muted)' }}>
              {t('loginPage.email')}
            </label>
            <input
              autoFocus
              type="email"
              value={email}
              maxLength={100}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('loginPage.emailPlaceholder')}
              disabled={loading}
              className="rounded px-3 py-2 text-sm border outline-none transition-colors disabled:opacity-50"
              style={{ background: 'var(--v2-hover)', borderColor: 'var(--v2-border)', color: 'var(--v2-text)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--v2-accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--v2-border)')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--v2-muted)' }}>
              {t('loginPage.password')}
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                maxLength={160}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full rounded px-3 py-2 pr-16 text-sm border outline-none transition-colors disabled:opacity-50"
                style={{ background: 'var(--v2-hover)', borderColor: 'var(--v2-border)', color: 'var(--v2-text)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--v2-accent)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--v2-border)')}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPass(p => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-1 transition-colors"
                style={{ color: 'var(--v2-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--v2-text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--v2-muted)')}
              >
                {showPass ? t('loginPage.hide') : t('loginPage.show')}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="mt-1 rounded py-2 font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--v2-accent-hover)' }}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--v2-accent)')}
          >
            {loading ? t('loginPage.signingIn') : t('loginPage.signIn')}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--v2-border)' }}>
          {onSignup && (
            <button
              className="text-xs transition-colors"
              style={{ color: 'var(--v2-accent)' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              onClick={onSignup}
            >
              {t('loginPage.createAccount')}
            </button>
          )}
          <button
            className="text-xs transition-colors ml-auto"
            style={{ color: 'var(--v2-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--v2-text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--v2-muted)')}
            onClick={() => { localStorage.setItem('appVersion', 'v1'); window.location.reload() }}
          >
            {t('loginPage.switchToV1')}
          </button>
        </div>
      </div>
    </div>
  )
}
