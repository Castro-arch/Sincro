import { AppShell } from '@/components/layout/AppShell'
import { AlertRow } from '@/components/dashboard/AlertRow'
import { StatTile } from '@/components/dashboard/StatTile'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/hooks/useDashboard'
import { formatBRL } from '@/lib/format'

export function Dashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useDashboard()

  return (
    <AppShell
      acoes={
        <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Atualizando…' : 'Atualizar'}
        </Button>
      }
    >

      <div className="flex flex-col gap-6 p-6">
        {isLoading && <p className="text-sm text-ink-soft">Carregando visão geral…</p>}

        {isError && (
          <p className="text-sm text-danger-ink">
            Não deu pra carregar o dashboard. Confira se a API está no ar em{' '}
            <span className="font-mono">localhost:3000</span> e tenta de novo.
          </p>
        )}

        {data && (
          <>
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile label="Anúncios ativos" value={String(data.totais.anunciosAtivos)} />
              <StatTile
                label="Rascunhos"
                value={String(data.totais.rascunhos)}
                tone={data.totais.rascunhos > 0 ? 'warning' : 'default'}
              />
              <StatTile
                label="Com erro"
                value={String(data.totais.comErro)}
                tone={data.totais.comErro > 0 ? 'danger' : 'default'}
              />
              <StatTile label="Estoque total" value={String(data.totais.estoqueTotal)} />
              <StatTile label="Pedidos (30d)" value={String(data.totais.pedidos30Dias)} />
              <StatTile
                label="Faturamento (30d)"
                value={formatBRL(data.totais.faturamento30Dias)}
                tone="success"
              />
            </section>

            <section className="flex flex-col cartao">
                <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold text-ink">
                  Alertas de estoque
                </h2>
                {data.alertas.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-ink-faint">
                    Nenhum alerta — estoque dentro do limite em todos os anúncios ativos.
                  </p>
                ) : (
                  data.alertas.map((alerta) => (
                    <AlertRow key={alerta.variationId} alerta={alerta} />
                  ))
                )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  )
}
