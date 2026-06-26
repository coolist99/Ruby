// 通用 UI 原语 + Toast 反馈
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Feather, Info, X } from 'lucide-react'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

// ───────── Card 容器 ─────────
export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('card p-5', className)}>{children}</div>
}

// ───────── 页面标题 ─────────
export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  )
}

// ───────── Logo ─────────
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-2xl text-white shadow-soft"
      style={{
        width: size,
        height: size,
        backgroundImage: 'linear-gradient(135deg, var(--color-brand-300), var(--color-brand-500))',
      }}
    >
      <Feather size={size * 0.5} strokeWidth={2.2} />
    </div>
  )
}

// ───────── Button ─────────
type BtnVariant = 'grad' | 'soft' | 'ghost' | 'danger'
export function Button({
  children,
  variant = 'soft',
  className,
  ...rest
}: {
  children: ReactNode
  variant?: BtnVariant
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles: Record<BtnVariant, string> = {
    grad: 'btn-grad',
    soft: 'bg-white text-ink border border-line hover:border-brand-200 hover:bg-brand-50/50 shadow-sm',
    ghost: 'text-muted hover:text-ink hover:bg-black/5',
    danger: 'bg-red-50 text-neg border border-red-100 hover:bg-red-100/70',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-40',
        styles[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ───────── Badge ─────────
export function Badge({
  children,
  color,
  className,
}: {
  children: ReactNode
  color?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        className,
      )}
      style={
        color
          ? { backgroundColor: `${color}22`, color }
          : { backgroundColor: 'var(--color-brand-50)', color: 'var(--color-brand-600)' }
      }
    >
      {children}
    </span>
  )
}

// ───────── 课时数字（正蓝 / 零橙 / 负红）─────────
export function CreditPill({ n, className }: { n: number; className?: string }) {
  const tone = n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero'
  const map = {
    pos: { bg: 'rgba(79,134,224,0.12)', fg: 'var(--color-pos)' },
    neg: { bg: 'rgba(233,106,91,0.13)', fg: 'var(--color-neg)' },
    zero: { bg: 'rgba(241,161,58,0.14)', fg: 'var(--color-zero)' },
  } as const
  return (
    <span
      className={cn(
        'inline-flex min-w-9 items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums',
        className,
      )}
      style={{ backgroundColor: map[tone].bg, color: map[tone].fg }}
    >
      {n > 0 ? `+${n}` : n}
    </span>
  )
}

// ───────── 表单 ─────────
export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

const inputBase =
  'w-full rounded-2xl border border-line bg-white/80 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-100'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, props.className)} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, 'resize-none', props.className)} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(inputBase, 'appearance-none bg-no-repeat pr-9', props.className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239b95ad' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.85rem center',
      }}
    />
  )
}

// ───────── Modal ─────────
export function Modal({
  open,
  onClose,
  title,
  accent,
  icon,
  children,
  footer,
  width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: string
  accent?: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-[#2a2140]/30 backdrop-blur-sm animate-fade"
        onClick={onClose}
      />
      <div
        className={cn(
          'card relative z-10 w-full overflow-hidden animate-pop p-0',
          width,
        )}
      >
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{
            background: accent
              ? `linear-gradient(135deg, ${accent}, ${accent}cc)`
              : 'linear-gradient(135deg, var(--color-brand-400), var(--color-brand-500))',
          }}
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/25 text-white">
            {icon}
          </span>
          <h3 className="text-base font-bold text-white drop-shadow-sm">{title}</h3>
          <button
            onClick={onClose}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-6 pb-5">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ───────── EmptyState ─────────
export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-line bg-white/40 px-6 py-14 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-400">
        {icon}
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  )
}

// ───────── Toast ─────────
type Tone = 'success' | 'info'
type ToastItem = { id: number; msg: string; tone: Tone }
const ToastCtx = createContext<(msg: string, tone?: Tone) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((msg: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random()
    setItems((cur) => [...cur, { id, msg, tone }])
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 2600)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
          {items.map((t) => (
            <div
              key={t.id}
              className="card flex animate-rise items-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink shadow-pop"
            >
              {t.tone === 'success' ? (
                <CheckCircle2 size={18} className="text-mint" />
              ) : (
                <Info size={18} className="text-brand-500" />
              )}
              {t.msg}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}
