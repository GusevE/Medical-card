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

export type PatientDoc = {
  id: string
  kind: 'common'
  name: string
  dataUrl: string
  createdAt: string
}

export type ExamItem = {
  id: string
  date: string
  title: string
  deadline: string // YYYY-MM-DD or ''
  status: 'todo' | 'referral' | 'submitted' | 'done' | 'result'
  category: string
  validityDays: number
  resultPhotoDataUrl?: string | null
  documents?: Array<{ id: string; kind: 'result' | 'doc'; name: string; dataUrl: string; createdAt: string }>
  doneAt: string // ISO or ''
}

type MedicalState = {
  patient: Patient | null
  patientDocs: PatientDoc[]
  examsByDate: Record<string, ExamItem[]>
  loadingPatient: boolean
  loadingPatientDocs: boolean
  loadingExams: Record<string, boolean>
  errorPatient: string | null
  errorPatientDocs: string | null
  errorExams: Record<string, string | null>
  updatingExamIds: Record<string, boolean>
  loadPatient: (token: string) => Promise<void>
  loadPatientDocs: (token: string) => Promise<void>
  addPatientDoc: (token: string, doc: { name: string; dataUrl: string }) => Promise<void>
  removePatientDoc: (token: string, docId: string) => Promise<void>
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
    resultPhotoDataUrl?: string | null,
  ) => Promise<void>
  addExamDoc: (token: string, date: string, itemId: string, doc: { kind: 'result' | 'doc'; name: string; dataUrl: string }) => Promise<void>
  removeExamDoc: (token: string, date: string, itemId: string, docId: string) => Promise<void>
  removeExamItem: (token: string, date: string, itemId: string) => Promise<void>
}

export const useMedicalStore = create<MedicalState>()(
  (set, get) => ({
    patient: null,
    patientDocs: [],
    examsByDate: {},
    loadingPatient: false,
    loadingPatientDocs: false,
    loadingExams: {},
    errorPatient: null,
    errorPatientDocs: null,
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

    loadPatientDocs: async (token) => {
      set({ loadingPatientDocs: true, errorPatientDocs: null })
      try {
        const docs = await apiFetch<PatientDoc[]>('/patient/docs', { token })
        set({ patientDocs: docs })
      } catch (e) {
        set({ errorPatientDocs: e instanceof Error ? e.message : 'Ошибка загрузки документов' })
        throw e
      } finally {
        set({ loadingPatientDocs: false })
      }
    },

    addPatientDoc: async (token, doc) => {
      await apiFetch<{ id: string }>('/patient/docs', {
        token,
        method: 'POST',
        body: JSON.stringify({ kind: 'common', name: doc.name, dataUrl: doc.dataUrl }),
      })
      await get().loadPatientDocs(token)
    },

    removePatientDoc: async (token, docId) => {
      await apiFetch<{ ok: true }>(`/patient/docs/${encodeURIComponent(docId)}`, {
        token,
        method: 'DELETE',
      })
      await get().loadPatientDocs(token)
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

    setExamStatus: async (token, date, itemId, status, resultPhotoDataUrl) => {
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
                  resultPhotoDataUrl:
                    status === 'result'
                      ? resultPhotoDataUrl !== undefined
                        ? resultPhotoDataUrl
                        : it.resultPhotoDataUrl ?? null
                      : null,
                },
          )
          return { examsByDate: { ...s.examsByDate, [date]: next } }
        })

        const body: any = { status }
        if (status === 'result' && resultPhotoDataUrl !== undefined) {
          body.resultPhotoDataUrl = resultPhotoDataUrl
        }
        await apiFetch<{ ok: true }>(`/exams/${encodeURIComponent(itemId)}/status`, {
          token,
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        await get().loadExams(token, date)
      } finally {
        set((s) => ({ updatingExamIds: { ...s.updatingExamIds, [itemId]: false } }))
      }
    },

    addExamDoc: async (token, date, itemId, doc) => {
      set((s) => ({ updatingExamIds: { ...s.updatingExamIds, [itemId]: true } }))
      try {
        await apiFetch<{ id: string }>(`/exams/${encodeURIComponent(itemId)}/docs`, {
          token,
          method: 'POST',
          body: JSON.stringify(doc),
        })
        await get().loadExams(token, date)
      } finally {
        set((s) => ({ updatingExamIds: { ...s.updatingExamIds, [itemId]: false } }))
      }
    },

    removeExamDoc: async (token, date, itemId, docId) => {
      set((s) => ({ updatingExamIds: { ...s.updatingExamIds, [itemId]: true } }))
      try {
        await apiFetch<{ ok: true }>(`/exams/${encodeURIComponent(itemId)}/docs/${encodeURIComponent(docId)}`, {
          token,
          method: 'DELETE',
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

