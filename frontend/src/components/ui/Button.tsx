import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Botões do Andes: "loud" é azul sólido com texto branco, "quiet" é o mesmo
 * azul sobre fundo tingido. O amarelo da marca não é cor de ação no ML — é
 * o cabeçalho. Um botão amarelo seria o que o site público nunca faz.
 */
type ButtonVariant = 'primary' | 'secondary'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-blue text-ink-on-blue hover:bg-blue-pressed',
  // Chip branco com elevacao: e o unico desenho que le bem nos tres fundos
  // onde aparece (header amarelo, pagina cinza, cartao branco). O azul a 10%
  // do Andes, sobre o amarelo do header, virava um bloco esverdeado.
  secondary: 'bg-surface text-blue-ink shadow-card hover:bg-surface-raised',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-sm px-6 py-2.5 font-sans text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  )
}
