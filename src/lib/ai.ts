interface Env {
  DB: D1Database
  AI: any
}

export async function generateSummary(env: Env, content: string): Promise<string> {
  const result = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
    messages: [
      { role: 'system', content: 'Summarize the following study notes concisely. Highlight key concepts, definitions, and formulas. Keep it under 150 words.' },
      { role: 'user', content }
    ]
  })
  return (result as any).response || ''
}

export async function generateQuiz(env: Env, content: string, noteTitle: string): Promise<any[]> {
  const result = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
    messages: [
      { role: 'system', content: `Generate 5 multiple-choice questions based on these study notes about "${noteTitle}". Return ONLY valid JSON array format: [{"question": "...", "options": ["A) ...","B) ...","C) ...","D) ..."], "correct": "A) ...", "topic": "..."}]` },
      { role: 'user', content }
    ]
  })
  const text = (result as any).response || '[]'
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return []
  }
}

export async function generateSuggestion(env: Env, context: string): Promise<{ title: string; description: string }> {
  const result = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
    messages: [
      { role: 'system', content: 'Based on the student\'s context below, generate one specific actionable study suggestion. Return ONLY JSON: {"title": "short title", "description": "specific advice under 100 words"}' },
      { role: 'user', content: context }
    ]
  })
  const text = (result as any).response || '{}'
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return { title: 'Review your notes', description: 'Keep studying consistently to improve your understanding.' }
  }
}
