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
 * Tipado pela documentacao, NAO verificado contra resposta real do ML.
 *
 * Verificar significa: confirmar que POST /pictures/items/upload devolve `id`
 * na raiz e que `variations[]` traz mesmo `secure_url`. Remover este
 * comentario apos o primeiro upload bem sucedido.
 */
export interface MlPictureUploadResponse {
  id: string;
  max_size?: string;
  variations?: Array<{ id: string; url: string; secure_url: string; size: string }>;
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
