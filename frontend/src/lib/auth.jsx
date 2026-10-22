import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, setToken, clearToken, getToken } from './api'

const USER_KEY = 'edvvoice.user'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })
  const [ready, setReady] = useState(false)

  // Confirm the stored token is still good before trusting the cached user.
  useEffect(() => {
    if (!getToken()) { setReady(true); return }
    api.me()
      .then((fresh) => {
        localStorage.setItem(USER_KEY, JSON.stringify(fresh))
        setUser(fresh)
      })
      .catch(() => { clearToken(); localStorage.removeItem(USER_KEY); setUser(null) })
      .finally(() => setReady(true))
  }, [])

  const value = useMemo(() => {
    const accept = ({ access_token, user: u }) => {
      setToken(access_token)
      localStorage.setItem(USER_KEY, JSON.stringify(u))
      setUser(u)
      return u
    }
    return {
      user,
      ready,
      signIn: async (email, password) => accept(await api.login({ email, password })),
      /**
       * Returns either the signed-in user, or a pending marker when the
       * server wants the address confirmed first. With verification on, no
       * token is issued at sign-up, so there is nothing to accept yet.
       */
      signUp: async (payload) => {
        const result = await api.register(payload)
        if (result?.verification_required) return result
        return accept(result)
      },
      /** A confirmed code is proof of address ownership, so it signs in. */
      confirmCode: async (email, code) => accept(await api.verifyOtp(email, code)),
      signOut: () => { clearToken(); localStorage.removeItem(USER_KEY); setUser(null) },
    }
  }, [user, ready])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
