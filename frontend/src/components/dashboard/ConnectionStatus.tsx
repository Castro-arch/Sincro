import { StatusDot } from '@/components/ui/StatusDot'
import { formatSegundos } from '@/lib/format'
import type { ConexaoMl } from '@/api/dashboard'

const AVISO_RENOVACAO_SEGUNDOS = 15 * 60

export function ConnectionStatus({ conexao }: { conexao: ConexaoMl }) {
  const tone =
    !conexao.conectado || conexao.expirado
      ? 'danger'
      : conexao.segundosParaExpirar !== null &&
          conexao.segundosParaExpirar < AVISO_RENOVACAO_SEGUNDOS
        ? 'warning'
        : 'ok'

  return (
    <div className="flex flex-col gap-3 border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <StatusDot tone={tone} />
        Mercado Livre
      </div>
      {conexao.conectado ? (
        <p className="text-sm text-ink-soft">
          Conectado como <span className="text-ink">{conexao.nickname ?? conexao.mlUserId}</span>.
          {conexao.segundosParaExpirar !== null && (
            <>
              {' '}
              Token renova em{' '}
              <span className="font-mono text-ink">
                {formatSegundos(conexao.segundosParaExpirar)}
              </span>
              .
            </>
          )}
        </p>
      ) : (
        <p className="text-sm text-ink-soft">
          Sem autorização ativa — abra{' '}
          <span className="font-mono text-ink">/ml/auth/login</span> pra reconectar.
        </p>
      )}
    </div>
  )
}
