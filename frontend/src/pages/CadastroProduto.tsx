import { AppShell } from '@/components/layout/AppShell'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CategoriaSugerida } from '@/api/categories'
import type { NovaVariacao } from '@/api/listings'
import type { ImagemEnviada } from '@/api/pictures'
import { PassoAtributos } from '@/components/cadastro/PassoAtributos'
import { PassoCategoria } from '@/components/cadastro/PassoCategoria'
import { PassoImagens } from '@/components/cadastro/PassoImagens'
import { PassoVariacoes, type VariacaoForm } from '@/components/cadastro/PassoVariacoes'
import { Button } from '@/components/ui/Button'
import { AreaTexto, Campo, Entrada } from '@/components/ui/Campo'
import { useAtributosDaCategoria } from '@/hooks/useCategorias'
import { useCriarProduto } from '@/hooks/useAnuncios'

function variacaoVazia(eixos: string[]): VariacaoForm {
  return {
    chave: crypto.randomUUID(),
    sku: '',
    valores: Object.fromEntries(eixos.map((e) => [e, ''])),
    preco: '',
    estoque: '',
  }
}

export function CadastroProduto() {
  const navigate = useNavigate()
  const criar = useCriarProduto()

  const [sku, setSku] = useState('')
  const [nome, setNome] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<CategoriaSugerida | null>(null)
  const [atributos, setAtributos] = useState<Record<string, string>>({})
  const [imagens, setImagens] = useState<ImagemEnviada[]>([])
  const [eixos, setEixos] = useState<string[]>([])
  const [variacoes, setVariacoes] = useState<VariacaoForm[]>([variacaoVazia([])])

  const { data: atributosDaCategoria } = useAtributosDaCategoria(categoria?.category_id ?? null)

  // O backend aceita atributo sem `name`, mas o dashboard usa esse campo pra
  // escrever "Cor: Azul" em vez de "COLOR: Azul" -- então mandamos sempre.
  const nomeDoAtributo = (id: string): string =>
    atributosDaCategoria?.find((a) => a.id === id)?.nome ?? id

  const faltando: string[] = []
  if (!sku.trim()) faltando.push('SKU')
  if (!nome.trim()) faltando.push('nome')
  if (!titulo.trim()) faltando.push('título')
  if (!categoria) faltando.push('categoria')
  if (variacoes.some((v) => !v.preco || Number(v.preco) <= 0)) faltando.push('preço da variação')
  if (variacoes.some((v) => v.estoque === '' || Number(v.estoque) < 0)) faltando.push('estoque')
  if (eixos.length > 0 && variacoes.some((v) => eixos.some((e) => !v.valores[e])))
    faltando.push('valor de cada eixo de variação')

  function montarVariacoes(): NovaVariacao[] {
    return variacoes.map((v) => ({
      sku: v.sku.trim() || undefined,
      atributos: eixos.map((id) => ({
        id,
        name: nomeDoAtributo(id),
        value_name: v.valores[id],
      })),
      preco: Number(v.preco),
      estoque: Number(v.estoque),
    }))
  }

  async function salvar() {
    const listing = await criar.mutateAsync({
      sku: sku.trim(),
      nome: nome.trim(),
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      categoriaId: categoria?.category_id,
      atributos: Object.entries(atributos)
        .filter(([, valor]) => valor.trim() !== '')
        .map(([id, valor]) => ({ id, name: nomeDoAtributo(id), value_name: valor })),
      pictureIds: imagens.map((i) => i.id),
      variacoes: montarVariacoes(),
    })
    // Nasce como rascunho: a publicação é um passo separado, na tela de anúncios.
    navigate('/anuncios', { state: { criado: listing.id } })
  }

  return (
    <AppShell>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink">Novo produto</h1>
          <p className="mt-1 text-sm text-ink-soft">
            O produto nasce como rascunho no Sincro. Publicar no Mercado Livre é um passo à parte,
            na tela de anúncios.
          </p>
        </div>

        <section className="flex flex-col gap-4 border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">1. Identificação</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="SKU" obrigatorio dica="Seu código interno, único no Sincro.">
              <Entrada value={sku} onChange={(e) => setSku(e.target.value)} />
            </Campo>
            <Campo label="Nome interno" obrigatorio>
              <Entrada value={nome} onChange={(e) => setNome(e.target.value)} />
            </Campo>
          </div>
          <Campo
            label="Título do anúncio"
            obrigatorio
            dica="É o que aparece no Mercado Livre e o que alimenta a sugestão de categoria."
          >
            <Entrada
              value={titulo}
              maxLength={200}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </Campo>
          <Campo label="Descrição">
            <AreaTexto value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </Campo>
        </section>

        <PassoCategoria
          titulo={titulo}
          categoriaId={categoria?.category_id ?? null}
          categoriaNome={categoria?.category_name ?? null}
          onEscolher={(c) => {
            setCategoria(c)
            // Atributos e eixos pertencem à categoria: trocar de categoria
            // invalida os dois, e manter valores antigos mandaria lixo ao ML.
            setAtributos({})
            setEixos([])
            setVariacoes([variacaoVazia([])])
          }}
        />

        <PassoAtributos
          categoriaId={categoria?.category_id ?? null}
          valores={atributos}
          eixosDeVariacao={eixos}
          onMudar={(id, valor) => setAtributos((prev) => ({ ...prev, [id]: valor }))}
        />

        <PassoImagens imagens={imagens} onMudar={setImagens} />

        <PassoVariacoes
          categoriaId={categoria?.category_id ?? null}
          eixos={eixos}
          variacoes={variacoes}
          onMudarEixos={setEixos}
          onMudarVariacoes={setVariacoes}
        />

        {criar.isError && (
          <p className="border border-danger bg-surface px-5 py-3 text-sm text-danger">
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
