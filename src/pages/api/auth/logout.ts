import type { APIRoute } from 'astro'
import { getEnv } from '../../../lib/db'
import { destroySession } from '../../../lib/auth'

export const GET: APIRoute = async (context) => {
  const env = getEnv(context)
  const sessionId = context.cookies.get('session')?.value
  if (sessionId) {
    await destroySession(env.DB, sessionId)
  }
  context.cookies.delete('session', { path: '/' })
  return context.redirect('/')
}
