import { Route, Routes } from 'react-router-dom'
import { Anuncios } from '@/pages/Anuncios'
import { CadastroProduto } from '@/pages/CadastroProduto'
import { Dashboard } from '@/pages/Dashboard'
import { Pedidos } from '@/pages/Pedidos'
import { Perguntas } from '@/pages/Perguntas'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/anuncios" element={<Anuncios />} />
      <Route path="/produtos/novo" element={<CadastroProduto />} />
      <Route path="/pedidos" element={<Pedidos />} />
      <Route path="/perguntas" element={<Perguntas />} />
    </Routes>
  )
}

export default App
