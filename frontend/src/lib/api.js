/**
 * Every call to the backend goes through here.
 *
 * The JWT is kept in localStorage and attached automatically.
 *
 * A 401 is read in context. On a request that CARRIED a token it means the
 * token is no longer good, so the session is cleared and we bounce to the
 * login page. On a request with no token — signing in — it means the
 * credentials were wrong, and the server's own message is what the user
 * needs to see. Treating both the same way made a mistyped password report
 * "your session has expired" and throw the user back to the login page.
 */

const BASE = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'edvvoice.token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function handle(res, sentToken) {
  if (res.status === 401 && sentToken) {
    clearToken()
    localStorage.removeItem('edvvoice.user')
    if (!window.location.pathname.startsWith('/reset-password')) window.location.href = '/'
    throw new Error('Your session has expired. Sign in again.')
  }

  let data = null
  try { data = await res.json() } catch { /* no body */ }

  if (!res.ok) {
    throw new Error(readError(data) || `Request failed (${res.status})`)
  }
  return data
}

/** FastAPI validation errors arrive as a list of objects, not a string. */
function readError(data) {
  const detail = data?.detail
  if (!detail) return data?.message
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join('. ')
  return null
}

export async function request(path, { method = 'GET', body, auth = true } = {}) {
  const token = auth ? getToken() : null
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return handle(res, Boolean(token))
}

/** Multipart — the browser sets its own Content-Type with the boundary. */
async function upload(path, formData) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  return handle(res, Boolean(token))
}

// ------------------------------------------------------------------- auth

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
  me: () => request('/auth/me'),

  /** Confirm the address with the emailed code. Returns a session on success. */
  verifyOtp: (email, code) =>
    request('/auth/verify-otp', { method: 'POST', body: { email, code }, auth: false }),

  /** Ask for a fresh code. */
  resendOtp: (email) =>
    request('/auth/resend-otp', { method: 'POST', body: { email }, auth: false }),

  requestPasswordReset: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  verifyResetToken: (token) =>
    request(`/auth/reset-password/verify?token=${encodeURIComponent(token)}`, { auth: false }),
  submitNewPassword: (token, password) =>
    request('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false }),

  // ------------------------------------------------------------ complaints

  createComplaint: (payload) => request('/complaints', { method: 'POST', body: payload }),

  listComplaints: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v && v !== 'All')
    ).toString()
    return request(`/complaints${query ? `?${query}` : ''}`)
  },

  getComplaint: (reference) => request(`/complaints/${reference}`),
  stats: () => request('/complaints/stats'),
  breakdown: () => request('/complaints/breakdown'),

  updateStatus: (reference, status, note = '') =>
    request(`/complaints/${reference}/status`, { method: 'PATCH', body: { status, note } }),

  // --------------------------------------------------------------- files

  uploadEvidence: (files) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return upload('/uploads', form)
  },

  /** Upload the voice recording so the original speech stays on the record. */
  uploadAudio: (audioBlob) => {
    const form = new FormData()
    form.append('files', audioBlob, 'voice-recording.webm')
    return upload('/uploads', form)
  },

  /** Ask the server whether a transcript reads as a real complaint. */
  validateComplaint: (transcript) =>
    request('/complaints/validate', { method: 'POST', body: { transcript } }),

  health: () => request('/health', { auth: false }),
}
