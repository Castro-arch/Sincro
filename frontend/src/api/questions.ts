import { apiGet, apiPost } from '@/api/client'

// Espelha Question de src/questions/entities/question.entity.ts. O shape de
// cada pergunta no ML vem da doc (api_version=4) e ainda nao foi observado
// numa pergunta real -- ver nota em src/mercado-livre/ml-api.types.ts.

export type QuestionStatus =
  | 'UNANSWERED'
  | 'ANSWERED'
  | 'CLOSED_UNANSWERED'
  | 'UNDER_REVIEW'
  | 'BANNED'
  | 'DELETED'
  | 'DISABLED'

export interface AnuncioDaPergunta {
  id: string
  titulo: string
  mlItemId: string | null
  permalink: string | null
  pictureIds: string[]
}

export interface Pergunta {
  id: string
  mlQuestionId: string
  mlItemId: string
  listingId: string | null
  fromUserId: string | null
  texto: string
  status: QuestionStatus
  respostaTexto: string | null
  respostaStatus: string | null
  respondidaEm: string | null
  respondidaPeloSincro: boolean
  dataPergunta: string
  listing: AnuncioDaPergunta | null
}

export interface ResultadoSincronizacaoPerguntas {
  lidasNoMl: number
  novas: number
  atualizadas: number
  reconciliadas: number
}

export const TAMANHO_MAXIMO_RESPOSTA = 2000

export function getPerguntas(apenasPendentes: boolean): Promise<Pergunta[]> {
  return apiGet<Pergunta[]>(`/questions?status=${apenasPendentes ? 'pendentes' : 'todas'}`)
}

export function getPendentes(): Promise<{ pendentes: number }> {
  return apiGet<{ pendentes: number }>('/questions/pending-count')
}

export function responderPergunta(id: string, texto: string): Promise<Pergunta> {
  return apiPost<Pergunta>(`/questions/${id}/answer`, { texto })
}

export function sincronizarPerguntas(): Promise<ResultadoSincronizacaoPerguntas> {
  return apiPost<ResultadoSincronizacaoPerguntas>('/questions/sync')
}
