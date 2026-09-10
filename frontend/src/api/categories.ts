import { apiGet } from '@/api/client'

// Espelha MlCategoryPrediction de src/mercado-livre/ml-api.types.ts e
// AtributoObrigatorio de src/mercado-livre/categories/ml-category.service.ts.

export interface CategoriaSugerida {
  category_id: string
  category_name: string
  domain_id?: string
  domain_name?: string
}

export interface ValorPermitido {
  id: string
  nome: string
}

export interface AtributoDaCategoria {
  id: string
  nome: string
  tipoValor: string
  obrigatorio: boolean
  somenteNaCriacao: boolean
  /** Quando true, o valor vai na variação (attribute_combinations), não no item. */
  usadoEmVariacoes: boolean
  valoresPermitidos: ValorPermitido[] | null
  unidadesPermitidas: ValorPermitido[] | null
  dica: string | null
}

export function preverCategoria(titulo: string, limite = 5): Promise<CategoriaSugerida[]> {
  const params = new URLSearchParams({ titulo, limite: String(limite) })
  return apiGet<CategoriaSugerida[]>(`/ml/categories/predict?${params.toString()}`)
}

export function getAtributosDaCategoria(
  categoriaId: string,
  apenasObrigatorios = false,
): Promise<AtributoDaCategoria[]> {
  const sufixo = apenasObrigatorios ? '?apenasObrigatorios=true' : ''
  return apiGet<AtributoDaCategoria[]>(`/ml/categories/${categoriaId}/attributes${sufixo}`)
}
