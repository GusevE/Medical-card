import { useEffect, useMemo, useRef, useState } from 'react'
import { compressImageFileToDataUrl } from '../lib/file'
import { useAuthStore } from '../store/authStore'
import { useMedicalStore } from '../store/medicalStore'

export function PatientDocsPage() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.role)
  const canEdit = role === 'admin'

  const docs = useMedicalStore((s) => s.patientDocs)
  const loading = useMedicalStore((s) => s.loadingPatientDocs)
  const error = useMedicalStore((s) => s.errorPatientDocs)
  const load = useMedicalStore((s) => s.loadPatientDocs)
  const addDoc = useMedicalStore((s) => s.addPatientDoc)
  const removeDoc = useMedicalStore((s) => s.removePatientDoc)

  const fileRef = useRef<HTMLInputElement | null>(null)
  const [view, setView] = useState<{ id: string; name: string; src: string } | null>(null)

  useEffect(() => {
    if (!token) return
    void load(token)
  }, [token, load])

  const countLabel = useMemo(() => {
    const n = docs.length
    return n === 1 ? '1 документ' : n >= 2 && n <= 4 ? `${n} документа` : `${n} документов`
  }, [docs.length])

  async function onPick(file: File | null) {
    if (!file) return
    if (!token) return
    if (!canEdit) return
    const dataUrl = await compressImageFileToDataUrl(file)
    await addDoc(token, { name: file.name || 'Документ', dataUrl })
  }

  return (
    <div className="stack gap-16">
      <div className="card">
        <div className="cardHeader row between gap-12 wrap">
          <div>
            <div className="cardTitle">Документы</div>
            <div className="cardSub">Общие документы пациента • {countLabel}</div>
          </div>

          <div className="row gap-8 wrap">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onPick(e.currentTarget.files?.[0] ?? null)}
            />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={!canEdit || !token}>
              Добавить документ
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
              <button type="button" className="btn" onClick={() => token && void load(token)} disabled={!token}>
                Повторить
              </button>
            </div>
          </div>
        ) : docs.length === 0 ? (
          <div className="empty">Пока нет документов. Добавьте фото документа выше.</div>
        ) : (
          <div className="docGrid">
            {docs.map((d) => (
              <div key={d.id} className="docCard">
                <button type="button" className="docThumb" onClick={() => setView({ id: d.id, name: d.name, src: d.dataUrl })}>
                  <img src={d.dataUrl} alt={d.name} />
                </button>
                <div className="row between gap-8">
                  <div className="docName" title={d.name}>
                    {d.name}
                  </div>
                  {canEdit ? (
                    <button type="button" className="iconBtn sm" title="Удалить" onClick={() => token && void removeDoc(token, d.id)}>
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {view ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Просмотр документа" onClick={() => setView(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader row between gap-12">
              <div className="modalTitle">{view.name}</div>
              <button type="button" className="iconBtn sm" onClick={() => setView(null)} aria-label="Закрыть">
                ✕
              </button>
            </div>
            <div className="modalBody">
              <img className="docImage" src={view.src} alt={view.name} />
            </div>
            <div className="modalFooter row between gap-12 wrap">
              <a className="btn sm" href={view.src} target="_blank" rel="noreferrer">
                Открыть в новой вкладке
              </a>
              <button type="button" className="btn sm ghost" onClick={() => setView(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

