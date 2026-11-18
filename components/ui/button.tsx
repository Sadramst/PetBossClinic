import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Spinner } from "./spinner"

/**
 * Shared button look. Mirrors the `.btn*` classes in styles/globals.css so
 * `<Button>` and `<a className="btn btn-gold">` are visually identical.
 * Focus styling comes from the global `:focus-visible` outline.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent text-sm font-bold select-none transition-[background-color,border-color,color,box-shadow,filter,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-55 data-[loading=true]:pointer-events-none data-[loading=true]:opacity-70",
  {
    variants: {
      variant: {
        /** Flat gold. Kept for existing call sites that restyle it through className. */
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        /** Primary call to action: metallic gold gradient. */
        gold: "bg-gradient-gold text-charcoal-950 shadow-gold hover:brightness-110 hover:shadow-gold-lg",
        primary: "bg-gradient-gold text-charcoal-950 shadow-gold hover:brightness-110 hover:shadow-gold-lg",
        outline: "border-border-gold bg-transparent text-primary hover:border-primary hover:bg-primary/10",
        secondary: "border-border bg-surface-elevated text-foreground hover:border-border-gold hover:bg-surface-hover",
        ghost: "bg-transparent text-foreground hover:bg-surface-elevated hover:text-primary",
        destructive: "bg-destructive/90 text-white hover:bg-destructive",
        danger: "bg-destructive/90 text-white hover:bg-destructive",
        dangerOutline: "border-red-500/45 bg-transparent text-red-400 hover:bg-red-500/10",
        link: "h-auto min-h-0 p-0 font-semibold text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "min-h-9 rounded-[0.625rem] px-3.5 py-1 text-xs",
        default: "min-h-11 px-5 py-2",
        md: "min-h-11 px-5 py-2",
        lg: "min-h-12 rounded-[0.875rem] px-7 py-2 text-base",
        icon: "h-11 w-11 p-0",
        iconSm: "h-9 w-9 rounded-[0.625rem] p-0",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      block: false,
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a `<Link>`) with the button styling. */
  asChild?: boolean
  /** Shows a spinner, sets aria-busy and blocks clicks. */
  loading?: boolean
  /** Text shown while loading instead of the children (ignored with asChild). */
  loadingText?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, block, asChild = false, loading = false, loadingText, disabled, children, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const stateProps = asChild
      ? { "aria-disabled": disabled || loading || undefined }
      : { disabled: disabled || loading }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, block }), className)}
        ref={ref}
        data-loading={loading ? "true" : undefined}
        aria-busy={loading || undefined}
        {...stateProps}
        {...props}
      >
        {loading && <Spinner size="sm" className="shrink-0" label={null} />}
        <Slottable>{!asChild && loading && loadingText ? loadingText : children}</Slottable>
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
