import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, OWNER_EMAIL } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = jos ne znamo, null = odjavljen

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const value = {
    user: user ?? null,
    loading: user === undefined,
    isOwner: !!user && user.email === OWNER_EMAIL,
    logout: () => signOut(auth),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth mora biti unutar AuthProvider')
  return ctx
}
