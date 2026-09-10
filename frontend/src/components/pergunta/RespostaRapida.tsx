import { useState } from 'react'
import type { Pergunta } from '@/api/questions'
import { TAMANHO_MAXIMO_RESPOSTA } from '@/api/questions'
import { Button } from '@/components/ui/Button'
import { AreaTexto } from '@/components/ui/Campo'
import { useResponderPergunta } from '@/hooks/usePerguntas'
import { lerErroMl } from '@/lib/erroMl'
import { cn } from '@/lib/utils'

/**
 * Resposta na própria linha, sem abrir tela.
 *
 * O `maxLength` do textarea fica acima do limite do ML de propósito: cortar
 * a digitação em silêncio esconderia que o texto passou de 2.000. Melhor
 * deixar passar, mostrar o contador negativo e bloquear o envio.
 */
export function RespostaRapida({ pergunta }: { pergunta: Pergunta }) {
  const [texto, setTexto] = useState('')
  const responder = useResponderPergunta()

  const restantes = TAMANHO_MAXIMO_RESPOSTA - texto.length
  const invalido = texto.trim().length === 0 || restantes < 0
  const erro = responder.error ? lerErroMl((responder.error as Error).message) : null

  return (
    <div className="mt-2 flex flex-col gap-2">
      <AreaTexto
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Responder ao comprador…"
        aria-label={`Responder pergunta ${pergunta.mlQuestionId}`}
        className="min-h-16"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="px-4 py-1.5 text-xs"
          disabled={invalido || responder.isPending}
          onClick={() => responder.mutate({ id: pergunta.id, texto: texto.trim() })}
        >
          {responder.isPending ? 'Enviando…' : 'Responder'}
        </Button>
        <span className={cn('text-xs', restantes < 0 ? 'text-danger-ink' : 'text-ink-faint')}>
          {restantes} caracteres restantes
        </span>
      </div>
      {erro && (
        <p className="text-xs text-danger-ink">
          Não foi possível responder: {erro.resumo}
          {erro.causas.length > 0 && ` — ${erro.causas.join('; ')}`}
        </p>
      )}
    </div>
  )
}
