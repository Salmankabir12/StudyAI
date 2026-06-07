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
  const title = body.title?.trim()
  const content = body.content?.trim()

  if (!courseId || !title || !content) {
    return context.redirect(`/notes/new?course=${courseId}&error=All fields required`)
  }

  const course = await env.DB.prepare('SELECT id FROM courses WHERE id = ? AND user_id = ?').bind(courseId, user.id).first()
  if (!course) return context.redirect('/dashboard')

  const result = await env.DB.prepare('INSERT INTO notes (course_id, user_id, title, content) VALUES (?, ?, ?, ?)').bind(courseId, user.id, title, content).run()
  const noteId = Number(result.meta.last_row_id)

  try {
    const aiResult = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        { role: 'system', content: 'Summarize the following study notes concisely. Highlight key concepts and definitions. Keep under 150 words.' },
        { role: 'user', content }
      ]
    })
    const summary = (aiResult as any).response || ''

    await env.DB.prepare('UPDATE notes SET ai_summary = ? WHERE id = ?').bind(summary, noteId).run()

    const quizResult = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        { role: 'system', content: `Generate 5 multiple-choice questions based on these notes about "${title}". Return ONLY valid JSON array: [{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correct":"A) ...","topic":"..."}]` },
        { role: 'user', content }
      ]
    })
    const quizText = (quizResult as any).response || '[]'
    const cleaned = quizText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const questions = JSON.parse(cleaned)

    if (questions.length > 0) {
      const quizResult2 = await env.DB.prepare('INSERT INTO quizzes (course_id, user_id, note_id, title) VALUES (?, ?, ?, ?)').bind(courseId, user.id, noteId, `${title} Quiz`).run()
      const quizId = Number(quizResult2.meta.last_row_id)

      for (const q of questions) {
        await env.DB.prepare('INSERT INTO questions (quiz_id, question_text, options, correct_answer, topic) VALUES (?, ?, ?, ?, ?)')
          .bind(quizId, q.question, JSON.stringify(q.options), q.correct, q.topic || '').run()
      }
    }
  } catch (e) {
    console.error('AI generation failed:', e)
  }

  return context.redirect(`/notes/${noteId}`)
}
