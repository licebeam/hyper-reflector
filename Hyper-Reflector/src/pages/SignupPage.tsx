import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { useTranslation } from 'react-i18next'
import type { FirebaseError } from 'firebase/app'
import { auth } from '../utils/firebase'
import api from '../external-api/requests'
import { validateName } from '../utils/validation'
import i18n from '../i18n'

type SignupPageProps = {
  onBack: () => void
}

const mapFirebaseError = (err: FirebaseError) => {
  switch (err.code) {
    case 'auth/email-already-in-use': return i18n.t('signupPage.emailAlreadyInUse')
    case 'auth/weak-password': return i18n.t('signupPage.weakPassword')
    case 'auth/invalid-email': return i18n.t('signupPage.invalidEmail')
    default: return i18n.t('signupPage.genericError')
  }
}

export function SignupPage({ onBack }: SignupPageProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ name: '', email: '', pass: '', repass: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameWarning, setNameWarning] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)

  const update = (key: keyof typeof form, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleValidateName = (value: string) => {
    const error = validateName(value, { label: t('signupPage.displayName') })
    setNameWarning(error)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.pass !== form.repass) return setError(t('signupPage.passwordsMustMatch'))
    if (!form.name.trim() || nameWarning) return setError(t('signupPage.provideDisplayName'))
    setLoading(true)
    setError(null)
    const displayName = form.name.trim()
    try {
      // Store the display name BEFORE creating the Firebase user.
      // onAuthStateChanged fires immediately after createUserWithEmailAndPassword,
      // before api.createAccount can run, so the backend won't have this user yet.
      // The fallback in AppV2 reads this key to avoid defaulting to the email prefix.
      sessionStorage.setItem('v2_pending_display_name', displayName)
      await createUserWithEmailAndPassword(auth, form.email.trim(), form.pass)
      await api.createAccount(auth, displayName, form.email.trim())
      await api.addLoggedInUser(auth)
      sessionStorage.removeItem('v2_pending_display_name')
      // onAuthStateChanged in AppV2 will fire again once the backend has the user
    } catch (err) {
      sessionStorage.removeItem('v2_pending_display_name')
      const fe = err as FirebaseError
      setError('code' in fe ? mapFirebaseError(fe) : t('signupPage.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (invalid = false) => ({
    background: 'var(--v2-hover)',
    borderColor: invalid ? '#f87171' : 'var(--v2-border)',
    color: 'var(--v2-text)',
  })

  const nameInvalid = !!nameWarning
  const canSubmit = form.name.trim() && !nameInvalid && form.email.trim() && form.pass && form.repass && !loading

  return (
    <div className="h-full flex items-center justify-center overflow-y-auto py-6">
      <div
        className="rounded-xl p-8 w-96 shadow-xl border"
        style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}
      >
        <button
          onClick={onBack}
          className="text-xs mb-4 transition-colors block"
          style={{ color: 'var(--v2-accent)' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          {t('signupPage.backToSignIn')}
        </button>

        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--v2-accent)' }}>
          {t('signupPage.title')}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--v2-muted)' }}>
          {t('signupPage.subtitle')}
        </p>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Display name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--v2-muted)' }}>
              {t('signupPage.displayName')} <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={form.name}
              maxLength={16}
              placeholder={t('signupPage.displayNamePlaceholder')}
              disabled={loading}
              onChange={e => { update('name', e.target.value); handleValidateName(e.target.value) }}
              className="rounded px-3 py-2 text-sm border outline-none transition-colors disabled:opacity-50"
              style={inputStyle(nameInvalid)}
              onFocus={e => (e.currentTarget.style.borderColor = nameInvalid ? '#f87171' : 'var(--v2-accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = nameInvalid ? '#f87171' : 'var(--v2-border)')}
            />
            <p className="text-xs" style={{ color: nameWarning ? '#f87171' : 'var(--v2-muted)' }}>
              {nameWarning || t('signupPage.displayNameHint')}
            </p>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--v2-muted)' }}>
              {t('signupPage.email')} <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              maxLength={50}
              placeholder={t('signupPage.emailPlaceholder')}
              disabled={loading}
              onChange={e => update('email', e.target.value)}
              className="rounded px-3 py-2 text-sm border outline-none transition-colors disabled:opacity-50"
              style={inputStyle()}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--v2-accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--v2-border)')}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--v2-muted)' }}>
              {t('signupPage.password')} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.pass}
                maxLength={160}
                placeholder="••••••••"
                disabled={loading}
                onChange={e => update('pass', e.target.value)}
                className="w-full rounded px-3 py-2 pr-16 text-sm border outline-none transition-colors disabled:opacity-50"
                style={inputStyle()}
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
                {showPass ? t('signupPage.hide') : t('signupPage.show')}
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--v2-muted)' }}>{t('signupPage.passwordHint')}</p>
          </div>

          {/* Confirm password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--v2-muted)' }}>
              {t('signupPage.confirmPassword')} <span className="text-red-400">*</span>
            </label>
            <input
              type={showPass ? 'text' : 'password'}
              value={form.repass}
              maxLength={160}
              placeholder="••••••••"
              disabled={loading}
              onChange={e => update('repass', e.target.value)}
              className="rounded px-3 py-2 text-sm border outline-none transition-colors disabled:opacity-50"
              style={inputStyle()}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--v2-accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--v2-border)')}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-1 rounded py-2 font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--v2-accent-hover)' }}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--v2-accent)')}
          >
            {loading ? t('signupPage.creatingAccount') : t('signupPage.title')}
          </button>
        </form>
      </div>
    </div>
  )
}
