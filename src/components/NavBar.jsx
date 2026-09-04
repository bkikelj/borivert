import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const tabClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 font-mono text-sm ${
    isActive ? 'bg-accent text-white' : 'text-muted hover:text-ink'
  }`

export default function NavBar() {
  const { user, isOwner, logout } = useAuth()

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <span className="font-display text-xl font-bold">Borivert</span>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={tabClass}>
              Utrke
            </NavLink>
            {isOwner && (
              <>
                <NavLink to="/admin/korisnici" className={tabClass}>
                  Korisnici
                </NavLink>
                <NavLink to="/admin/sigurnost" className={tabClass}>
                  Sigurnost
                </NavLink>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs text-muted">
          <span className="hidden sm:inline">{user?.email}</span>
          <button type="button" onClick={logout} className="hover:underline">
            odjava
          </button>
        </div>
      </div>
    </header>
  )
}
