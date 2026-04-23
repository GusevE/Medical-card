import { useEffect, useMemo, useState } from 'react'
import { ExamsPage } from './pages/ExamsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PatientDocsPage } from './pages/PatientDocsPage'
import { useAuthStore } from './store/authStore'
import { useMedicalStore } from './store/medicalStore'
import './App.css'

type Tab = 'home' | 'exams' | 'docs'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const authStatus = useAuthStore((s) => s.status)
  const token = useAuthStore((s) => s.token)
  const username = useAuthStore((s) => s.username)
  const check = useAuthStore((s) => s.check)
  const logout = useAuthStore((s) => s.logout)
  const patient = useMedicalStore((s) => s.patient)
  const loadPatient = useMedicalStore((s) => s.loadPatient)
  const shortName = useMemo(() => {
    const parts = (patient?.fullName ?? '').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'Медицинская карточка'
    if (parts.length === 1) return parts[0]
    return `${parts[0]} ${parts[1][0]}.`
  }, [patient?.fullName])

  useEffect(() => {
    void check()
    // In dev (StrictMode) effects run twice; check() is idempotent.
    // We intentionally run it only on mount to avoid accidental loops
    // if the store action identity changes across hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (authStatus !== 'authed' || !token) return
    void loadPatient(token)
  }, [authStatus, token, loadPatient])

  if (authStatus === 'unknown') {
    return (
      <div className="appShell">
        <main className="container">
          <div className="card">
            <div className="cardTitle">Загрузка…</div>
            <div className="cardSub">Проверяем доступ</div>
          </div>
        </main>
      </div>
    )
  }

  if (authStatus !== 'authed' || !token) {
    return <LoginPage />
  }

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandTitle">Медицинская карточка</div>
          <div className="brandSub">{shortName}</div>
        </div>

        <div className="row gap-12 wrap">
          <nav className="tabs" aria-label="Навигация">
            <button
              type="button"
              className={`tab ${tab === 'home' ? 'active' : ''}`}
              onClick={() => setTab('home')}
            >
              Главная
            </button>
            <button
              type="button"
              className={`tab ${tab === 'exams' ? 'active' : ''}`}
              onClick={() => setTab('exams')}
            >
              Обследования
            </button>
            <button
              type="button"
              className={`tab ${tab === 'docs' ? 'active' : ''}`}
              onClick={() => setTab('docs')}
            >
              Документы
            </button>
          </nav>
          <div className="tabs tabsSingle" aria-label="Выход">
            <button type="button" className="tab logoutTab" onClick={logout} title={username ?? undefined}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        {tab === 'home' ? <HomePage /> : tab === 'exams' ? <ExamsPage /> : <PatientDocsPage />}
      </main>

      <footer className="footer">
        Данные сохраняются в базе данных (SQLite) на сервере.
      </footer>
    </div>
  )
}
