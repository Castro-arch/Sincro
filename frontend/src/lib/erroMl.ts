/**
 * Deixa legível o `ultimoErro` que o backend guarda, que chega assim:
 *   "Mercado Livre: Validation error | Attribute [SIZE_GRID_ID] is missing | ..."
 * Um resumo e uma causa por linha, com as causas mais comuns traduzidas.
 * O texto original fica disponível para quem quiser o cru.
 */
export interface ErroMlLegivel {
  resumo: string
  causas: string[]
}

const TRADUCOES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/Attribute \[([A-Z_0-9]+)\] is missing/i, (m) => `Falta o atributo ${m[1]}.`],
  [
    /Attribute \[([A-Z_0-9]+)\] to be added/i,
    (m) => `O atributo ${m[1]} precisa ser informado nesta categoria.`,
  ],
  [
    /Every variation of category ([A-Z0-9]+) must have between 1 and (\d+) pictures/i,
    (m) => `Cada variação precisa de 1 a ${m[2]} imagens.`,
  ],
  [/Validation error/i, () => 'Erro de validação'],
  [/User has not mode me1|ME2 adoption is mandatory/i, () => 'Mercado Envios não configurado na conta.'],
]

function traduzir(trecho: string): string {
  for (const [padrao, fn] of TRADUCOES) {
    const m = trecho.match(padrao)
    if (m) return fn(m)
  }
  return trecho
}

export function lerErroMl(bruto: string): ErroMlLegivel {
  const semPrefixo = bruto.replace(/^Mercado Livre:\s*/i, '')
  const [primeiro, ...resto] = semPrefixo.split(' | ').map((t) => t.trim()).filter(Boolean)
  return {
    resumo: traduzir(primeiro ?? bruto),
    causas: resto.map(traduzir),
  }
}
