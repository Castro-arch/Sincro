import { Badge } from '@/components/ui/Badge'
import type { ListingStatus } from '@/api/listings'

/**
 * Rascunho e encerrado usam o tom neutro de propósito: não são "bom" nem
 * "ruim", são etapas do ciclo. Só ativo (ok) e erro (out) carregam juízo.
 */
const TOM: Record<ListingStatus, 'ok' | 'low' | 'out' | 'neutral'> = {
  ativo: 'ok',
  rascunho: 'neutral',
  pausado: 'low',
  encerrado: 'neutral',
  erro: 'out',
}

const ROTULO: Record<ListingStatus, string> = {
  ativo: 'ativo',
  rascunho: 'rascunho',
  pausado: 'pausado',
  encerrado: 'encerrado',
  erro: 'erro',
}

export function StatusAnuncio({ status }: { status: ListingStatus }) {
  return <Badge tone={TOM[status]}>{ROTULO[status]}</Badge>
}
