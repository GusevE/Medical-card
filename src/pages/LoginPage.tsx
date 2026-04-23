import { useState } from 'react'
import { ApiError } from '../api/client'
import { useAuthStore } from '../store/authStore'

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? 'Неверный логин или пароль'
          : 'Не удалось войти (проверьте, что сервер запущен)'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
        <div className="cardHeader">
          <div className="cardTitle">Вход</div>
          <div className="cardSub">Доступ только для ограниченного круга лиц</div>
        </div>

        <div className="stack gap-12">
          <label className="field">
            <span>Логин</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>

          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit()
              }}
            />
          </label>

          {error ? (
            <div className="badge danger" style={{ alignSelf: 'flex-start' }}>
              {error}
            </div>
          ) : null}

          <button type="button" className="btn primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Вход…' : 'Войти'}
          </button>

          <div className="cardSub">
            Доступы: <b>admin</b> (полный) и <b>user</b> (только просмотр).
          </div>
        </div>
      </div>
    </div>
  )
}

