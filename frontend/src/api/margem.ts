import { apiGet, apiPut } from '@/api/client'

// Espelha RelatorioMargem de src/margem/margem.service.ts no backend.

export interface LinhaMargem {
  productId: string | null
  listingId: string | null
  sku: string
  titulo: string
  imagemId: string | null
  unidadesVendidas: number
  receitaBruta: number
  taxaMl: number
  /** false = a taxa desta linha é estimativa, não a comissão que o ML cobrou. */
  taxaReal: boolean
  imposto: number
  custoTotal: number
  /** false = produto sem custo cadastrado; o lucro desta linha está superestimado. */
  custoInformado: boolean
  lucro: number
  margemPercentual: number | null
}

export interface RelatorioMargem {
  dias: number
  impostoPercentual: number
  totais: {
    receitaBruta: number
    taxaMl: number
    imposto: number
    custoTotal: number
    lucro: number
    margemPercentual: number | null
    produtosSemCusto: number
  }
  linhas: LinhaMargem[]
}

export function getMargem(dias: number): Promise<RelatorioMargem> {
  return apiGet<RelatorioMargem>(`/margem?dias=${dias}`)
}

export function getImposto(): Promise<{ percentual: number }> {
  return apiGet<{ percentual: number }>('/configuracoes/imposto')
}

export function definirImposto(percentual: number): Promise<{ percentual: number }> {
  return apiPut<{ percentual: number }>('/configuracoes/imposto', { percentual })
}
