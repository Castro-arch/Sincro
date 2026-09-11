import { apiGet, apiPatch, apiPost, apiPut } from '@/api/client'
import type { MlAttribute, StatusMl } from '@/api/types'

// Espelha AnuncioResumo/VariacaoResumo de src/dashboard/dashboard.service.ts
// e ListingStatus de src/products/entities/listing.entity.ts no backend.

export type ListingStatus = 'rascunho' | 'ativo' | 'pausado' | 'encerrado' | 'erro'

export interface VariacaoResumo {
  variationId: string
  mlVariationId: string | null
  sku: string | null
  descricaoAtributos: string
  preco: number
  estoque: number
  estoqueBaixo: boolean
}

export interface AnuncioResumo {
  listingId: string
  mlItemId: string | null
  titulo: string
  status: ListingStatus
  permalink: string | null
  sku: string
  /** Primeira imagem (id do ML), ou null em rascunho sem foto. */
  imagemId: string | null
  estoqueTotal: number
  precoMinimo: number | null
  temEstoqueBaixo: boolean
  semEstoque: boolean
  sincronizadoEm: string | null
  ultimoErro: string | null
  variacoes: VariacaoResumo[]
}

// Espelha Listing (com relations product+variations) devolvida por
// POST /products, POST /products/:id/publish e PUT /products/:id/status.
export interface Variation {
  id: string
  listingId: string
  mlVariationId: string | null
  sku: string | null
  atributos: MlAttribute[]
  preco: number
  estoque: number
  pictureIds: string[]
}

/** Relation `product` que o backend carrega junto do listing. */
export interface ProdutoDoListing {
  id: string
  sku: string
  nome: string
  descricao: string | null
  custoUnitario: number | null
}

export interface Listing {
  id: string
  productId: string
  product?: ProdutoDoListing
  mlItemId: string | null
  titulo: string
  status: ListingStatus
  categoriaId: string | null
  descricao: string | null
  atributos: MlAttribute[]
  pictureIds: string[]
  permalink: string | null
  ultimoErro: string | null
  sincronizadoEm: string | null
  variations: Variation[]
}

// Espelha CreateProductDto de src/products/dto/create-product.dto.ts.
// `name` no atributo é opcional pro backend, mas o dashboard usa pra
// escrever "Cor: Azul" em vez de "COLOR: Azul" — vale sempre mandar.
export interface NovaVariacao {
  sku?: string
  atributos: MlAttribute[]
  preco: number
  estoque: number
  pictureIds?: string[]
}

export interface NovoProduto {
  sku: string
  nome: string
  descricao?: string
  /** Custo por unidade; alimenta o relatório de Margem. */
  custoUnitario?: number
  titulo?: string
  categoriaId?: string
  atributos?: MlAttribute[]
  pictureIds?: string[]
  variacoes: NovaVariacao[]
}

export function getAnuncios(apenasAtivos = false): Promise<AnuncioResumo[]> {
  return apiGet<AnuncioResumo[]>(`/dashboard/listings${apenasAtivos ? '?apenasAtivos=true' : ''}`)
}

export function getAnuncio(listingId: string): Promise<Listing> {
  return apiGet<Listing>(`/products/${listingId}`)
}

export function publicarListing(listingId: string): Promise<Listing> {
  return apiPost<Listing>(`/products/${listingId}/publish`)
}

export function alterarStatusListing(listingId: string, status: StatusMl): Promise<Listing> {
  return apiPut<Listing>(`/products/${listingId}/status`, { status })
}

export function criarProduto(produto: NovoProduto): Promise<Listing> {
  return apiPost<Listing>('/products', produto)
}

/**
 * Estoque é sempre valor ABSOLUTO, nunca delta — o backend espelha esse
 * número no ML e reverte no banco se o ML recusar.
 */
export function atualizarEstoque(
  variationId: string,
  estoque: number,
  preco?: number,
): Promise<Variation> {
  return apiPut<Variation>(`/products/variations/${variationId}/stock`, { estoque, preco })
}

export function sincronizarListing(listingId: string): Promise<{ sincronizado: boolean }> {
  return apiPost<{ sincronizado: boolean }>(`/products/${listingId}/sync`)
}

// ---------------------------------------------------------------- edicao

export interface VariacaoParaAtualizar {
  variationId?: string
  sku?: string
  atributos?: MlAttribute[]
  preco?: number
  estoque?: number
  pictureIds?: string[]
}

export interface AtualizacaoProduto {
  nome?: string
  descricao?: string
  custoUnitario?: number | null
  titulo?: string
  /** Só aceito em rascunho: o ML recusa mudar categoria de item publicado. */
  categoriaId?: string
  atributos?: MlAttribute[]
  pictureIds?: string[]
  variacoes?: VariacaoParaAtualizar[]
}

export function atualizarProduto(listingId: string, dados: AtualizacaoProduto): Promise<Listing> {
  return apiPatch<Listing>(`/products/${listingId}`, dados)
}

export function atualizarCusto(productId: string, custoUnitario: number | null): Promise<unknown> {
  return apiPatch(`/products/produto/${productId}/custo`, { custoUnitario })
}

/**
 * Pergunta ao ML se publicaria, sem publicar e sem salvar.
 *
 * Manda o rascunho que está na tela: validar o que está no banco responderia
 * sobre a versão antiga, e o usuário corrigiria o formulário só para receber
 * de volta o mesmo erro.
 */
export function validarNoMl(
  listingId: string,
  rascunho?: AtualizacaoProduto,
): Promise<{ valido: boolean; erro: string | null }> {
  return apiPost<{ valido: boolean; erro: string | null }>(
    `/products/${listingId}/validate`,
    rascunho ?? {},
  )
}
