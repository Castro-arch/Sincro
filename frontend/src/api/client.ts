const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

// Confirmado contra o backend real em 2026-09-10: o Nest devolve
// { message, error, statusCode }, mas `message` NÃO é sempre string --
// o ValidationPipe manda um array com um item por regra violada
// (["sku should not be empty", "nome must be a string", ...]), enquanto
// NotFoundException, ParseUUIDPipe e os erros repassados do Mercado Livre
// mandam string. Tipar só como string fazia o array cair no
// `super(message)` do Error e virar "a,b,c" grudado -- justamente no caso
// mais comum, que é erro de formulário.
interface ErrorBody {
  message?: string | string[]
  [key: string]: unknown
}

/** Junta as várias mensagens do ValidationPipe numa frase legível. */
function textoDoErro(body: ErrorBody | null, status: number): string {
  const bruto = body?.message
  if (Array.isArray(bruto)) return bruto.join('; ')
  if (typeof bruto === 'string' && bruto.length > 0) return bruto
  return `Erro ${status}`
}

export class ApiError extends Error {
  status: number
  body: ErrorBody | null

  constructor(message: string, status: number, body: ErrorBody | null) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ErrorBody | null
    throw new ApiError(textoDoErro(body, res.status), res.status, body)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(`${API_BASE_URL}${path}`).then(handle<T>)
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(handle<T>)
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle<T>)
}

export function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  return fetch(`${API_BASE_URL}${path}`, { method: 'POST', body: form }).then(handle<T>)
}
