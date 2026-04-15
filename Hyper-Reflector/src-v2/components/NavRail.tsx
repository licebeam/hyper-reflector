import { Home, MessageCircle, Settings } from 'lucide-react'
import hrLogo from '../../src/assets/logo.svg'

type Page = 'lobby' | 'home' | 'settings'

type NavRailProps = {
  currentPage: Page
  onNavigate: (page: Page) => void
}

export function NavRail({ currentPage, onNavigate }: NavRailProps) {
  const NavBtn = ({ page, icon, label }: { page: Page; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => onNavigate(page)}
      title={label}
      aria-label={label}
      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
        currentPage === page
          ? 'bg-orange-500 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
      }`}
    >
      {icon}
    </button>
  )

  return (
    <nav className="w-16 flex flex-col items-center py-4 gap-6 bg-gray-800 border-r border-gray-700 shrink-0">
      <div className="h-10 w-10 flex items-center justify-center">
        <img src={hrLogo} alt="HR" className="h-8 w-8" />
      </div>

      <div className="flex flex-col items-center gap-4 flex-1">
        <NavBtn page="home" icon={<Home size={18} />} label="Home" />
        <NavBtn page="lobby" icon={<MessageCircle size={18} />} label="Lobby" />
      </div>

      <div className="flex flex-col items-center gap-4">
        <NavBtn page="settings" icon={<Settings size={18} />} label="Settings" />
      </div>
    </nav>
  )
}
