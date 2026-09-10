import { apiGet, apiPost, apiPut } from '@/api/client'
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

export interface Listing {
  id: string
  productId: string
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

export function getAnuncios(apenasAtivos = false): Promise<AnuncioResumo[]> {
  return apiGet<AnuncioResumo[]>(`/dashboard/listings${apenasAtivos ? '?apenasAtivos=true' : ''}`)
}

export function publicarListing(listingId: string): Promise<Listing> {
  return apiPost<Listing>(`/products/${listingId}/publish`)
}

export function alterarStatusListing(listingId: string, status: StatusMl): Promise<Listing> {
  return apiPut<Listing>(`/products/${listingId}/status`, { status })
}
