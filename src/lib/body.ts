export async function parseBody(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const data = await request.json() as Record<string, any>
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(data)) {
      result[k] = v?.toString() || ''
    }
    return result
  }
  const formData = await request.formData()
  const result: Record<string, string> = {}
  for (const [k, v] of formData.entries()) {
    result[k] = v.toString()
  }
  return result
}
