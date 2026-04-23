import { create } from 'zustand'
import { apiFetch } from '../api/client'

export type Gender = 'М' | 'Ж' | 'Другое'

export type Patient = {
  fullName: string
  birthDate: string // YYYY-MM-DD
  gender: Gender
  phone: string
  address: string
  notes: string
  photoDataUrl: string | null
}

export type ExamItem = {
  id: string
  date: string
  title: string
  deadline: string // YYYY-MM-DD or ''
  status: 'todo' | 'referral' | 'submitted' | 'done' | 'result'
  category: string
  validityDays: number
  doneAt: string // ISO or ''
}

type MedicalState = {
  patient: Patient | null
  examsByDate: Record<string, ExamItem[]>
  loadingPatient: boolean
  loadingExams: Record<string, boolean>
  errorPatient: string | null
  errorExams: Record<string, string | null>
  updatingExamIds: Record<string, boolean>
  loadPatient: (token: string) => Promise<void>
  savePatient: (token: string, patch: Partial<Patient>) => Promise<void>
  setPatientPhoto: (token: string, photoDataUrl: string | null) => Promise<void>
  loadExams: (token: string, date: string) => Promise<void>
  addExamItem: (
    token: string,
    date: string,
    item: { title: string; deadline: string; category?: string; validityDays?: number },
  ) => Promise<void>
  addExamItemsBulk: (
    token: string,
    date: string,
    items: Array<{ title: string; deadline: string; category?: string; validityDays?: number }>,
  ) => Promise<void>
  toggleExamDone: (token: string, date: string, itemId: string) => Promise<void>
  setExamStatus: (
    token: string,
    date: string,
    itemId: string,
    status: ExamItem['status'],
  ) => Promise<void>
  removeExamItem: (token: string, date: string, itemId: string) => Promise<void>
}

export const useMedicalStore = create<MedicalState>()(
  (set, get) => ({
    patient: null,
    examsByDate: {},
    loadingPatient: false,
    loadingExams: {},
    errorPatient: null,
    errorExams: {},
    updatingExamIds: {},

    loadPatient: async (token) => {
      set({ loadingPatient: true, errorPatient: null })
      try {
        const p = await apiFetch<Patient>('/patient', { token })
        set({ patient: p })
      } catch (e) {
        set({ errorPatient: e instanceof Error ? e.message : 'Ошибка загрузки пациента' })
        throw e
      } finally {
        set({ loadingPatient: false })
      }
    },

    savePatient: async (token, patch) => {
      const current = get().patient
      const next = { ...(current ?? ({} as Patient)), ...patch } as Patient
      set({ patient: next })
      await apiFetch<{ ok: true }>('/patient', { token, method: 'PUT', body: JSON.stringify(next) })
    },

    setPatientPhoto: async (token, photoDataUrl) => {
      await get().savePatient(token, { photoDataUrl })
    },

    loadExams: async (token, date) => {
      set((s) => ({
        loadingExams: { ...s.loadingExams, [date]: true },
        errorExams: { ...s.errorExams, [date]: null },
      }))
      try {
        const items = await apiFetch<ExamItem[]>(`/exams?date=${encodeURIComponent(date)}`, { token })
        set((s) => ({ examsByDate: { ...s.examsByDate, [date]: items } }))
      } catch (e) {
        set((s) => ({
          errorExams: {
            ...s.errorExams,
            [date]: e instanceof Error ? e.message : 'Ошибка загрузки обследований',
          },
        }))
        throw e
      } finally {
        set((s) => ({ loadingExams: { ...s.loadingExams, [date]: false } }))
      }
    },

    addExamItem: async (token, date, item) => {
      await apiFetch<{ id: string }>(`/exams?date=${encodeURIComponent(date)}`, {
        token,
        method: 'POST',
        body: JSON.stringify(item),
      })
      await get().loadExams(token, date)
    },

    addExamItemsBulk: async (token, date, items) => {
      await apiFetch<{ ok: true }>(`/exams/bulk?date=${encodeURIComponent(date)}`, {
        token,
        method: 'POST',
        body: JSON.stringify({ items }),
      })
      await get().loadExams(token, date)
    },

    toggleExamDone: async (token, date, itemId) => {
      set((s) => ({ updatingExamIds: { ...s.updatingExamIds, [itemId]: true } }))
      try {
        // Optimistic UI
        set((s) => {
          const list = s.examsByDate[date] ?? []
          const next: ExamItem[] = list.map((it) =>
            it.id !== itemId
              ? it
              : it.status === 'done' || it.status === 'result'
                ? { ...it, status: 'todo', doneAt: '' }
                : { ...it, status: 'done', doneAt: new Date().toISOString() },
          )
          return { examsByDate: { ...s.examsByDate, [date]: next } }
        })

        await apiFetch<{ ok: true }>(`/exams/${encodeURIComponent(itemId)}/toggle`, {
          token,
          method: 'PATCH',
        })
        await get().loadExams(token, date)
      } finally {
        set((s) => ({ updatingExamIds: { ...s.updatingExamIds, [itemId]: false } }))
      }
    },

    setExamStatus: async (token, date, itemId, status) => {
      set((s) => ({ updatingExamIds: { ...s.updatingExamIds, [itemId]: true } }))
      try {
        // Optimistic UI
        set((s) => {
          const list = s.examsByDate[date] ?? []
          const doneLike = status === 'done' || status === 'result'
          const next: ExamItem[] = list.map((it) =>
            it.id !== itemId
              ? it
              : {
                  ...it,
                  status,
                  doneAt: doneLike ? new Date().toISOString() : '',
                },
          )
          return { examsByDate: { ...s.examsByDate, [date]: next } }
        })

        await apiFetch<{ ok: true }>(`/exams/${encodeURIComponent(itemId)}/status`, {
          token,
          method: 'PATCH',
          body: JSON.stringify({ status }),
        })
        await get().loadExams(token, date)
      } finally {
        set((s) => ({ updatingExamIds: { ...s.updatingExamIds, [itemId]: false } }))
      }
    },

    removeExamItem: async (token, date, itemId) => {
      await apiFetch<{ ok: true }>(`/exams/${encodeURIComponent(itemId)}`, {
        token,
        method: 'DELETE',
      })
      await get().loadExams(token, date)
    },
  }),
)

