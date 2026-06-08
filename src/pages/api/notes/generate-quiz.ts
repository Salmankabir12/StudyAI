import type { APIRoute } from 'astro'
import { getEnv } from '../../../lib/db'
import { getSessionUser } from '../../../lib/auth'

export const GET: APIRoute = async (context) => {
  const env = getEnv(context)
  const sessionId = context.cookies.get('session')?.value
  const user = sessionId ? await getSessionUser(env.DB, sessionId) : null
  if (!user) return context.redirect('/login')

  const noteId = Number(context.url.searchParams.get('note_id'))
  if (!noteId) return context.redirect('/dashboard')

  const note = await env.DB.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').bind(noteId, user.id).first() as any
  if (!note) return context.redirect('/dashboard')

  if (!env.AI) return context.redirect(`/notes/${noteId}`)

  const title = note.title as string
  const content = note.content as string

  for (const model of ['@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.2-3b-instruct']) {
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
      if (!json) continue
      let questions: any[] = []
      try { questions = JSON.parse(json) } catch {
        try { questions = JSON.parse(json.replace(/'/g, '"')) } catch {}
      }
      if (questions.length === 0) continue

      const quizResult2 = await env.DB.prepare('INSERT INTO quizzes (course_id, user_id, note_id, title) VALUES (?, ?, ?, ?)').bind(note.course_id, user.id, noteId, `${title} Quiz`).run()
      const quizId = Number(quizResult2.meta.last_row_id)

      const stmt = env.DB.prepare('INSERT INTO questions (quiz_id, question_text, options, correct_answer, topic) VALUES (?, ?, ?, ?, ?)')
      for (const q of questions) {
        await stmt.bind(quizId, q.question, JSON.stringify(q.options), q.correct, q.topic || '').run()
      }
      break
    } catch (e) {
      console.error(`${model} failed:`, e)
    }
  }

  return context.redirect(`/notes/${noteId}`)
}
