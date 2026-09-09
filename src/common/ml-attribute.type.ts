/**
 * Atributo no formato do Mercado Livre. Serve tanto para os `attributes` do
 * item quanto para os `attribute_combinations` das variacoes -- os dois usam a
 * mesma forma, mudando so onde entram no payload.
 *
 * Fica em `common/` porque atravessa as entidades, os DTOs e a camada de
 * integracao; deixar cada uma com sua propria versao so geraria casts.
 */
export interface MlAttribute {
  id: string;
  name?: string;
  value_id?: string;
  value_name?: string;
}
