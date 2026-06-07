import { getDB } from './db'

export function hashPassword(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return btoa(hash.toString() + password.length.toString(16))
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

export function generateId(): string {
  return crypto.randomUUID()
}

export async function createSession(DB: D1Database, userId: number): Promise<string> {
  const id = generateId()
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(id, userId, expires).run()
  return id
}

export async function getSessionUser(DB: D1Database, sessionId: string): Promise<any> {
  const session = await DB.prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").bind(sessionId).first()
  if (!session) return null
  return await DB.prepare('SELECT id, name, email FROM users WHERE id = ?').bind(session.user_id).first()
}

export async function destroySession(DB: D1Database, sessionId: string): Promise<void> {
  await DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
}
