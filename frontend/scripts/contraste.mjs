// Contraste WCAG 2.x dos tokens do index.css.
//
//   node scripts/contraste.mjs
//
// Compõe as cores em alpha sobre o fundo real antes de medir (preto a 60%
// sobre branco não é o mesmo cinza que sobre #F5F5F5). Quando um token mudar,
// rode e cole a saída na tabela do index.css — a tabela nunca é escrita à mão.

function hex(h) {
  h = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
function compor(fg, alpha, bg) {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)))
}
function luminancia([r, g, b]) {
  const f = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function razao(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
function nivel(r, grande) {
  if (r >= 7) return 'AAA'
  if (r >= 4.5) return 'AA'
  if (r >= 3) return grande ? 'AA grande' : 'so grande'
  return 'FALHA'
}

const BRANCO = hex('#ffffff')

// Fundos onde texto aparece. Os tints são a cor a 10% sobre branco.
const FUNDOS = {
  surface: BRANCO,
  base: hex('#ededed'),
  raised: hex('#f5f5f5'),
  yellow: hex('#ffe600'),
  blue: hex('#3483fa'),
  'blue-tint': compor(hex('#4189e6'), 0.1, BRANCO),
  'success-tint': compor(hex('#00a650'), 0.1, BRANCO),
  'warning-tint': compor(hex('#ff7733'), 0.1, BRANCO),
  'danger-tint': compor(hex('#f23d4f'), 0.1, BRANCO),
}

// Tokens usados como texto: [hex, alpha]. Espelha o @theme.
const TEXTOS = {
  ink: ['#000000', 0.9],
  'ink-soft': ['#000000', 0.7],
  'ink-faint': ['#000000', 0.6],
  'ink-on-yellow': ['#000000', 0.9],
  'ink-on-blue': ['#ffffff', 1],
  'blue-ink': ['#2968c8', 1],
  'success-ink': ['#007a3a', 1],
  'warning-ink': ['#b84300', 1],
  'danger-ink': ['#c62d3d', 1],
  success: ['#00a650', 1],
}

// [texto, fundo, éTextoGrande]. Um par por combinação que existe na UI.
const PARES = [
  ['ink', 'surface'], ['ink', 'base'], ['ink', 'raised'],
  ['ink-soft', 'surface'], ['ink-soft', 'base'], ['ink-soft', 'raised'],
  ['ink-faint', 'surface'], ['ink-faint', 'base'], ['ink-faint', 'raised'],
  ['ink-on-yellow', 'yellow'],
  ['blue-ink', 'surface'], ['blue-ink', 'raised'], ['blue-ink', 'blue-tint'],
  ['ink-on-blue', 'blue', true],
  ['success-ink', 'success-tint'], ['success', 'surface', true],
  ['warning-ink', 'surface'], ['warning-ink', 'raised'], ['warning-ink', 'warning-tint'],
  ['danger-ink', 'surface'], ['danger-ink', 'raised'], ['danger-ink', 'danger-tint'],
]

console.log(' *   texto            fundo          razao  nivel')
for (const [t, f, grande] of PARES) {
  const [h, alpha] = TEXTOS[t]
  const fg = alpha < 1 ? compor(hex(h), alpha, FUNDOS[f]) : hex(h)
  const r = razao(fg, FUNDOS[f])
  console.log(' *   ' + t.padEnd(17) + f.padEnd(15) + r.toFixed(2).padEnd(7) + nivel(r, grande))
}
