import { apiGet } from '@/api/client'

// Espelha VisaoGeral / AlertaEstoque / MlAuthStatus de src/dashboard/dashboard.service.ts
// e src/mercado-livre/auth/ml-auth.service.ts no backend. Datas chegam como string (JSON).

export interface ConexaoMl {
  conectado: boolean
  mlUserId: string | null
  nickname: string | null
  expiraEm: string | null
  expirado: boolean
  segundosParaExpirar: number | null
}

export interface AlertaEstoque {
  listingId: string
  mlItemId: string | null
  titulo: string
  variationId: string
  sku: string | null
  descricaoAtributos: string
  estoque: number
  severidade: 'sem-estoque' | 'estoque-baixo'
}

export interface VisaoGeral {
  conexaoMl: ConexaoMl
  totais: {
    anuncios: number
    anunciosAtivos: number
    rascunhos: number
    comErro: number
    variacoes: number
    estoqueTotal: number
    pedidos30Dias: number
    faturamento30Dias: number
  }
  alertas: AlertaEstoque[]
}

export function getVisaoGeral(): Promise<VisaoGeral> {
  return apiGet<VisaoGeral>('/dashboard')
}
