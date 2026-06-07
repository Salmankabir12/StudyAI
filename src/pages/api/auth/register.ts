import type { APIRoute } from 'astro'
import { getEnv } from '../../../lib/db'
import { hashPassword, createSession } from '../../../lib/auth'
import { parseBody } from '../../../lib/body'

export const POST: APIRoute = async (context) => {
  const env = getEnv(context)
  const body = await parseBody(context.request)
  const name = body.name?.trim()
  const email = body.email?.trim().toLowerCase()
  const password = body.password

  if (!name || !email || !password || password.length < 6) {
    return context.redirect('/register?error=Invalid input')
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) {
    return context.redirect('/register?error=Email already registered')
  }

  const passwordHash = hashPassword(password)
  const result = await env.DB.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').bind(name, email, passwordHash).run()

  const sessionId = await createSession(env.DB, Number(result.meta.last_row_id))
  context.cookies.set('session', sessionId, { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 * 7 })

  return context.redirect('/dashboard')
}
