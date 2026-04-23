import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { db, migrate } from './db.js'
import {
  checkPassword,
  ensureInitialUser,
  loginSchema,
  requireAdmin,
  requireAuth,
  signToken,
} from './auth.js'

const PORT = Number(process.env.PORT || 5174)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const DEV_ORIGIN_RE = /^http:\/\/localhost:\d+$/i

migrate()
ensureInitialUser()

const app = express()
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (origin === CLIENT_ORIGIN) return cb(null, true)
      if (DEV_ORIGIN_RE.test(origin)) return cb(null, true)
      return cb(new Error('Not allowed by CORS'))
    },
    credentials: false,
  }),
)
app.use(express.json({ limit: '5mb' }))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.post('/auth/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'bad_request' })

  const { username, password } = parsed.data
  const user = checkPassword(username, password)
  if (!user) return res.status(401).json({ error: 'invalid_credentials' })

  const token = signToken(username)
  return res.json({ token, username: user.username, role: user.role })
})

app.get('/auth/me', requireAuth, (req, res) => {
  const user = (req as any).user as { username: string } | undefined
  return res.json({ username: user?.username ?? 'unknown', role: (user as any)?.role ?? 'admin' })
})

const patientSchema = z.object({
  fullName: z.string().min(1).max(200),
  birthDate: z.string().min(4).max(20),
  gender: z.string().min(1).max(20),
  phone: z.string().max(50),
  address: z.string().max(300),
  notes: z.string().max(2000),
  photoDataUrl: z.string().nullable(),
})

function ensurePatientRow() {
  const row = db
    .prepare(`SELECT id, full_name, birth_date, phone, address, notes, photo_data_url FROM patient WHERE id = 1`)
    .get() as
    | { id: 1; full_name: string; birth_date: string; photo_data_url: string | null }
    | undefined
  if (row) {
    const defaults = {
      fullName: 'Гусева Арина Евгеньевна',
      birthDate: '2016-06-08',
      gender: 'Ж',
      phone: '89157090027',
      address: 'г Тверь, Мигаловская набережная, д 2Б, кв 50',
      notes: 'Родители:\nОтец: Гусев Евгений Николаевич\nМать: Гусева Ольга Викторовна',
      photoDataUrl: '/patient.png',
    }

    const isOldSeed =
      row.full_name === 'Иванов Иван Иванович' &&
      row.birth_date === '1990-01-01' &&
      (row.photo_data_url === null || row.photo_data_url === '')
    if (isOldSeed) {
      db.prepare(
        `UPDATE patient
         SET full_name = ?, birth_date = ?, gender = ?, phone = ?, address = ?, notes = ?, photo_data_url = ?
         WHERE id = 1`,
      ).run(
        defaults.fullName,
        defaults.birthDate,
        defaults.gender,
        defaults.phone,
        defaults.address,
        defaults.notes,
        defaults.photoDataUrl,
      )
    }

    const needsFill =
      String((row as any).phone || '').trim() === '' ||
      String((row as any).address || '').trim() === '' ||
      String((row as any).notes || '').trim() === ''
    if (needsFill) {
      db.prepare(
        `UPDATE patient
         SET phone = CASE WHEN TRIM(phone) = '' THEN ? ELSE phone END,
             address = CASE WHEN TRIM(address) = '' THEN ? ELSE address END,
             notes = CASE WHEN TRIM(notes) = '' THEN ? ELSE notes END
         WHERE id = 1`,
      ).run(defaults.phone, defaults.address, defaults.notes)
    }
    return
  }
  db.prepare(
    `INSERT INTO patient (id, full_name, birth_date, gender, phone, address, notes, photo_data_url)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'Гусева Арина Евгеньевна',
    '2016-06-08',
    'Ж',
    '89157090027',
    'г Тверь, Мигаловская набережная, д 2Б, кв 50',
    'Родители:\nОтец: Гусев Евгений Николаевич\nМать: Гусева Ольга Викторовна',
    '/patient.png',
  )
}

app.get('/patient', requireAuth, (_req, res) => {
  ensurePatientRow()
  const row = db
    .prepare(
      `SELECT full_name, birth_date, gender, phone, address, notes, photo_data_url FROM patient WHERE id = 1`,
    )
    .get() as any

  return res.json({
    fullName: row.full_name,
    birthDate: row.birth_date,
    gender: row.gender,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    photoDataUrl: row.photo_data_url ?? null,
  })
})

app.put('/patient', requireAuth, requireAdmin, (req, res) => {
  const parsed = patientSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'bad_request' })
  ensurePatientRow()

  const p = parsed.data
  db.prepare(
    `UPDATE patient
     SET full_name = ?, birth_date = ?, gender = ?, phone = ?, address = ?, notes = ?, photo_data_url = ?
     WHERE id = 1`,
  ).run(p.fullName, p.birthDate, p.gender, p.phone, p.address, p.notes, p.photoDataUrl)

  return res.json({ ok: true })
})

const examCreateSchema = z.object({
  title: z.string().min(1).max(300),
  deadline: z.string().max(20),
  category: z.string().max(60).optional().default(''),
  validityDays: z.number().int().min(0).max(3650).optional().default(0),
})

const examBulkSchema = z.object({
  items: z.array(examCreateSchema).min(1).max(200),
})

const examStatusSchema = z.object({
  status: z.enum(['todo', 'referral', 'submitted', 'done', 'result']),
})

app.get('/exams', requireAuth, (req, res) => {
  const date = String(req.query.date || '')
  if (!date) return res.status(400).json({ error: 'date_required' })

  // Seed default checklist for our case if date is empty
  const existing = db
    .prepare(`SELECT COUNT(*) as c FROM exam_items WHERE exam_date = ?`)
    .get(date) as { c: number }
  if (existing.c === 0) {
    const defaults: Array<{ title: string; deadline: string; category: string; validityDays: number }> = [
      // Документы/справки
      {
        category: 'Документы',
        validityDays: 0,
        deadline: date,
        title: 'Направление на госпитализацию (ОМС) / форма №057у-04',
      },
      { category: 'Документы', validityDays: 0, deadline: date, title: 'Копия свидетельства о рождении ребёнка' },
      { category: 'Документы', validityDays: 0, deadline: date, title: 'Полис ОМС и СНИЛС (с копиями)' },
      {
        category: 'Документы',
        validityDays: 0,
        deadline: date,
        title: 'Выписка/амбулаторная карта, результаты обследований (рентген/КТ/МРТ) по основному заболеванию',
      },
      { category: 'Документы', validityDays: 0, deadline: date, title: 'Амбулаторная карта ребёнка (если есть)' },
      {
        category: 'Документы',
        validityDays: 0,
        deadline: date,
        title: 'Справка об отсутствии контакта с инфекционными больными (21 день, действительна 3 дня)',
      },
      {
        category: 'Документы',
        validityDays: 0,
        deadline: date,
        title: 'Справка из детского учреждения (ДОУ/школа/ВУЗ и т.д.)',
      },
      { category: 'Документы', validityDays: 0, deadline: date, title: 'Заключение от стоматолога (выполнено в последние дни)' },
      {
        category: 'Документы',
        validityDays: 0,
        deadline: date,
        title: 'Справка о ПЦР (при необходимости по требованиям отделения)',
      },
      // Прививки / фтизиатрия
      {
        category: 'Прививки',
        validityDays: 0,
        deadline: date,
        title: 'Сведения о прививках (прививочный сертификат/карта) по нац. календарю',
      },
      { category: 'Прививки', validityDays: 0, deadline: date, title: 'Сведения о БЦЖ' },
      {
        category: 'Фтизиатрия',
        validityDays: 0,
        deadline: date,
        title: 'Манту (не старше 1 года) или Диаскинтест (не старше 3 мес) / заключение фтизиатра',
      },
      { category: 'Фтизиатрия', validityDays: 0, deadline: date, title: 'Рентген грудной клетки (не старше 1 года) + заключение' },
      // Анализы (обычно 14 дней)
      { category: 'Анализы (14 дней)', validityDays: 14, deadline: date, title: 'Клинический анализ крови' },
      {
        category: 'Анализы (14 дней)',
        validityDays: 14,
        deadline: date,
        title: 'Биохимический анализ крови (АЛТ, АСТ, общий билирубин, общий белок, мочевина, креатинин, K, Na, глюкоза)',
      },
      { category: 'Анализы (14 дней)', validityDays: 14, deadline: date, title: 'Коагулограмма (МНО, АЧТВ, фибриноген, ПТИ)' },
      { category: 'Анализы (14 дней)', validityDays: 14, deadline: date, title: 'Общий анализ мочи' },
      { category: 'Анализы', validityDays: 0, deadline: date, title: 'Соскоб на энтеробиоз' },
      { category: 'Анализы', validityDays: 0, deadline: date, title: 'Анализы на гельминтозы и кишечные протозоозы' },
      // Обследования
      { category: 'Обследования', validityDays: 0, deadline: date, title: 'ЭКГ с расшифровкой и заключением (срок годности 1 мес)' },
      { category: 'Обследования', validityDays: 0, deadline: date, title: 'УЗИ органов брюшной полости и УЗИ почек (срок годности 1 мес)' },
      { category: 'Анализы', validityDays: 0, deadline: date, title: 'Кровь на маркеры гепатитов B/C и ВИЧ, RW (срок по требованиям клиники)' },
    ]

    const stmt = db.prepare(
      `INSERT OR IGNORE INTO exam_items (exam_date, title, deadline, status, category, validity_days, done, done_at)
       VALUES (?, ?, ?, 'todo', ?, ?, 0, '')`,
    )
    const tx = db.transaction(() => {
      for (const it of defaults) {
        stmt.run(date, it.title.trim(), it.deadline || '', it.category || '', it.validityDays || 0)
      }
    })
    tx()
  }

  const items = db
    .prepare(
      `SELECT id, exam_date, title, deadline, status, category, validity_days, done, done_at
       FROM exam_items
       WHERE exam_date = ?
       ORDER BY id DESC`,
    )
    .all(date) as any[]

  return res.json(
    items.map((r) => ({
      id: String(r.id),
      date: r.exam_date,
      title: r.title,
      deadline: r.deadline,
      status: r.status || (r.done ? 'done' : 'todo'),
      category: r.category || '',
      validityDays: Number(r.validity_days || 0),
      doneAt: r.done_at,
    })),
  )
})

app.post('/exams', requireAuth, requireAdmin, (req, res) => {
  const date = String(req.query.date || '')
  if (!date) return res.status(400).json({ error: 'date_required' })

  const parsed = examCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'bad_request' })

  const { title, deadline, category, validityDays } = parsed.data
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO exam_items (exam_date, title, deadline, status, category, validity_days, done, done_at)
       VALUES (?, ?, ?, 'todo', ?, ?, 0, '')`,
    )
    .run(date, title.trim(), deadline || '', category || '', validityDays || 0)

  return res.json({ id: String(info.lastInsertRowid) })
})

app.post('/exams/bulk', requireAuth, requireAdmin, (req, res) => {
  const date = String(req.query.date || '')
  if (!date) return res.status(400).json({ error: 'date_required' })

  const parsed = examBulkSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'bad_request' })

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO exam_items (exam_date, title, deadline, status, category, validity_days, done, done_at)
     VALUES (?, ?, ?, 'todo', ?, ?, 0, '')`,
  )
  const tx = db.transaction((items: Array<z.infer<typeof examCreateSchema>>) => {
    for (const it of items) {
      stmt.run(date, it.title.trim(), it.deadline || '', it.category || '', it.validityDays || 0)
    }
  })
  tx(parsed.data.items)
  return res.json({ ok: true })
})

app.patch('/exams/:id/toggle', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  const row = db
    .prepare(`SELECT id, status, done FROM exam_items WHERE id = ?`)
    .get(id) as { id: number; status: string; done: number } | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })

  const isDone = row.status === 'done' || row.status === 'result' || row.done === 1
  const nextStatus = isDone ? 'todo' : 'done'
  const doneAt = nextStatus === 'done' ? new Date().toISOString() : ''
  db.prepare(`UPDATE exam_items SET status = ?, done = ?, done_at = ? WHERE id = ?`).run(
    nextStatus,
    nextStatus === 'done' ? 1 : 0,
    doneAt,
    id,
  )
  return res.json({ ok: true })
})

app.patch('/exams/:id/status', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  const parsed = examStatusSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'bad_request' })
  const status = parsed.data.status
  const doneAt = status === 'done' || status === 'result' ? new Date().toISOString() : ''
  const done = status === 'done' || status === 'result' ? 1 : 0
  const info = db
    .prepare(`UPDATE exam_items SET status = ?, done = ?, done_at = ? WHERE id = ?`)
    .run(status, done, doneAt, id)
  if (info.changes === 0) return res.status(404).json({ error: 'not_found' })
  return res.json({ ok: true })
})

app.delete('/exams/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  db.prepare(`DELETE FROM exam_items WHERE id = ?`).run(id)
  return res.json({ ok: true })
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`)
  // eslint-disable-next-line no-console
  console.log(`CORS origin: ${CLIENT_ORIGIN}`)
  // eslint-disable-next-line no-console
  console.log(`Default user (if DB empty): admin / admin123 (change via ADMIN_USER/ADMIN_PASS)`)
})

