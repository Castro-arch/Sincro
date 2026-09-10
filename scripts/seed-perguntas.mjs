// Semeia perguntas FICTÍCIAS em ml_questions para exercitar a tela.
//
//   node scripts/seed-perguntas.mjs          insere
//   node scripts/seed-perguntas.mjs --limpar remove só o que este script criou
//
// O ML não permite perguntar no próprio anúncio, então não há como gerar
// pergunta real de teste. Duas salvaguardas para esse dado nunca se
// confundir com produção:
//
//   1. ml_question_id começa em 9_999_000_000_001. Ids reais do ML têm ~11
//      dígitos (ex.: 11764931832); estes têm 13 e ficam ordens de grandeza
//      acima, então nunca colidem nem passam por reais.
//   2. o texto começa com [SEED] — visível na tela e grepável no banco.
//
// A limpeza é por faixa de id, não por texto: se alguém editar o texto, o
// registro continua identificável.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const PREFIXO = '[SEED]'
const PRIMEIRO_ID = 9_999_000_000_001n

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

const horas = (h) => new Date(Date.now() - h * 3_600_000).toISOString()

// Uma por faixa de tempo, para conferir os três tons do destaque.
const PERGUNTAS = [
  { texto: 'Tem disponibilidade para entrega em SP capital?', horasAtras: 0.2, status: 'UNANSWERED' },
  { texto: 'Essa caneca pode ir ao microondas?', horasAtras: 3, status: 'UNANSWERED' },
  { texto: 'Vocês fazem nota fiscal para empresa?', horasAtras: 30, status: 'UNANSWERED' },
  {
    texto: 'Qual a capacidade em ml?',
    horasAtras: 50,
    status: 'ANSWERED',
    resposta: 'São 300ml. Obrigado pelo contato!',
  },
]

const limpar = process.argv.includes('--limpar')

await cliente.connect()
try {
  if (limpar) {
    const { rowCount } = await cliente.query(
      'DELETE FROM ml_questions WHERE ml_question_id >= $1',
      [PRIMEIRO_ID.toString()],
    )
    console.log(`${rowCount} pergunta(s) de seed removida(s).`)
  } else {
    const { rows } = await cliente.query(
      `SELECT id, ml_item_id FROM ml_listings WHERE ml_item_id IS NOT NULL ORDER BY criado_em LIMIT 1`,
    )
    if (rows.length === 0) throw new Error('Nenhum anúncio publicado para associar as perguntas.')
    const { id: listingId, ml_item_id: mlItemId } = rows[0]

    for (const [i, p] of PERGUNTAS.entries()) {
      await cliente.query(
        `INSERT INTO ml_questions
           (ml_question_id, ml_item_id, listing_id, from_user_id, texto, status,
            resposta_texto, resposta_status, respondida_em, respondida_pelo_sincro, data_pergunta)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (ml_question_id) DO NOTHING`,
        [
          (PRIMEIRO_ID + BigInt(i)).toString(),
          mlItemId,
          listingId,
          '555000111',
          `${PREFIXO} ${p.texto}`,
          p.status,
          p.resposta ?? null,
          p.resposta ? 'ACTIVE' : null,
          p.resposta ? horas(p.horasAtras - 1) : null,
          false,
          horas(p.horasAtras),
        ],
      )
    }
    console.log(`${PERGUNTAS.length} pergunta(s) de seed inseridas no anúncio ${mlItemId}.`)
  }
} finally {
  await cliente.end()
}
