export interface Env {
  DB: D1Database
  AI: any
}

export function getEnv(context: any): Env {
  return context.locals.runtime.env as Env
}

export async function queryDB(env: Env, sql: string, params: any[] = []): Promise<any> {
  const stmt = env.DB.prepare(sql)
  if (params.length > 0) stmt.bind(...params)
  const result = await stmt.run()
  return result
}

export async function getDB(env: Env): Promise<D1Database> {
  return env.DB
}
