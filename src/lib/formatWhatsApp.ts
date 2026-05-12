/**
 * Formata um número de telefone brasileiro para um link wa.me válido.
 *
 * Lógica:
 *  1. Remove todos os caracteres não-numéricos.
 *  2. Se já começar com "55" e tiver 12+ dígitos (55 + DDD + número), usa direto.
 *  3. Caso contrário, adiciona o código do Brasil (55) na frente.
 *  4. Retorna https://wa.me/<número_com_país>
 *

 */
export function formatWhatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // Se já começa com 55 e tem 12 ou mais dígitos, assume que o DDI está correto
  const withCountry =
    digits.startsWith("55") && digits.length >= 12
      ? digits
      : `55${digits}`;

  return `https://wa.me/${withCountry}`;
}
