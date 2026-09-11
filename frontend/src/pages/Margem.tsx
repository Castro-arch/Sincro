import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LinhaMargem } from '@/api/margem'
import { ConfiguracaoImposto } from '@/components/margem/ConfiguracaoImposto'
import { CelulaTotal, GRADE_MARGEM, LinhaMargemItem } from '@/components/margem/LinhaMargemItem'
import { AppShell } from '@/components/layout/AppShell'
import { Selecao } from '@/components/ui/Campo'
import { useMargem } from '@/hooks/useMargem'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'

type Ordem = 'receita' | 'lucro' | 'margem' | 'margem-pior'

const ORDENS: Array<{ valor: Ordem; rotulo: string }> = [
  { valor: 'receita', rotulo: 'Maior receita' },
  { valor: 'lucro', rotulo: 'Maior lucro' },
  { valor: 'margem', rotulo: 'Maior margem %' },
  { valor: 'margem-pior', rotulo: 'Menor margem %' },
]

const JANELAS = [7, 30, 90]

function ordenar(linhas: LinhaMargem[], ordem: Ordem): LinhaMargem[] {
  const copia = [...linhas]
  switch (ordem) {
    case 'lucro':
      return copia.sort((a, b) => b.lucro - a.lucro)
    case 'margem':
      return copia.sort((a, b) => (b.margemPercentual ?? -Infinity) - (a.margemPercentual ?? -Infinity))
    case 'margem-pior':
      return copia.sort((a, b) => (a.margemPercentual ?? Infinity) - (b.margemPercentual ?? Infinity))
    default:
      return copia.sort((a, b) => b.receitaBruta - a.receitaBruta)
  }
}

export function Margem() {
  const [dias, setDias] = useState(30)
  const [ordem, setOrdem] = useState<Ordem>('receita')
  const { data, isLoading, isError, error } = useMargem(dias)

  const linhas = useMemo(() => ordenar(data?.linhas ?? [], ordem), [data, ordem])
  const totais = data?.totais

  return (
    <AppShell>
      <div className="flex flex-col gap-5 p-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Margem</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-soft">
            Quanto sobra de cada produto depois da comissão do Mercado Livre, do imposto que você
            configurar e do custo de aquisição. Frete não entra: sua conta usa envio próprio
            (modo <span className="font-semibold">custom</span>), então o custo real do envio não
            existe nos dados do ML.
          </p>
        </div>

        <ConfiguracaoImposto />

        {isLoading && <p className="text-sm text-ink-soft">Calculando margem…</p>}
        {isError && (
          <p className="text-sm text-danger-ink">
            Não deu pra calcular a margem: {(error as Error).message}
          </p>
        )}

        {totais && (
          <>
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <CelulaTotal rotulo="Receita bruta" valor={formatBRL(totais.receitaBruta)} />
              <CelulaTotal rotulo="Taxa do ML" valor={`−${formatBRL(totais.taxaMl)}`} />
              <CelulaTotal
                rotulo="Imposto"
                valor={`−${formatBRL(totais.imposto)}`}
                sufixo={`${data.impostoPercentual}% sobre receita − taxa`}
              />
              <CelulaTotal rotulo="Custo dos produtos" valor={`−${formatBRL(totais.custoTotal)}`} />
              <CelulaTotal
                rotulo="Lucro"
                valor={formatBRL(totais.lucro)}
                tom={totais.lucro >= 0 ? 'success' : 'danger'}
                sufixo={
                  totais.margemPercentual === null
                    ? undefined
                    : `${totais.margemPercentual.toFixed(1)}% da receita`
                }
              />
            </section>

            {totais.produtosSemCusto > 0 && (
              <p className="border border-danger bg-danger-tint px-5 py-3 text-sm text-danger-ink">
                <strong>{totais.produtosSemCusto} produto(s) sem custo de aquisição.</strong> O
                lucro acima está superestimado — cadastre o custo unitário para o número virar
                lucro de verdade.
              </p>
            )}
          </>
        )}

        <section className="cartao">
          <div className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="flex gap-1">
              {JANELAS.map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setDias(j)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs',
                    dias === j
                      ? 'bg-blue-tint font-semibold text-blue-ink'
                      : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {j} dias
                </button>
              ))}
            </div>
            <Selecao
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordem)}
              aria-label="Ordenar por"
              className="ml-auto w-auto"
            >
              {ORDENS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Selecao>
          </div>

          {data && linhas.length === 0 && (
            <div className="flex flex-col items-center gap-2 border-t border-line px-5 py-10 text-center">
              <p className="text-sm text-ink-soft">
                Nenhuma venda paga nos últimos {dias} dias.
              </p>
              <Link
                to="/anuncios"
                className="text-sm text-blue-ink underline decoration-1 underline-offset-2"
              >
                ver anúncios
              </Link>
            </div>
          )}

          {linhas.length > 0 && (
            <>
              <div
                className={cn(
                  GRADE_MARGEM,
                  'border-t border-line py-2 text-xs font-semibold tracking-wide text-ink-faint uppercase',
                )}
              >
                <span />
                <span>Produto</span>
                <span>Receita</span>
                <span>Taxa ML</span>
                <span>Imposto</span>
                <span>Custo</span>
                <span className="text-right">Lucro</span>
              </div>
              <ul>
                {linhas.map((linha) => (
                  <LinhaMargemItem key={linha.productId ?? linha.sku} linha={linha} />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </AppShell>
  )
}
