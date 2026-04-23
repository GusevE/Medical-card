import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { type ExamItem, useMedicalStore } from '../store/medicalStore'

type NewItemForm = {
  title: string
  deadline: string
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

const DEFAULT_EXAMS_DATE = '2026-05-19'
const EMPTY_ITEMS: ExamItem[] = []

export function ExamsPage() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.role)
  const canEdit = role === 'admin'
  const [date, setDate] = useState(DEFAULT_EXAMS_DATE || todayKey())
  const items = useMedicalStore((s) => s.examsByDate[date] ?? EMPTY_ITEMS)
  const loading = useMedicalStore((s) => s.loadingExams[date] ?? false)
  const error = useMedicalStore((s) => s.errorExams[date] ?? null)
  const loadExams = useMedicalStore((s) => s.loadExams)
  const addExamItem = useMedicalStore((s) => s.addExamItem)
  const toggleExamDone = useMedicalStore((s) => s.toggleExamDone)
  const setExamStatus = useMedicalStore((s) => s.setExamStatus)
  const removeExamItem = useMedicalStore((s) => s.removeExamItem)
  const updatingExamIds = useMedicalStore((s) => s.updatingExamIds)

  const [form, setForm] = useState<NewItemForm>({ title: '', deadline: '' })

  const [cat, setCat] = useState<string>('Все')

  const categories = useMemo(() => {
    const order = [
      'Документы',
      'Прививки',
      'Фтизиатрия',
      'Анализы (14 дней)',
      'Анализы',
      'Обследования',
    ]
    const present = new Set(items.map((i) => (i.category || '').trim()).filter(Boolean))
    const dynamic = order.filter((c) => present.has(c))
    // If user added custom categories, append them (sorted)
    const custom = Array.from(present)
      .filter((c) => !order.includes(c))
      .sort((a, b) => a.localeCompare(b, 'ru'))
    return ['Все', ...dynamic, ...custom]
  }, [items])

  const filtered = useMemo(() => {
    if (cat === 'Все') return items
    return items.filter((i) => (i.category || '').trim() === cat)
  }, [items, cat])

  const stats = useMemo(() => {
    const done = items.filter((i) => i.status === 'submitted' || i.status === 'done' || i.status === 'result').length
    const total = items.length
    return { done, total }
  }, [items])

  async function submit() {
    const title = form.title.trim()
    if (!title) return
    if (!token) return
    if (!canEdit) return
    await addExamItem(token, date, { title, deadline: form.deadline, category: '', validityDays: 0 })
    setForm({ title: '', deadline: '' })
  }

  useEffect(() => {
    if (!token) return
    void loadExams(token, date)
  }, [token, date, loadExams])

  useEffect(() => {
    // keep selected category valid after data refresh
    if (!categories.includes(cat)) setCat('Все')
  }, [categories, cat])

  function statusLabel(s: ExamItem['status']) {
    switch (s) {
      case 'todo':
        return 'Нужно'
      case 'referral':
        return 'Направление'
      case 'submitted':
        return 'Сдано'
      case 'done':
        return 'Сделано'
      case 'result':
        return 'Результат'
      default:
        return s
    }
  }

  return (
    <div className="stack gap-16">
      <div className="card">
        <div className="cardHeader row between gap-12 wrap">
          <div>
            <div className="cardTitle">Обследования</div>
            <div className="cardSub">
              Дата: <b>{date}</b> • Готово: <b>{stats.done}</b> из <b>{stats.total}</b>
            </div>
          </div>

          <label className="field inline">
            <span>Выбрать дату</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div className="stack gap-12">
          <div className="subtabs" role="tablist" aria-label="Категории">
            {categories.map((c) => {
              const count = c === 'Все' ? items.length : items.filter((i) => i.category === c).length
              return (
                <button
                  key={c}
                  type="button"
                  className={`subtab ${cat === c ? 'active' : ''}`}
                  onClick={() => setCat(c)}
                  role="tab"
                  aria-selected={cat === c}
                >
                  <span className="subtabLabel">{c}</span>
                  <span className="subtabCount">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="card soft">
            <div className="row gap-12 wrap">
              <label className="field grow">
                <span>Что нужно сдать / сделать</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Например: Общий анализ крови"
                  disabled={!canEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit()
                  }}
                />
              </label>

              <label className="field">
                <span>До какого срока</span>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  disabled={!canEdit}
                />
              </label>

              <button type="button" className="btn primary alignEnd" onClick={submit} disabled={!canEdit}>
                Добавить
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty">Загрузка…</div>
          ) : error ? (
            <div className="card soft">
              <div className="cardTitle">Не удалось загрузить</div>
              <div className="cardSub">{error}</div>
              <div className="row gap-8 wrap" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => token && void loadExams(token, date)}
                  disabled={!token}
                >
                  Повторить
                </button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              {items.length === 0
                ? 'На эту дату пока нет записей. Добавьте назначение выше.'
                : 'В этой категории пока нет пунктов.'}
            </div>
          ) : (
            <div className="list">
              {filtered.map((it) => {
                const visuallyDone = it.status === 'submitted' || it.status === 'done' || it.status === 'result'
                const overdue =
                  (it.status === 'todo' || it.status === 'referral' || it.status === 'submitted') &&
                  it.deadline &&
                  it.deadline < todayKey() &&
                  it.deadline !== date
                return (
                  <div
                    key={it.id}
                    className={`listItem ${visuallyDone ? 'done' : ''}`}
                  >
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={visuallyDone}
                        onChange={() => token && canEdit && void toggleExamDone(token, date, it.id)}
                        disabled={!canEdit || updatingExamIds[it.id]}
                      />
                      <span className="checkmark" aria-hidden="true" />
                    </label>

                    <div className="stack gap-4 grow">
                      <div className="row between gap-12 wrap">
                        <div className="itemTitle">{it.title}</div>
                        <div className="badges">
                          {it.category ? <span className="badge">{it.category}</span> : null}
                          {it.deadline ? (
                            <span className={`badge ${overdue ? 'danger' : ''}`}>
                              Срок: {it.deadline}
                            </span>
                          ) : null}
                          {it.validityDays ? (
                            <span className="badge">Годность: {it.validityDays} дн.</span>
                          ) : null}
                          <span className={`badge ${visuallyDone ? 'ok' : ''}`}>
                            {statusLabel(it.status)}
                            {it.doneAt && (it.status === 'done' || it.status === 'result')
                              ? ` • ${it.doneAt.slice(0, 10)}`
                              : ''}
                          </span>
                        </div>
                      </div>
                      <div className="row gap-8 wrap">
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => token && canEdit && void setExamStatus(token, date, it.id, 'referral')}
                          disabled={!canEdit || updatingExamIds[it.id] || it.status === 'referral'}
                        >
                          Направление
                        </button>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => token && canEdit && void setExamStatus(token, date, it.id, 'submitted')}
                          disabled={!canEdit || updatingExamIds[it.id] || it.status === 'submitted'}
                        >
                          Сдано
                        </button>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => token && canEdit && void setExamStatus(token, date, it.id, 'result')}
                          disabled={!canEdit || updatingExamIds[it.id] || it.status === 'result'}
                        >
                          Результат
                        </button>
                        <button
                          type="button"
                          className="btn sm ghost"
                          onClick={() => token && canEdit && void setExamStatus(token, date, it.id, 'todo')}
                          disabled={!canEdit || updatingExamIds[it.id] || it.status === 'todo'}
                        >
                          Сброс
                        </button>
                      </div>
                    </div>

                    {canEdit ? (
                      <button
                        type="button"
                        className="iconBtn"
                        title="Удалить"
                        onClick={() => token && void removeExamItem(token, date, it.id)}
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

