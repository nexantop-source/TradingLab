'use client';

import * as React from 'react';
import { cn } from './cn';

/* ═══════════════════════════════════════════════════════════════════════════
   Primitivas del sistema de diseño.
   Accesibles por construcción: foco visible, roles correctos, área táctil.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Botón ───────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'positive' | 'negative' | 'gold';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-blue)] text-white hover:brightness-110 active:brightness-95 shadow-[var(--shadow-glow-blue)]',
  secondary:
    'bg-[var(--color-elevated)] text-[var(--color-text)] border border-[var(--color-border-strong)] hover:bg-[color-mix(in_srgb,var(--color-elevated)_80%,var(--color-text))]',
  ghost: 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-overlay)]',
  outline:
    'border border-[var(--color-border-strong)] text-[var(--color-text)] hover:border-[var(--color-blue)] hover:text-[var(--color-blue)]',
  positive: 'bg-[var(--color-positive)] text-[#04231b] hover:brightness-110 font-semibold',
  negative: 'bg-[var(--color-negative)] text-[#2a0710] hover:brightness-110 font-semibold',
  gold: 'bg-[var(--color-gold)] text-[#2a1c05] hover:brightness-110 font-semibold',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-[var(--radius-sm)] gap-1.5',
  md: 'h-11 px-5 text-sm rounded-[var(--radius-md)] gap-2',
  lg: 'h-13 px-7 text-[15px] rounded-[var(--radius-md)] gap-2.5',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-[background-color,border-color,color,filter,box-shadow] duration-200',
        'disabled:opacity-45 disabled:pointer-events-none select-none',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Tarjeta ─────────────────────────────────────────────────────────────────

export function Card({
  className,
  elevated,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-soft)]',
        elevated
          ? 'bg-[var(--color-elevated)] shadow-[var(--shadow-soft)]'
          : 'bg-[var(--color-surface)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pt-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold tracking-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[13px] text-[var(--color-muted)] leading-relaxed', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />;
}

// ── Píldora / etiqueta ──────────────────────────────────────────────────────

type BadgeTone = 'neutral' | 'blue' | 'violet' | 'positive' | 'negative' | 'gold';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--color-overlay)] text-[var(--color-muted)] border-[var(--color-border)]',
  blue: 'bg-[var(--color-blue-soft)] text-[var(--color-blue)] border-[color-mix(in_srgb,var(--color-blue)_28%,transparent)]',
  violet: 'bg-[var(--color-violet-soft)] text-[var(--color-violet)] border-[color-mix(in_srgb,var(--color-violet)_28%,transparent)]',
  positive: 'bg-[var(--color-positive-soft)] text-[var(--color-positive)] border-[color-mix(in_srgb,var(--color-positive)_28%,transparent)]',
  negative: 'bg-[var(--color-negative-soft)] text-[var(--color-negative)] border-[color-mix(in_srgb,var(--color-negative)_28%,transparent)]',
  gold: 'bg-[var(--color-gold-soft)] text-[var(--color-gold)] border-[color-mix(in_srgb,var(--color-gold)_28%,transparent)]',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-[11px] font-medium leading-none tracking-wide',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

// ── Campos de formulario ────────────────────────────────────────────────────

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-[var(--color-text)]">
        {label}
        {required && (
          <span className="text-[var(--color-negative)] ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
            'aria-invalid': error ? true : undefined,
          })
        : children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-[var(--color-muted)] leading-relaxed">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-[var(--color-negative)] leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
}

const FIELD_BASE =
  'w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-subtle)] transition-colors focus:border-[var(--color-blue)] disabled:opacity-50 aria-[invalid=true]:border-[var(--color-negative)]';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(FIELD_BASE, 'h-11', className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(FIELD_BASE, 'py-2.5 min-h-24 resize-y', className)} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(FIELD_BASE, 'h-11 pr-9 appearance-none cursor-pointer', className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; description?: string }) {
  const id = props.id ?? React.useId();
  return (
    <div className={cn('flex gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4.5 shrink-0 cursor-pointer rounded-[4px] border border-[var(--color-border-strong)] bg-[var(--color-bg)] accent-[var(--color-blue)]"
        {...props}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-[13px] leading-snug text-[var(--color-text)]">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{description}</p>}
      </div>
    </div>
  );
}

// ── Segmentado ──────────────────────────────────────────────────────────────

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  title?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-[calc(var(--radius-sm)-2px)] font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active
                ? 'bg-[var(--color-elevated)] text-[var(--color-text)] shadow-[var(--shadow-soft)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Aviso ───────────────────────────────────────────────────────────────────

export function Callout({
  tone = 'info',
  title,
  children,
  icon,
  className,
}: {
  tone?: 'info' | 'warning' | 'success' | 'danger';
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-[color-mix(in_srgb,var(--color-blue)_30%,transparent)] bg-[var(--color-blue-soft)]',
    warning: 'border-[color-mix(in_srgb,var(--color-gold)_30%,transparent)] bg-[var(--color-gold-soft)]',
    success: 'border-[color-mix(in_srgb,var(--color-positive)_30%,transparent)] bg-[var(--color-positive-soft)]',
    danger: 'border-[color-mix(in_srgb,var(--color-negative)_30%,transparent)] bg-[var(--color-negative-soft)]',
  };
  return (
    <div className={cn('rounded-[var(--radius-md)] border p-4', tones[tone], className)}>
      <div className="flex gap-3">
        {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
        <div className="min-w-0 space-y-1">
          {title && <p className="text-[13px] font-semibold">{title}</p>}
          <div className="text-[13px] leading-relaxed text-[var(--color-muted)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ── Barra de progreso ───────────────────────────────────────────────────────

export function Progress({
  value,
  max = 100,
  label,
  tone = 'blue',
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  tone?: 'blue' | 'positive' | 'gold' | 'violet';
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = {
    blue: 'var(--color-blue)',
    positive: 'var(--color-positive)',
    gold: 'var(--color-gold)',
    violet: 'var(--color-violet)',
  };
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-overlay)]', className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-soft)]"
        style={{ width: `${pct}%`, backgroundColor: colors[tone] }}
      />
    </div>
  );
}

// ── Cifra con variación ─────────────────────────────────────────────────────

/**
 * Presentación de una variación. No depende solo del color: incluye signo,
 * flecha e icono textual, para cumplir el criterio de accesibilidad de no
 * codificar información únicamente mediante rojo y verde.
 */
export function Delta({
  value,
  suffix = '%',
  decimals = 2,
  size = 'md',
  className,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const positive = value > 0;
  const negative = value < 0;
  const color = positive
    ? 'text-[var(--color-positive)]'
    : negative
      ? 'text-[var(--color-negative)]'
      : 'text-[var(--color-muted)]';
  const sizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
  const arrow = positive ? '▲' : negative ? '▼' : '■';
  const word = positive ? 'sube' : negative ? 'baja' : 'sin cambio';

  return (
    <span className={cn('num inline-flex items-center gap-1 font-medium', color, sizes[size], className)}>
      <span aria-hidden="true" className="text-[0.75em]">
        {arrow}
      </span>
      <span>
        {positive ? '+' : ''}
        {value.toFixed(decimals)}
        {suffix}
      </span>
      <span className="sr-only">({word})</span>
    </span>
  );
}

// ── Estado vacío ────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--color-overlay)] text-[var(--color-muted)]">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--color-muted)]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Tooltip accesible ───────────────────────────────────────────────────────

export function InfoTip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label="Más información"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="flex size-4 items-center justify-center rounded-full border border-[var(--color-border-strong)] text-[9px] font-bold text-[var(--color-muted)] hover:text-[var(--color-text)]"
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-2.5 text-[11px] leading-relaxed text-[var(--color-muted)] shadow-[var(--shadow-lifted)]"
        >
          {text}
        </span>
      )}
    </span>
  );
}

// ── Diálogo modal ───────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Retención de foco dentro del diálogo.
      if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, input, [href]')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)]',
          'border border-[var(--color-border-strong)] bg-[var(--color-elevated)]',
          'shadow-[var(--shadow-lifted)] animate-sheet-up sm:animate-fade-up',
          'max-h-[92vh] overflow-y-auto',
          sizes[size],
        )}
      >
        <div className="border-b border-[var(--color-border)] px-6 py-5">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">{description}</p>
          )}
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tabla responsive ────────────────────────────────────────────────────────

/**
 * En pantallas estrechas la tabla se convierte en tarjetas apiladas, según el
 * requisito de experiencia móvil.
 */
export function DataTable<T>({
  columns,
  rows,
  keyOf,
  empty,
  caption,
}: {
  columns: Array<{
    key: string;
    header: string;
    render: (row: T) => React.ReactNode;
    align?: 'left' | 'right' | 'center';
    hideOnMobile?: boolean;
  }>;
  rows: T[];
  keyOf: (row: T) => string;
  empty?: React.ReactNode;
  caption?: string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <>
      {/* Vista de tabla, a partir de md */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]',
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyOf(row)}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-overlay)]"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-3 py-3',
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vista de tarjetas, por debajo de md */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div
            key={keyOf(row)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5"
          >
            {columns
              .filter((c) => !c.hideOnMobile)
              .map((c) => (
                <div key={c.key} className="flex items-baseline justify-between gap-3 py-1">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--color-muted)]">
                    {c.header}
                  </span>
                  <span className="text-right text-[13px]">{c.render(row)}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Pestañas ────────────────────────────────────────────────────────────────

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  className,
}: {
  tabs: Array<{ id: T; label: string; count?: number }>;
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex gap-1 overflow-x-auto border-b border-[var(--color-border)]', className)}
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative shrink-0 px-3.5 py-2.5 text-[13px] font-medium transition-colors',
              isActive
                ? 'text-[var(--color-text)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="num ml-1.5 text-[11px] text-[var(--color-subtle)]">{t.count}</span>
            )}
            {isActive && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--color-blue)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-[var(--radius-sm)]', className)} aria-hidden="true" />;
}
