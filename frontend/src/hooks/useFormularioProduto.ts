import { useState } from 'react'
import type { CategoriaSugerida } from '@/api/categories'
import type { Listing, NovaVariacao } from '@/api/listings'
import type { ImagemEnviada } from '@/api/pictures'
import type { VariacaoForm } from '@/components/cadastro/PassoVariacoes'
import { useAtributosDaCategoria } from '@/hooks/useCategorias'

export function variacaoVazia(eixos: string[]): VariacaoForm {
  return {
    chave: crypto.randomUUID(),
    sku: '',
    valores: Object.fromEntries(eixos.map((e) => [e, ''])),
    preco: '',
    estoque: '',
  }
}

/**
 * Estado compartilhado pelo cadastro e pela edição de produto.
 *
 * Existe porque as duas telas montam os mesmos quatro passos (categoria,
 * atributos, imagens, variações) sobre a mesma estrutura de dados: sem isto,
 * a segunda tela seria uma cópia da primeira, e as regras (limpar atributos
 * ao trocar de categoria, montar o payload) divergiriam com o tempo.
 */
export function useFormularioProduto(inicial?: Listing) {
  const primeiraVariacao = inicial?.variations?.[0]
  const eixosIniciais = (primeiraVariacao?.atributos ?? []).map((a) => a.id)

  const [sku, setSku] = useState('')
  const [nome, setNome] = useState(inicial?.product?.nome ?? '')
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [custoUnitario, setCustoUnitario] = useState(
    inicial?.product?.custoUnitario != null ? String(inicial.product.custoUnitario) : '',
  )
  // Ao carregar um anuncio existente so temos o id: o nome vem do predictor,
  // que nao foi chamado. Deixar vazio faz a tela mostrar so o id, em vez de
  // repetir "MLB31447 (MLB31447)" como se fosse nome.
  const [categoria, setCategoria] = useState<CategoriaSugerida | null>(
    inicial?.categoriaId
      ? { category_id: inicial.categoriaId, category_name: '' }
      : null,
  )
  const [atributos, setAtributos] = useState<Record<string, string>>(
    Object.fromEntries((inicial?.atributos ?? []).map((a) => [a.id, a.value_name ?? ''])),
  )
  const [imagens, setImagens] = useState<ImagemEnviada[]>(
    (inicial?.pictureIds ?? []).map((id) => ({
      id,
      url: null,
      tamanhoOriginal: 0,
      nomeArquivo: id,
    })),
  )
  const [eixos, setEixos] = useState<string[]>(eixosIniciais)
  const [variacoes, setVariacoes] = useState<VariacaoForm[]>(
    inicial?.variations?.length
      ? inicial.variations.map((v) => ({
          chave: v.id,
          sku: v.sku ?? '',
          valores: Object.fromEntries(v.atributos.map((a) => [a.id, a.value_name ?? ''])),
          preco: String(v.preco),
          estoque: String(v.estoque),
        }))
      : [variacaoVazia([])],
  )

  const { data: atributosDaCategoria } = useAtributosDaCategoria(categoria?.category_id ?? null)

  // O backend aceita atributo sem `name`, mas o dashboard usa esse campo pra
  // escrever "Cor: Azul" em vez de "COLOR: Azul" -- então mandamos sempre.
  const nomeDoAtributo = (id: string): string =>
    atributosDaCategoria?.find((a) => a.id === id)?.nome ?? id

  /**
   * Trocar de categoria invalida atributos e eixos de variação: eles
   * pertencem à categoria. Preço, estoque e SKU NÃO pertencem — zerá-los
   * fazia a correção de categoria apagar o que o usuário já tinha, e o
   * formulário voltava inválido por preço ausente logo depois de consertar
   * o que estava errado.
   */
  function escolherCategoria(nova: CategoriaSugerida | null) {
    setCategoria(nova)
    setAtributos({})
    setEixos([])
    setVariacoes((atuais) =>
      atuais.map((v) => ({ ...v, valores: {} })),
    )
  }

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

  function atributosParaEnvio() {
    return Object.entries(atributos)
      .filter(([, valor]) => valor.trim() !== '')
      .map(([id, valor]) => ({ id, name: nomeDoAtributo(id), value_name: valor }))
  }

  /** O que ainda falta preencher -- a tela mostra a lista ao lado do botão. */
  function faltando(exigeSku: boolean): string[] {
    const falta: string[] = []
    if (exigeSku && !sku.trim()) falta.push('SKU')
    if (!nome.trim()) falta.push('nome')
    if (!titulo.trim()) falta.push('título')
    if (!categoria) falta.push('categoria')
    if (variacoes.some((v) => !v.preco || Number(v.preco) <= 0)) falta.push('preço da variação')
    if (variacoes.some((v) => v.estoque === '' || Number(v.estoque) < 0)) falta.push('estoque')
    if (eixos.length > 0 && variacoes.some((v) => eixos.some((e) => !v.valores[e])))
      falta.push('valor de cada eixo de variação')
    return falta
  }

  return {
    sku, setSku,
    nome, setNome,
    titulo, setTitulo,
    descricao, setDescricao,
    custoUnitario, setCustoUnitario,
    categoria, escolherCategoria,
    atributos, setAtributos,
    imagens, setImagens,
    eixos, setEixos,
    variacoes, setVariacoes,
    montarVariacoes, atributosParaEnvio, faltando,
  }
}
