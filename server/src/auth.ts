import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { db } from './db.js'
import type { Request, Response, NextFunction } from 'express'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const TOKEN_TTL = '7d'

export type JwtPayload = {
  sub: string
  username: string
  role: 'admin' | 'user'
}

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
})

export function signToken(username: string) {
  const row = db
    .prepare(`SELECT role FROM users WHERE username = ?`)
    .get(username) as { role: string } | undefined
  const role = row?.role === 'user' ? 'user' : 'admin'
  const payload: JwtPayload = { sub: username, username, role }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET)
  const payload = z.object({ sub: z.string(), username: z.string(), role: z.enum(['admin', 'user']) }).parse(decoded)
  return payload
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') || ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return res.status(401).json({ error: 'unauthorized' })
  try {
    const payload = verifyToken(m[1])
    ;(req as Request & { user?: JwtPayload }).user = payload
    return next()
  } catch {
    return res.status(401).json({ error: 'unauthorized' })
  }
}

export function ensureInitialUser() {
  const upsert = db.prepare(
    `INSERT INTO users (username, password_hash, role, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, role = excluded.role`,
  )

  const adminUser = 'admin'
  const adminPass = 'Tiguan2013!'
  const userUser = 'user'
  const userPass = 'Arina2016'

  const now = new Date().toISOString()
  upsert.run(adminUser, bcrypt.hashSync(adminPass, 10), 'admin', now)
  upsert.run(userUser, bcrypt.hashSync(userPass, 10), 'user', now)
}

export function checkPassword(username: string, password: string) {
  const row = db
    .prepare(`SELECT username, password_hash, role FROM users WHERE username = ?`)
    .get(username) as { username: string; password_hash: string; role: string } | undefined
  if (!row) return false
  const ok = bcrypt.compareSync(password, row.password_hash)
  if (!ok) return false
  return { username: row.username, role: row.role === 'user' ? 'user' : 'admin' } as const
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: JwtPayload }).user
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'forbidden' })
  return next()
}

