import { apiGet } from '@/api/client'
import type { ConexaoMl } from '@/api/dashboard'

// Espelha MlAuthStatus de src/mercado-livre/auth/ml-auth.service.ts.
// Endpoint leve: só o estado do token, sem os agregados do dashboard.
export function getStatusMl(): Promise<ConexaoMl> {
  return apiGet<ConexaoMl>('/ml/auth/status')
}
