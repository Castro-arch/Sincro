import { Header } from '@/components/layout/Header'
import { PedidoLinha } from '@/components/pedido/PedidoLinha'
import { Button } from '@/components/ui/Button'
import { usePedidos, useSincronizarPedidos } from '@/hooks/usePedidos'
import { formatBRL } from '@/lib/format'

export function Pedidos() {
  const { data, isLoading, isError, error, isFetching } = usePedidos()
  const sincronizar = useSincronizarPedidos()

  const pedidos = data ?? []
  const pagos = pedidos.filter((p) => p.status === 'pago')
  const faturamento = pagos.reduce((soma, p) => soma + p.valor, 0)
  const semBaixa = pagos.filter((p) => !p.estoqueBaixado).length
  const resultado = sincronizar.data

  return (
    <div className="min-h-screen bg-base">
      <Header
        right={
          <Button onClick={() => sincronizar.mutate()} disabled={sincronizar.isPending}>
            {sincronizar.isPending ? 'Buscando…' : 'Buscar agora'}
          </Button>
        }
      />

      <main className="flex flex-col gap-5 p-6">
        <p className="text-sm text-ink-soft">
          O Sincro busca pedidos novos a cada 5 minutos. O botão acima antecipa essa checagem —
          não é necessário para o estoque ficar em dia.
        </p>

        {sincronizar.isError && (
          <p className="text-sm text-danger">{(sincronizar.error as Error).message}</p>
        )}

        {resultado && (
          <p className="border border-line bg-surface px-5 py-3 font-mono text-xs text-ink-soft">
            {resultado.pedidosLidos} pedido(s) lido(s) · {resultado.itensNovos} novo(s) ·{' '}
            {resultado.baixasAplicadas} baixa(s) · {resultado.estornosAplicados} estorno(s)
            {resultado.ignorados > 0 && (
              <span className="text-warning">
                {' '}
                · {resultado.ignorados} ignorado(s) por não existir no Sincro
              </span>
            )}
          </p>
        )}

        {semBaixa > 0 && (
          <p className="border border-warning bg-surface px-5 py-3 text-sm text-warning">
            {semBaixa} pedido(s) pago(s) sem baixa de estoque — o anúncio vendido não está no
            Sincro, então o estoque local não acompanhou o Mercado Livre.
          </p>
        )}

        {isLoading && <p className="text-sm text-ink-soft">Carregando pedidos…</p>}

        {isError && (
          <p className="text-sm text-danger">
            Não deu pra carregar os pedidos: {(error as Error).message}
          </p>
        )}

        {data && (
          <section className="border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-ink">
                {pedidos.length} pedido(s)
                {isFetching && <span className="ml-2 text-xs text-ink-faint">atualizando…</span>}
              </h2>
              <span className="font-mono text-xs text-ink-soft">
                {pagos.length} pago(s) · {formatBRL(faturamento)}
              </span>
            </div>

            {pedidos.length === 0 ? (
              <p className="border-t border-line px-5 py-8 text-center text-sm text-ink-faint">
                Nenhum pedido ainda. Quando uma venda entrar no Mercado Livre, ela aparece aqui e
                o estoque é debitado sozinho.
              </p>
            ) : (
              pedidos.map((pedido) => <PedidoLinha key={pedido.id} pedido={pedido} />)
            )}
          </section>
        )}
      </main>
    </div>
  )
}
