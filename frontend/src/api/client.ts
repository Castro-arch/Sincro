const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

// Suposição (não confirmada contra o Nest real): erro do backend chega como
// JSON { message: string, ... } — é o formato padrão do ValidationPipe/
// exceções do Nest, mas nunca testado por HTTP de verdade aqui. Ver seção
// "Frontend — suposições pendentes de validação" no README raiz.
interface ErrorBody {
  message?: string
  [key: string]: unknown
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
    throw new ApiError(body?.message ?? `Erro ${res.status}`, res.status, body)
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
