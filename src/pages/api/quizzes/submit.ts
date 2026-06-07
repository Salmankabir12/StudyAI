import type { APIRoute } from 'astro'
import { getEnv } from '../../../lib/db'
import { getSessionUser } from '../../../lib/auth'
import { parseBody } from '../../../lib/body'

export const POST: APIRoute = async (context) => {
  const env = getEnv(context)
  const sessionId = context.cookies.get('session')?.value
  const user = sessionId ? await getSessionUser(env.DB, sessionId) : null
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await parseBody(context.request)
  const quizId = Number(body.quiz_id)
  const quiz = await env.DB.prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?').bind(quizId, user.id).first()
  if (!quiz) return new Response('Quiz not found', { status: 404 })

  const questions = await env.DB.prepare('SELECT * FROM questions WHERE quiz_id = ?').bind(quizId).all()
  let score = 0

  for (const q of questions.results) {
    const answer = body[`q_${q.id}`] || ''
    if (answer === q.correct_answer) score++
  }

  const answers = JSON.stringify(body)
  await env.DB.prepare('INSERT INTO attempts (quiz_id, user_id, score, total, answers) VALUES (?, ?, ?, ?, ?)')
    .bind(quizId, user.id, score, questions.results.length, answers).run()

  const percent = Math.round(score / questions.results.length * 100)

  if (percent < 70) {
    try {
      const sugResult = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
        messages: [
          { role: 'system', content: 'Generate a specific study suggestion for a student who scored low on a quiz. Return ONLY JSON: {"title":"short title","description":"specific advice under 100 words"}' },
          { role: 'user', content: `Scored ${score}/${questions.results.length} (${percent}%) on quiz "${quiz.title}"` }
        ]
      })
      const sugText = (sugResult as any).response || '{}'
      const cleaned = sugText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      let sug: any = {}
      try { sug = JSON.parse(cleaned) } catch { sug = { title: 'Review weak areas', description: `Focus on topics from the quiz where you scored ${percent}%. Re-read your notes and practice more.` } }
      await env.DB.prepare('INSERT INTO suggestions (user_id, course_id, type, title, description) VALUES (?, ?, ?, ?, ?)')
        .bind(user.id, quiz.course_id, 'weak_area', sug.title, sug.description).run()
    } catch {}
  }

  return context.redirect(`/quizzes/${quizId}?result=${score}/${questions.results.length}`)
}
