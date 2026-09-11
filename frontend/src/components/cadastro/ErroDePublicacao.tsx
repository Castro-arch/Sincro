import { lerErroMl } from '@/lib/erroMl'

/**
 * O `ultimoErro` salvo no anúncio, aberto em causas.
 *
 * É o que guia a correção: sem isto a tela de edição mostraria um formulário
 * em branco e a pessoa teria que adivinhar qual campo o ML recusou.
 */
export function ErroDePublicacao({ bruto }: { bruto: string }) {
  const { resumo, causas } = lerErroMl(bruto)

  return (
    <section className="border border-danger bg-danger-tint p-5">
      <h2 className="text-sm font-semibold text-danger-ink">
        O Mercado Livre recusou a última publicação: {resumo}
      </h2>
      {causas.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-danger-ink">
          {causas.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-soft">
        Corrija os campos abaixo e use <strong>Validar no ML</strong> para conferir antes de
        publicar — a validação não cria nada no Mercado Livre.
      </p>
    </section>
  )
}
