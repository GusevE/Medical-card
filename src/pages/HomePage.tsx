import { useMemo, useRef, useState } from 'react'
import { GenderSelect } from '../components/GenderSelect'
import { fileToDataUrl } from '../lib/file'
import { useAuthStore } from '../store/authStore'
import { type Gender, useMedicalStore } from '../store/medicalStore'

export function HomePage() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.role)
  const canEdit = role === 'admin'
  const patient = useMedicalStore((s) => s.patient)
  const loadingPatient = useMedicalStore((s) => s.loadingPatient)
  const savePatient = useMedicalStore((s) => s.savePatient)
  const setPatientPhoto = useMedicalStore((s) => s.setPatientPhoto)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const initials = useMemo(() => {
    const parts = (patient?.fullName ?? '').trim().split(/\s+/).filter(Boolean)
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  }, [patient?.fullName])

  const photoSrc = useMemo(() => {
    const v = patient?.photoDataUrl
    if (!v) return null
    if (/^data:/i.test(v)) return v
    if (/^https?:\/\//i.test(v)) return v
    // GitHub Pages is served under BASE_URL (e.g. /Medical-card/)
    if (v.startsWith('/')) return `${import.meta.env.BASE_URL}${v.slice(1)}`
    return `${import.meta.env.BASE_URL}${v}`
  }, [patient?.photoDataUrl])

  async function onPickPhoto(file: File | null) {
    if (!file) return
    if (!token) return
    setPhotoBusy(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      await setPatientPhoto(token, dataUrl)
    } finally {
      setPhotoBusy(false)
    }
  }

  if (loadingPatient || !patient) {
    return (
      <div className="stack gap-16">
        <div className="card">
          <div className="cardTitle">Пациент</div>
          <div className="cardSub">Загрузка…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="stack gap-16">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="cardTitle">Пациент</div>
            <div className="cardSub">Фото и основные данные</div>
          </div>
        </div>

        <div className="grid2 gap-16">
          <div className="photoBlock">
            <div className="avatar">
              {photoSrc ? (
                <img src={photoSrc} alt="Фото пациента" />
              ) : (
                <div className="avatarFallback" aria-label="Фото отсутствует">
                  {initials || '👤'}
                </div>
              )}
            </div>

            <div className="row gap-8 wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void onPickPhoto(e.currentTarget.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                type="button"
                className="btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoBusy || !canEdit}
              >
                {photoBusy ? 'Загрузка…' : 'Загрузить фото'}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => token && void setPatientPhoto(token, null)}
                disabled={!patient.photoDataUrl || photoBusy || !canEdit}
              >
                Удалить
              </button>
            </div>
          </div>

          <div className="stack gap-12">
            <div className="grid2 gap-12">
              <label className="field">
                <span>ФИО</span>
                <input
                  value={patient.fullName}
                  onChange={(e) => token && canEdit && void savePatient(token, { fullName: e.target.value })}
                  placeholder="Фамилия Имя Отчество"
                  disabled={!canEdit}
                />
              </label>

              <label className="field">
                <span>Дата рождения</span>
                <input
                  type="date"
                  value={patient.birthDate}
                  onChange={(e) => token && canEdit && void savePatient(token, { birthDate: e.target.value })}
                  disabled={!canEdit}
                />
              </label>
            </div>

            <div className="grid2 gap-12">
              <label className="field">
                <span>Пол</span>
                <GenderSelect
                  value={patient.gender as Gender}
                  onChange={(g) => token && canEdit && void savePatient(token, { gender: g })}
                />
              </label>

              <label className="field">
                <span>Телефон</span>
                <input
                  value={patient.phone}
                  onChange={(e) => token && canEdit && void savePatient(token, { phone: e.target.value })}
                  placeholder="+7 …"
                  disabled={!canEdit}
                />
              </label>
            </div>

            <label className="field">
              <span>Адрес</span>
              <input
                value={patient.address}
                onChange={(e) => token && canEdit && void savePatient(token, { address: e.target.value })}
                placeholder="Город, улица, дом"
                disabled={!canEdit}
              />
            </label>

            <label className="field">
              <span>Заметки</span>
              <textarea
                value={patient.notes}
                onChange={(e) => token && canEdit && void savePatient(token, { notes: e.target.value })}
                rows={4}
                placeholder="Аллергии, хронические заболевания, контакты…"
                disabled={!canEdit}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

