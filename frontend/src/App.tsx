import { Route, Routes } from 'react-router-dom'
import { Anuncios } from '@/pages/Anuncios'
import { CadastroProduto } from '@/pages/CadastroProduto'
import { Dashboard } from '@/pages/Dashboard'
import { Pedidos } from '@/pages/Pedidos'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/anuncios" element={<Anuncios />} />
      <Route path="/produtos/novo" element={<CadastroProduto />} />
      <Route path="/pedidos" element={<Pedidos />} />
    </Routes>
  )
}

export default App
