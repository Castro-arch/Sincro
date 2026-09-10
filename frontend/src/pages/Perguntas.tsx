import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { PerguntaLinha } from '@/components/pergunta/PerguntaLinha'
import { Button } from '@/components/ui/Button'
import {
  usePerguntas,
  usePerguntasPendentes,
  useSincronizarPerguntas,
} from '@/hooks/usePerguntas'
import { cn } from '@/lib/utils'

export function Perguntas() {
  const [params, setParams] = useSearchParams()
  const aba = params.get('status') === 'todas' ? 'todas' : 'pendentes'

  const { data, isLoading, isError, error, isFetching } = usePerguntas(aba === 'pendentes')
  const { data: contagem } = usePerguntasPendentes()
  const sincronizar = useSincronizarPerguntas()

  const perguntas = data ?? []

  return (
    <AppShell
      acoes={
        <Button
          variant="secondary"
          onClick={() => sincronizar.mutate()}
          disabled={sincronizar.isPending}
        >
          {sincronizar.isPending ? 'Buscando…' : 'Buscar agora'}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 p-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Perguntas</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-soft">
            Perguntas de compradores nos seus anúncios. O Sincro busca novas a cada 2 minutos. O
            destaque por tempo é critério do Sincro — o Mercado Livre não define prazo por
            pergunta, mas usa “responder em menos de 1 h” como referência de conversão.
          </p>
        </div>

        {sincronizar.data && (
          <p className="cartao px-5 py-3 text-xs text-ink-soft">
            {sincronizar.data.lidasNoMl} sem resposta no ML · {sincronizar.data.novas} nova(s) ·{' '}
            {sincronizar.data.atualizadas} atualizada(s) · {sincronizar.data.reconciliadas}{' '}
            reconciliada(s) com o painel do ML
          </p>
        )}
        {sincronizar.isError && (
          <p className="text-sm text-danger-ink">{(sincronizar.error as Error).message}</p>
        )}

        <section className="cartao">
          <nav className="flex gap-1 border-b border-line px-3">
            {(['pendentes', 'todas'] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() =>
                  setParams(valor === 'pendentes' ? {} : { status: valor }, { replace: true })
                }
                className={cn(
                  '-mb-px border-b-2 px-3 py-3 text-sm transition-colors',
                  aba === valor
                    ? 'border-blue font-semibold text-blue-ink'
                    : 'border-transparent text-ink-soft hover:text-ink',
                )}
              >
                {valor === 'pendentes' ? 'Pendentes' : 'Todas'}
                {valor === 'pendentes' && contagem && (
                  <span className="ml-1 text-ink-faint">{contagem.pendentes}</span>
                )}
              </button>
            ))}
            {isFetching && (
              <span className="ml-auto self-center text-xs text-ink-faint">atualizando…</span>
            )}
          </nav>

          {isLoading && <p className="px-5 py-6 text-sm text-ink-soft">Carregando perguntas…</p>}

          {isError && (
            <p className="px-5 py-6 text-sm text-danger-ink">
              Não deu pra carregar as perguntas: {(error as Error).message}
            </p>
          )}

          {data && perguntas.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <p className="text-sm text-ink-soft">
                {aba === 'pendentes'
                  ? 'Nenhuma pergunta pendente.'
                  : 'Nenhuma pergunta ainda.'}
              </p>
              <Link
                to="/anuncios"
                className="text-sm text-blue-ink underline decoration-1 underline-offset-2"
              >
                ver anúncios
              </Link>
            </div>
          )}

          {perguntas.length > 0 && (
            <ul>
              {perguntas.map((p) => (
                <PerguntaLinha key={p.id} pergunta={p} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  )
}
