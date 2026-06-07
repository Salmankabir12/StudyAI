import type { APIRoute } from 'astro'
import { getEnv } from '../../../lib/db'
import { verifyPassword, createSession } from '../../../lib/auth'
import { parseBody } from '../../../lib/body'

export const POST: APIRoute = async (context) => {
  const env = getEnv(context)
  const body = await parseBody(context.request)
  const email = body.email?.trim().toLowerCase()
  const password = body.password

  if (!email || !password) {
    return context.redirect('/login?error=All fields required')
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
  if (!user || !verifyPassword(password, user.password_hash as string)) {
    return context.redirect('/login?error=Invalid email or password')
  }

  const sessionId = await createSession(env.DB, user.id as number)
  context.cookies.set('session', sessionId, { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 * 7 })

  return context.redirect('/dashboard')
}
