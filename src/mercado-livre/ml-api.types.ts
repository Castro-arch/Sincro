/** Tipos das respostas da API do Mercado Livre que o Sincro consome. */

export interface MlTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id?: number;
  refresh_token: string;
}

export interface MlUserResponse {
  id: number;
  nickname: string;
  site_id: string;
}

export interface MlCategoryPrediction {
  category_id: string;
  category_name: string;
  domain_id?: string;
  domain_name?: string;
  attributes?: Array<{ id: string; name: string; value_id?: string; value_name?: string }>;
}

export interface MlAttributeValue {
  id: string;
  name: string;
}

export interface MlCategoryAttribute {
  id: string;
  name: string;
  value_type: string;
  tags?: Record<string, boolean>;
  values?: MlAttributeValue[];
  allowed_units?: Array<{ id: string; name: string }>;
  hint?: string;
}

/**
 * `max_size` fica opcional porque nao aparece nas respostas observadas;
 * nenhuma parte do codigo depende dele.
 */
export interface MlPictureUploadResponse {
  id: string;
  max_size?: string;
  variations?: Array<{ url: string; secure_url: string; size: string }>;
}

export interface MlItemVariationResponse {
  id: number;
  price: number;
  available_quantity: number;
  attribute_combinations: Array<{ id: string; name: string; value_name: string }>;
  picture_ids?: string[];
}

export interface MlItemResponse {
  id: string;
  title: string;
  category_id: string;
  price?: number;
  available_quantity?: number;
  status: string;
  permalink: string;
  variations?: MlItemVariationResponse[];
}

export interface MlOrderItem {
  item: {
    id: string;
    title: string;
    variation_id?: number | null;
    seller_sku?: string | null;
  };
  quantity: number;
  unit_price: number;
  /**
   * Comissao cobrada pelo ML neste item. Confirmada na doc de orders (dois
   * exemplos) mas ainda nao observada ao vivo: a conta nao teve vendas. E
   * opcional porque a doc avisa que so existe apos a acreditacao do pagamento.
   */
  sale_fee?: number;
  listing_type_id?: string;
}

export interface MlOrder {
  id: number;
  status: string;
  date_created: string;
  date_closed?: string;
  total_amount: number;
  order_items: MlOrderItem[];
}

export interface MlOrderSearchResponse {
  results: MlOrder[];
  paging: { total: number; offset: number; limit: number };
}

// ---------------------------------------------------------------- perguntas
// Confirmado ao vivo em 2026-09-10 (envelope e filtros de GET /questions/search
// com api_version=4). O shape de cada pergunta e o de POST /answers vem da
// doc: a conta ainda nao recebeu pergunta nenhuma e o ML nao deixa perguntar
// no proprio anuncio, entao so a primeira pergunta real vai confirma-los.

export type MlQuestionStatus =
  | 'UNANSWERED'
  | 'ANSWERED'
  | 'CLOSED_UNANSWERED'
  | 'UNDER_REVIEW'
  | 'BANNED'
  | 'DELETED'
  | 'DISABLED';

export interface MlQuestionAnswer {
  text: string;
  status: string;
  date_created: string;
}

export interface MlQuestion {
  id: number;
  item_id: string;
  seller_id: number;
  status: MlQuestionStatus;
  /** Vazio quando a pergunta esta BANNED. */
  text: string;
  date_created: string;
  deleted_from_listing?: boolean;
  hold?: boolean;
  suspected_spam?: boolean;
  answer: MlQuestionAnswer | null;
  from: { id: number };
}

export interface MlQuestionSearchResponse {
  total: number;
  limit: number;
  questions: MlQuestion[];
}
