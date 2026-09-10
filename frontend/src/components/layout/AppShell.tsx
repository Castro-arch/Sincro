import { useState, type ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'

const CHAVE_RECOLHIDA = 'sincro:sidebar-recolhida'

function lerPreferencia(): boolean {
  // localStorage pode estourar (janela privada, site data bloqueado): o
  // padrão é expandida, como pedido, e uma falha aqui não derruba a tela.
  try {
    return localStorage.getItem(CHAVE_RECOLHIDA) === 'true'
  } catch {
    return false
  }
}

/**
 * Moldura de todas as telas: header no topo em largura cheia, sidebar à
 * esquerda abaixo dele, conteúdo à direita — o arranjo do painel de vendas.
 *
 * Existe para que header e sidebar sejam montados uma vez só: antes, cada
 * página repetia o próprio `<div className="min-h-screen">` com o Header
 * dentro, e era assim que o estado de conexão acabava divergindo entre elas.
 */
export function AppShell({ acoes, children }: { acoes?: ReactNode; children: ReactNode }) {
  const [recolhida, setRecolhida] = useState(lerPreferencia)

  function alternar() {
    setRecolhida((atual) => {
      const proximo = !atual
      try {
        localStorage.setItem(CHAVE_RECOLHIDA, String(proximo))
      } catch {
        // Preferência de conforto: perder não quebra nada.
      }
      return proximo
    })
  }

  return (
    <div className="flex h-screen flex-col bg-base">
      <Header right={acoes} />
      <div className="flex min-h-0 flex-1">
        <Sidebar recolhida={recolhida} onAlternar={alternar} />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
