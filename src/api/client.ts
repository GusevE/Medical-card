const API_URL = import.meta.env.VITE_API_URL || 'local'

type LocalSession = { token: string; username: string; role: 'admin' | 'user'; createdAt: number }
type LocalExamStatus = 'todo' | 'referral' | 'submitted' | 'done' | 'result'
type LocalExamItem = {
  id: string
  date: string
  title: string
  deadline: string
  status: LocalExamStatus
  category: string
  validityDays: number
  resultPhotoDataUrl?: string | null
  documents?: Array<{ id: string; kind: 'result' | 'doc'; name: string; dataUrl: string; createdAt: string }>
  doneAt: string
}
type LocalPatient = {
  fullName: string
  birthDate: string
  gender: string
  phone: string
  address: string
  notes: string
  photoDataUrl: string | null
}
type LocalPatientDoc = { id: string; kind: 'common'; name: string; dataUrl: string; createdAt: string }

function isLocalMode() {
  return String(API_URL).trim().toLowerCase() === 'local'
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
function lsSet(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function requireLocalAuth(token?: string) {
  const sessions = lsGet<Record<string, LocalSession>>('mc:sessions', {})
  const s = token ? sessions[token] : undefined
  if (!s) throw new ApiError(401, 'unauthorized')
  return s
}

function parseQuery(path: string) {
  const u = new URL(path, 'http://local')
  return { pathname: u.pathname, searchParams: u.searchParams }
}

async function localApiFetch<T>(path: string, opts: RequestInit & { token?: string }): Promise<T> {
  const method = (opts.method || 'GET').toUpperCase()
  const token = opts.token
  const { pathname, searchParams } = parseQuery(path)

  // Auth
  if (pathname === '/auth/login' && method === 'POST') {
    const body = opts.body ? (JSON.parse(String(opts.body)) as any) : {}
    const username = String(body.username || '').trim()
    const password = String(body.password || '')

    const adminOk = username === 'admin' && password === 'Tiguan2013!'
    const userOk = username === 'user' && password === 'Arina2016'
    if (!adminOk && !userOk) throw new ApiError(401, 'invalid_credentials')

    const role: 'admin' | 'user' = adminOk ? 'admin' : 'user'
    const t = `local_${role}_${Math.random().toString(36).slice(2)}`
    const sessions = lsGet<Record<string, LocalSession>>('mc:sessions', {})
    sessions[t] = { token: t, username, role, createdAt: Date.now() }
    lsSet('mc:sessions', sessions)
    return { token: t, username, role } as T
  }

  if (pathname === '/auth/me' && method === 'GET') {
    const s = requireLocalAuth(token)
    return { username: s.username, role: s.role } as T
  }

  // Patient
  if (pathname === '/patient' && method === 'GET') {
    requireLocalAuth(token)
    const p = lsGet<LocalPatient>('mc:patient', {
      fullName: 'Гусева Арина Евгеньевна',
      birthDate: '2016-06-08',
      gender: 'Ж',
      phone: '89157090027',
      address: 'г Тверь, Мигаловская набережная, д 2Б, кв 50',
      notes: 'Родители:\nОтец: Гусев Евгений Николаевич\nМать: Гусева Ольга Викторовна',
      photoDataUrl: '/patient.png',
    })
    lsSet('mc:patient', p)
    return p as T
  }

  if (pathname === '/patient/docs' && method === 'GET') {
    requireLocalAuth(token)
    const docs = lsGet<LocalPatientDoc[]>('mc:patientDocs', [])
    return docs as any as T
  }

  if (pathname === '/patient/docs' && method === 'POST') {
    const s = requireLocalAuth(token)
    if (s.role !== 'admin') throw new ApiError(403, 'forbidden')
    const body = opts.body ? (JSON.parse(String(opts.body)) as any) : {}
    const name = String(body.name || 'Документ')
    const dataUrl = String(body.dataUrl || '')
    if (!dataUrl.startsWith('data:')) throw new ApiError(400, 'bad_request')
    const docs = lsGet<LocalPatientDoc[]>('mc:patientDocs', [])
    const id = `pd_${Date.now()}_${Math.random().toString(36).slice(2)}`
    docs.unshift({ id, kind: 'common', name, dataUrl, createdAt: new Date().toISOString() })
    lsSet('mc:patientDocs', docs)
    return { id } as any as T
  }

  const mPatientDocDel = pathname.match(/^\/patient\/docs\/([^/]+)$/)
  if (mPatientDocDel && method === 'DELETE') {
    const s = requireLocalAuth(token)
    if (s.role !== 'admin') throw new ApiError(403, 'forbidden')
    const docId = decodeURIComponent(mPatientDocDel[1])
    const docs = lsGet<LocalPatientDoc[]>('mc:patientDocs', [])
    const next = docs.filter((d) => d.id !== docId)
    if (next.length === docs.length) throw new ApiError(404, 'not_found')
    lsSet('mc:patientDocs', next)
    return { ok: true } as any as T
  }

  if (pathname === '/patient' && method === 'PUT') {
    const s = requireLocalAuth(token)
    if (s.role !== 'admin') throw new ApiError(403, 'forbidden')
    const p = opts.body ? (JSON.parse(String(opts.body)) as LocalPatient) : null
    if (!p) throw new ApiError(400, 'bad_request')
    lsSet('mc:patient', p)
    return { ok: true } as T
  }

  // Exams
  if (pathname === '/exams' && method === 'GET') {
    requireLocalAuth(token)
    const date = String(searchParams.get('date') || '')
    if (!date) throw new ApiError(400, 'date_required')
    const byDate = lsGet<Record<string, LocalExamItem[]>>('mc:examsByDate', {})
    return (byDate[date] ?? []).map((it) => ({ ...it, documents: it.documents ?? [] })) as T
  }

  if (pathname === '/exams' && method === 'POST') {
    const s = requireLocalAuth(token)
    if (s.role !== 'admin') throw new ApiError(403, 'forbidden')
    const date = String(searchParams.get('date') || '')
    if (!date) throw new ApiError(400, 'date_required')
    const body = opts.body ? (JSON.parse(String(opts.body)) as any) : {}
    const title = String(body.title || '').trim()
    if (!title) throw new ApiError(400, 'bad_request')

    const byDate = lsGet<Record<string, LocalExamItem[]>>('mc:examsByDate', {})
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    const item: LocalExamItem = {
      id,
      date,
      title,
      deadline: String(body.deadline || ''),
      status: 'todo',
      category: String(body.category || ''),
      validityDays: Number(body.validityDays || 0),
      resultPhotoDataUrl: null,
      documents: [],
      doneAt: '',
    }
    byDate[date] = [item, ...(byDate[date] ?? [])]
    lsSet('mc:examsByDate', byDate)
    return { id } as T
  }

  const mToggle = pathname.match(/^\/exams\/([^/]+)\/toggle$/)
  if (mToggle && method === 'PATCH') {
    const s = requireLocalAuth(token)
    if (s.role !== 'admin') throw new ApiError(403, 'forbidden')
    const id = decodeURIComponent(mToggle[1])
    const byDate = lsGet<Record<string, LocalExamItem[]>>('mc:examsByDate', {})
    for (const date of Object.keys(byDate)) {
      const list = byDate[date] ?? []
      const idx = list.findIndex((x) => x.id === id)
      if (idx >= 0) {
        const cur = list[idx]
        const isDone = cur.status === 'done' || cur.status === 'result'
        const nextStatus: LocalExamStatus = isDone ? 'todo' : 'done'
        list[idx] = {
          ...cur,
          status: nextStatus,
          doneAt: nextStatus === 'done' ? new Date().toISOString() : '',
          resultPhotoDataUrl: null,
        }
        byDate[date] = list
        lsSet('mc:examsByDate', byDate)
        return { ok: true } as T
      }
    }
    throw new ApiError(404, 'not_found')
  }

  const mStatus = pathname.match(/^\/exams\/([^/]+)\/status$/)
  if (mStatus && method === 'PATCH') {
    const s = requireLocalAuth(token)
    if (s.role !== 'admin') throw new ApiError(403, 'forbidden')
    const id = decodeURIComponent(mStatus[1])
    const body = opts.body ? (JSON.parse(String(opts.body)) as any) : {}
    const status = String(body.status || '') as LocalExamStatus
    const hasResultPhoto = Object.prototype.hasOwnProperty.call(body, 'resultPhotoDataUrl')
    const resultPhotoDataUrl =
      hasResultPhoto && typeof body.resultPhotoDataUrl === 'string' ? body.resultPhotoDataUrl : null
    const allowed: LocalExamStatus[] = ['todo', 'referral', 'submitted', 'done', 'result']
    if (!allowed.includes(status)) throw new ApiError(400, 'bad_request')

    const byDate = lsGet<Record<string, LocalExamItem[]>>('mc:examsByDate', {})
    for (const date of Object.keys(byDate)) {
      const list = byDate[date] ?? []
      const idx = list.findIndex((x) => x.id === id)
      if (idx >= 0) {
        const cur = list[idx]
        const doneLike = status === 'done' || status === 'result'
        const nextDocs = [...(cur.documents ?? [])].filter((d) => d.kind !== 'result')
        if (status === 'result' && hasResultPhoto) {
          if (resultPhotoDataUrl) {
            nextDocs.unshift({
              id: `d_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              kind: 'result',
              name: 'Результат',
              dataUrl: resultPhotoDataUrl,
              createdAt: new Date().toISOString(),
            })
          }
        } else if (status === 'result' && !hasResultPhoto) {
          // keep existing
          for (const d of cur.documents ?? []) if (d.kind === 'result') nextDocs.unshift(d)
        }
        list[idx] = {
          ...cur,
          status,
          doneAt: doneLike ? new Date().toISOString() : '',
          resultPhotoDataUrl:
            status === 'result'
              ? hasResultPhoto
                ? resultPhotoDataUrl
                : cur.resultPhotoDataUrl ?? null
              : null,
          documents: nextDocs,
        }
        byDate[date] = list
        lsSet('mc:examsByDate', byDate)
        return { ok: true } as T
      }
    }
    throw new ApiError(404, 'not_found')
  }

  const mDelete = pathname.match(/^\/exams\/([^/]+)$/)
  if (mDelete && method === 'DELETE') {
    const s = requireLocalAuth(token)
    if (s.role !== 'admin') throw new ApiError(403, 'forbidden')
    const id = decodeURIComponent(mDelete[1])
    const byDate = lsGet<Record<string, LocalExamItem[]>>('mc:examsByDate', {})
    let removed = false
    for (const date of Object.keys(byDate)) {
      const list = byDate[date] ?? []
      const next = list.filter((x) => x.id !== id)
      if (next.length !== list.length) {
        byDate[date] = next
        removed = true
      }
    }
    if (!removed) throw new ApiError(404, 'not_found')
    lsSet('mc:examsByDate', byDate)
    return { ok: true } as T
  }

  const mDocsPost = pathname.match(/^\/exams\/([^/]+)\/docs$/)
  if (mDocsPost && method === 'POST') {
    const s = requireLocalAuth(token)
    if (s.role !== 'admin') throw new ApiError(403, 'forbidden')
    const itemId = decodeURIComponent(mDocsPost[1])
    const body = opts.body ? (JSON.parse(String(opts.body)) as any) : {}
    const kind = body.kind === 'result' ? 'result' : 'doc'
    const name = String(body.name || 'Документ')
    const dataUrl = String(body.dataUrl || '')
    if (!dataUrl.startsWith('data:')) throw new ApiError(400, 'bad_request')

    const byDate = lsGet<Record<string, LocalExamItem[]>>('mc:examsByDate', {})
    for (const date of Object.keys(byDate)) {
      const list = byDate[date] ?? []
      const idx = list.findIndex((x) => x.id === itemId)
      if (idx >= 0) {
        const docId = `d_${Date.now()}_${Math.random().toString(36).slice(2)}`
        const cur = list[idx]
        const docs = [...(cur.documents ?? [])]
        docs.unshift({ id: docId, kind, name, dataUrl, createdAt: new Date().toISOString() })
        list[idx] = { ...cur, documents: docs }
        byDate[date] = list
        lsSet('mc:examsByDate', byDate)
        return { id: docId } as T
      }
    }
    throw new ApiError(404, 'not_found')
  }

  const mDocsDel = pathname.match(/^\/exams\/([^/]+)\/docs\/([^/]+)$/)
  if (mDocsDel && method === 'DELETE') {
    const s = requireLocalAuth(token)
    if (s.role !== 'admin') throw new ApiError(403, 'forbidden')
    const itemId = decodeURIComponent(mDocsDel[1])
    const docId = decodeURIComponent(mDocsDel[2])
    const byDate = lsGet<Record<string, LocalExamItem[]>>('mc:examsByDate', {})
    for (const date of Object.keys(byDate)) {
      const list = byDate[date] ?? []
      const idx = list.findIndex((x) => x.id === itemId)
      if (idx >= 0) {
        const cur = list[idx]
        const docs = (cur.documents ?? []).filter((d) => d.id !== docId)
        list[idx] = { ...cur, documents: docs }
        byDate[date] = list
        lsSet('mc:examsByDate', byDate)
        return { ok: true } as T
      }
    }
    throw new ApiError(404, 'not_found')
  }

  throw new ApiError(404, 'not_found')
}

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
  if (isLocalMode()) {
    return await localApiFetch<T>(path, opts)
  }
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

