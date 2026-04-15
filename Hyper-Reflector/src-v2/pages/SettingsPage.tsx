import { LogOut } from 'lucide-react'
import { logout } from '../../src/utils/firebase'
import { useSettingsStore } from '../../src/state/store'
import type { V2User } from '../types'

type SettingsPageProps = {
  user: V2User
  onLogout: () => void
}

const DELAYS = ['0', '1', '2', '3', '4', '5', '6', '7']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </section>
  )
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm text-gray-100">{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsPage({ user, onLogout }: SettingsPageProps) {
  const ggpoDelay = useSettingsStore(s => s.ggpoDelay)
  const setGgpoDelay = useSettingsStore(s => s.setGgpoDelay)

  const handleLogout = async () => {
    await logout()
    onLogout()
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto p-6 space-y-4">

        <Section title="Account">
          <Row label="Username">
            <span className="text-sm text-orange-400 font-medium">{user.userName}</span>
          </Row>
          {user.userEmail && (
            <Row label="Email">
              <span className="text-sm text-gray-300">{user.userEmail}</span>
            </Row>
          )}
          <Row label="ELO">
            <span className="text-sm text-gray-300">{user.accountElo}</span>
          </Row>
          {user.countryCode && (
            <Row label="Country">
              <span className="text-sm text-gray-300">{user.countryCode.toUpperCase()}</span>
            </Row>
          )}

          <div className="pt-2 border-t border-gray-700">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </Section>

        <Section title="Gameplay">
          <Row label="GGPO Delay" sub="Frame delay for netplay (0 – 7 frames)">
            <select
              value={ggpoDelay}
              onChange={e => setGgpoDelay(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-orange-500 transition-colors"
            >
              {DELAYS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="App">
          <Row label="Version">
            <div className="flex rounded overflow-hidden border border-gray-600 text-xs font-medium">
              <button
                className="px-2.5 py-1 bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
                onClick={() => { localStorage.setItem('appVersion', 'v1'); window.location.reload() }}
              >
                V1
              </button>
              <span className="px-2.5 py-1 bg-orange-500 text-white">V2</span>
            </div>
          </Row>
        </Section>

      </div>
    </div>
  )
}
