import type { APIRoute } from 'astro'
import { getEnv } from '../../../lib/db'
import { getSessionUser } from '../../../lib/auth'
import { parseBody } from '../../../lib/body'

export const POST: APIRoute = async (context) => {
  const env = getEnv(context)
  const sessionId = context.cookies.get('session')?.value
  const user = sessionId ? await getSessionUser(env.DB, sessionId) : null
  if (!user) return context.redirect('/login')

  const body = await parseBody(context.request)
  const name = body.name?.trim()
  const semester = body.semester?.trim() || ''
  const credits = Number(body.credits) || 3
  const targetGrade = body.target_grade || 'A'

  if (!name) return context.redirect('/courses/new?error=Course name required')

  await env.DB.prepare('INSERT INTO courses (user_id, name, semester, credits, target_grade) VALUES (?, ?, ?, ?, ?)')
    .bind(user.id, name, semester, credits, targetGrade).run()

  return context.redirect('/dashboard')
}
