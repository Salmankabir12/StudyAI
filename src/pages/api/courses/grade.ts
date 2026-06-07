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
  const courseId = Number(body.course_id)
  const grade = body.grade || ''

  await env.DB.prepare('UPDATE courses SET current_grade = ? WHERE id = ? AND user_id = ?').bind(grade || null, courseId, user.id).run()

  return context.redirect('/grades')
}
