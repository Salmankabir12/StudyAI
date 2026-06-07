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

  let questions: any[] = []
  try {
    if (!env.AI) {
      console.error('AI binding missing')
    } else {
      const aiResult = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
        messages: [
          { role: 'system', content: 'Summarize the following study notes concisely. Highlight key concepts and definitions. Keep under 150 words.' },
          { role: 'user', content }
        ]
      })
      const summary = (aiResult as any).response || JSON.stringify(aiResult)

      await env.DB.prepare('UPDATE notes SET ai_summary = ? WHERE id = ?').bind(summary, noteId).run()

      const quizModels = ['@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.2-3b-instruct']
      for (const model of quizModels) {
        try {
          const quizResult = await env.AI.run(model, {
            messages: [
              { role: 'system', content: 'Generate exactly 3 multiple-choice questions. Return ONLY a JSON array, no markdown, no extra text. Format: [{"question":"...","options":["A) a","B) b","C) c","D) d"],"correct":"A) a","topic":"..."}]' },
              { role: 'user', content: `Topic: ${title}\n${content.substring(0, 1000)}` }
            ]
          })
          const raw = ((quizResult as any).response || '').trim()
          const start = raw.indexOf('[')
          const end = raw.lastIndexOf(']')
          const json = start !== -1 && end >= start ? raw.slice(start, end + 1) : ''
          if (json) {
            try { questions = JSON.parse(json) } catch {
              try { questions = JSON.parse(json.replace(/'/g, '"')) } catch {}
            }
          }
          if (questions.length > 0) break
        } catch (e) {
          console.error(`${model} failed:`, e)
        }
      }

      if (questions.length > 0) {
        const quizResult2 = await env.DB.prepare('INSERT INTO quizzes (course_id, user_id, note_id, title) VALUES (?, ?, ?, ?)').bind(courseId, user.id, noteId, `${title} Quiz`).run()
        const quizId = Number(quizResult2.meta.last_row_id)

        for (const q of questions) {
          await env.DB.prepare('INSERT INTO questions (quiz_id, question_text, options, correct_answer, topic) VALUES (?, ?, ?, ?, ?)')
            .bind(quizId, q.question, JSON.stringify(q.options), q.correct, q.topic || '').run()
        }
      }
    }
  } catch (e) {
    console.error('AI generation failed:', e)
  }

  return context.redirect(`/notes/${noteId}`)
}
