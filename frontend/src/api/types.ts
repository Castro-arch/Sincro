// Espelha src/common/ml-attribute.type.ts e src/products/dto/update-status.dto.ts no backend.

export interface MlAttribute {
  id: string
  name?: string
  value_id?: string
  value_name?: string
}

export type StatusMl = 'active' | 'paused' | 'closed'
