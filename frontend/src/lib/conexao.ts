import type { ConexaoMl } from '@/api/dashboard'

/** Abaixo disso o token está perto de vencer e o job de renovação vai agir. */
const AVISO_RENOVACAO_SEGUNDOS = 15 * 60

export type TomConexao = 'ok' | 'warning' | 'danger'

/**
 * Traduz o estado da conexão em severidade.
 *
 * Vive aqui, e não dentro de um componente, porque o mesmo estado aparece em
 * dois lugares com formatos diferentes — o cartão do dashboard e o rodapé da
 * sidebar. Escrita duas vezes, é o tipo de regra que diverge sem ninguém
 * perceber: uma tela diria "atenção" enquanto a outra ainda diz "ok".
 */
export function tomDaConexao(conexao: ConexaoMl): TomConexao {
  if (!conexao.conectado || conexao.expirado) return 'danger'
  if (
    conexao.segundosParaExpirar !== null &&
    conexao.segundosParaExpirar < AVISO_RENOVACAO_SEGUNDOS
  ) {
    return 'warning'
  }
  return 'ok'
}
