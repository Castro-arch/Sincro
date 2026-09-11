import { useNavigate } from 'react-router-dom'
import { PassoAtributos } from '@/components/cadastro/PassoAtributos'
import { PassoCategoria } from '@/components/cadastro/PassoCategoria'
import { PassoImagens } from '@/components/cadastro/PassoImagens'
import { PassoVariacoes } from '@/components/cadastro/PassoVariacoes'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { AreaTexto, Campo, Entrada } from '@/components/ui/Campo'
import { useCriarProduto } from '@/hooks/useAnuncios'
import { useFormularioProduto } from '@/hooks/useFormularioProduto'

export function CadastroProduto() {
  const navigate = useNavigate()
  const criar = useCriarProduto()
  // Mesmo estado e mesmas regras da edição -- só muda o que se faz ao salvar.
  const form = useFormularioProduto()

  const faltando = form.faltando(true)

  async function salvar() {
    await criar.mutateAsync({
      sku: form.sku.trim(),
      nome: form.nome.trim(),
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || undefined,
      custoUnitario: form.custoUnitario.trim() === '' ? undefined : Number(form.custoUnitario),
      categoriaId: form.categoria?.category_id,
      atributos: form.atributosParaEnvio(),
      pictureIds: form.imagens.map((i) => i.id),
      variacoes: form.montarVariacoes(),
    })
    // Nasce como rascunho: publicar é um passo separado, na tela de anúncios.
    navigate('/anuncios')
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Novo produto</h1>
          <p className="mt-1 text-sm text-ink-soft">
            O produto nasce como rascunho no Sincro. Publicar no Mercado Livre é um passo à parte,
            na tela de anúncios.
          </p>
        </div>

        <section className="cartao flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold text-ink">1. Identificação</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="SKU" obrigatorio dica="Seu código interno, único no Sincro.">
              <Entrada value={form.sku} onChange={(e) => form.setSku(e.target.value)} />
            </Campo>
            <Campo label="Nome interno" obrigatorio>
              <Entrada value={form.nome} onChange={(e) => form.setNome(e.target.value)} />
            </Campo>
          </div>
          <Campo
            label="Título do anúncio"
            obrigatorio
            dica="É o que aparece no Mercado Livre e o que alimenta a sugestão de categoria."
          >
            <Entrada
              value={form.titulo}
              maxLength={200}
              onChange={(e) => form.setTitulo(e.target.value)}
            />
          </Campo>
          <Campo
            label="Custo de aquisição (R$ por unidade)"
            dica="Quanto você paga por unidade. Sem isso, o relatório de Margem mostra receita menos taxa e imposto — não lucro."
          >
            <Entrada
              type="number"
              min="0"
              step="0.01"
              value={form.custoUnitario}
              onChange={(e) => form.setCustoUnitario(e.target.value)}
              placeholder="opcional"
              className="sm:w-48"
            />
          </Campo>
          <Campo label="Descrição">
            <AreaTexto value={form.descricao} onChange={(e) => form.setDescricao(e.target.value)} />
          </Campo>
        </section>

        <PassoCategoria
          titulo={form.titulo}
          categoriaId={form.categoria?.category_id ?? null}
          categoriaNome={form.categoria?.category_name ?? null}
          onEscolher={form.escolherCategoria}
        />

        <PassoAtributos
          categoriaId={form.categoria?.category_id ?? null}
          valores={form.atributos}
          eixosDeVariacao={form.eixos}
          onMudar={(id, valor) => form.setAtributos((prev) => ({ ...prev, [id]: valor }))}
        />

        <PassoImagens imagens={form.imagens} onMudar={form.setImagens} />

        <PassoVariacoes
          categoriaId={form.categoria?.category_id ?? null}
          eixos={form.eixos}
          variacoes={form.variacoes}
          onMudarEixos={form.setEixos}
          onMudarVariacoes={form.setVariacoes}
        />

        {criar.isError && (
          <p className="border border-danger bg-danger-tint px-5 py-3 text-sm text-danger-ink">
            {(criar.error as Error).message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Button disabled={faltando.length > 0 || criar.isPending} onClick={() => void salvar()}>
            {criar.isPending ? 'Salvando…' : 'Salvar rascunho'}
          </Button>
          {faltando.length > 0 && (
            <span className="text-xs text-ink-faint">Falta preencher: {faltando.join(', ')}.</span>
          )}
        </div>
      </div>
    </AppShell>
  )
}
