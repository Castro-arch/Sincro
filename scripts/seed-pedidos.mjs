// Semeia pedidos FICTÍCIOS para exercitar o relatório de Margem.
//
//   node scripts/seed-pedidos.mjs          insere
//   node scripts/seed-pedidos.mjs --limpar remove só o que este script criou
//
// A conta ainda não teve vendas reais. Duas salvaguardas, como no seed de
// perguntas:
//   1. ml_order_id começa com "SEED-" — ids reais do ML são numéricos de 16
//      dígitos, então o prefixo não colide nem passa por real;
//   2. a limpeza é por prefixo do id, não por valor ou data.
//
// Cobre de propósito os três estados que a tela precisa rotular:
//   - taxa real (sale_fee veio do ML) + custo cadastrado;
//   - taxa ESTIMADA (sale_fee ausente: comissão ainda não creditada);
//   - produto SEM custo de aquisição.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const PREFIXO = 'SEED-'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const cliente = new pg.Client({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
})

const dias = (d) => new Date(Date.now() - d * 86_400_000).toISOString()
const limpar = process.argv.includes('--limpar')

await cliente.connect()
try {
  if (limpar) {
    const { rowCount } = await cliente.query(
      `DELETE FROM orders WHERE ml_order_id LIKE $1`,
      [PREFIXO + '%'],
    )
    await cliente.query(`UPDATE products SET custo_unitario = NULL WHERE sku LIKE 'TESTE-SINCRO-%'`)
    console.log(`${rowCount} pedido(s) de seed removido(s); custos de teste limpos.`)
  } else {
    const { rows } = await cliente.query(
      // Sem filtrar por ml_item_id: um rascunho nunca publicado tambem serve
      // de alvo, e e justamente ele que exercita o rotulo "sem custo".
      `SELECT l.id AS listing_id, COALESCE(l.ml_item_id, 'SEED-ITEM-' || p.sku) AS ml_item_id,
              p.id AS product_id, p.sku,
              (SELECT v.id FROM ml_variations v WHERE v.listing_id = l.id LIMIT 1) AS variation_id
         FROM ml_listings l JOIN products p ON p.id = l.product_id
        ORDER BY p.sku DESC`,
    )
    if (rows.length === 0) throw new Error('Nenhum anúncio publicado.')

    // Só o primeiro produto ganha custo: o segundo exercita o rótulo "sem custo".
    await cliente.query(`UPDATE products SET custo_unitario = 14.50 WHERE id = $1`, [rows[0].product_id])

    const pedidos = [
      // taxa REAL: sale_fee creditado pelo ML
      { alvo: 0, n: 1, qtd: 2, valor: 79.8, taxa: 22.48, d: 3 },
      { alvo: 0, n: 2, qtd: 1, valor: 39.9, taxa: 11.24, d: 9 },
      // taxa ESTIMADA: comissão ainda não creditada (sale_fee ausente)
      { alvo: 0, n: 3, qtd: 1, valor: 39.9, taxa: null, d: 1 },
    ]
    if (rows[1]) pedidos.push({ alvo: 1, n: 4, qtd: 1, valor: 89.9, taxa: 25.33, d: 5 })

    for (const p of pedidos) {
      const alvo = rows[p.alvo]
      await cliente.query(
        `INSERT INTO orders
           (ml_order_id, ml_item_id, ml_variation_id, variation_id, listing_id,
            quantidade, valor, status, status_ml, taxa_ml, estoque_baixado, data_pedido)
         VALUES ($1,$2,'',$3,$4,$5,$6,'pago','paid',$7,true,$8)
         ON CONFLICT (ml_order_id, ml_item_id, ml_variation_id) DO NOTHING`,
        [
          `${PREFIXO}${String(p.n).padStart(4, '0')}`,
          alvo.ml_item_id,
          alvo.variation_id,
          alvo.listing_id,
          p.qtd,
          p.valor,
          p.taxa,
          dias(p.d),
        ],
      )
    }
    console.log(`${pedidos.length} pedido(s) de seed inseridos. Custo de R$ 14,50 em ${rows[0].sku}; ${rows[1]?.sku ?? '(nenhum outro)'} fica sem custo.`)
  }
} finally {
  await cliente.end()
}
