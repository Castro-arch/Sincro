import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Entrada } from '@/components/ui/Campo'
import { useDefinirImposto, useImposto } from '@/hooks/useMargem'

/**
 * Percentual de imposto, editável na própria tela.
 *
 * O texto de apoio diz sobre qual base ele incide de propósito: a escolha
 * (receita menos taxa do ML) é modelagem do Sincro, não a regra do
 * Simples/MEI, que incide sobre o faturamento bruto. Sem essa frase, o
 * número aqui passaria por apuração fiscal.
 */
export function ConfiguracaoImposto() {
  const { data } = useImposto()
  const definir = useDefinirImposto()
  const [rascunho, setRascunho] = useState<string | null>(null)

  const atual = data?.percentual ?? 0
  const valor = rascunho ?? String(atual)
  const numero = Number(valor)
  const invalido = !Number.isFinite(numero) || numero < 0 || numero > 100
  const mudou = numero !== atual

  return (
    <section className="cartao flex flex-wrap items-end gap-4 p-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="imposto" className="text-xs font-semibold text-ink-soft">
          Imposto (%)
        </label>
        <Entrada
          id="imposto"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={valor}
          onChange={(e) => setRascunho(e.target.value)}
          className="w-28"
        />
      </div>

      <Button
        disabled={!mudou || invalido || definir.isPending}
        onClick={() =>
          definir.mutate(numero, { onSuccess: () => setRascunho(null) })
        }
      >
        {definir.isPending ? 'Salvando…' : 'Salvar'}
      </Button>

      <p className="max-w-xl flex-1 text-xs text-ink-faint">
        Percentual que você informa, aplicado sobre a <strong>receita já descontada da taxa
        do Mercado Livre</strong>. É uma modelagem do Sincro para estimar o quanto sobra — não é
        apuração do Simples/MEI, que incide sobre o faturamento bruto.
      </p>

      {definir.isError && (
        <p className="w-full text-xs text-danger-ink">{(definir.error as Error).message}</p>
      )}
    </section>
  )
}
