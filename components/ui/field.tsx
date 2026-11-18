import * as React from "react"

import { cn } from "@/lib/utils"

type ControlProps = {
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean | "true" | "false"
  "aria-required"?: boolean
}

export interface FieldProps {
  label: React.ReactNode
  /** Helper text under the control. */
  hint?: React.ReactNode
  /** Validation message; when set the control gets aria-invalid and the text is announced. */
  error?: React.ReactNode
  /** Shows a gold asterisk and sets aria-required on the control. */
  required?: boolean
  /** Shows a muted "(اختیاری)" after the label. */
  optional?: boolean
  /** Explicit control id. Defaults to the child's own id, then a generated one. */
  htmlFor?: string
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean
  className?: string
  /** Exactly one form control element (Input, Textarea, Select, or a native control). */
  children: React.ReactElement<ControlProps>
}

/**
 * Label + control + hint + error, wired together:
 * the label points at the control, and hint/error ids are added to aria-describedby.
 */
export function Field({
  label,
  hint,
  error,
  required,
  optional,
  htmlFor,
  hideLabel,
  className,
  children,
}: FieldProps) {
  const generatedId = React.useId()
  const id = htmlFor ?? children.props.id ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy =
    [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined

  const control = React.cloneElement(children, {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    "aria-required": required || children.props["aria-required"],
  })

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className={cn("field-label", hideLabel && "sr-only")}>
        {label}
        {required && (
          <span className="ms-1 text-primary" aria-hidden>
            *
          </span>
        )}
        {optional && <span className="ms-1 text-xs font-normal text-muted-foreground">(اختیاری)</span>}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}

/** Alias kept for readability in long forms. */
export const FormField = Field
