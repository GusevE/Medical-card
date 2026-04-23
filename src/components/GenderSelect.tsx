import { useEffect, useMemo, useRef, useState } from 'react'
import type { Gender } from '../store/medicalStore'

const OPTIONS: { value: Gender; label: string }[] = [
  { value: 'М', label: 'М' },
  { value: 'Ж', label: 'Ж' },
  { value: 'Другое', label: 'Другое' },
]

export function GenderSelect(props: { value: Gender; onChange: (v: Gender) => void }) {
  const { value, onChange } = props
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const currentLabel = useMemo(
    () => OPTIONS.find((o) => o.value === value)?.label ?? value,
    [value],
  )

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = rootRef.current
      if (!el) return
      if (e.target instanceof Node && el.contains(e.target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="select" ref={rootRef}>
      <button
        type="button"
        className="selectTrigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{currentLabel}</span>
        <span className="selectChevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="selectMenu" role="listbox" aria-label="Пол">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`selectOption ${o.value === value ? 'active' : ''}`}
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

