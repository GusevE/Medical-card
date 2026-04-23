const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5174'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string } = {},
): Promise<T> {
  const token = opts.token
  const headers = new Headers(opts.headers || {})
  headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  const res = await fetch(`${API_URL}${path}`, { ...opts, headers })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = (await res.json()) as any
      msg = j?.error || msg
    } catch {
      // ignore
    }
    throw new ApiError(res.status, msg)
  }
  return (await res.json()) as T
}

