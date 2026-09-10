import { Header } from '@/components/layout/Header'

// TODO: tela em construção — API client (api/listings.ts) e hooks
// (hooks/useAnuncios.ts) já existem, falta montar a listagem/ações.
export function Anuncios() {
  return (
    <div className="min-h-screen bg-base">
      <Header />
      <main className="p-6">
        <p className="text-sm text-ink-soft">Anúncios — em construção.</p>
      </main>
    </div>
  )
}
