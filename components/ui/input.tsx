import * as React from "react"

import { cn } from "@/lib/utils"

type ControlSize = "sm" | "md" | "lg"

const SIZE_CLASS: Record<ControlSize, string> = { sm: "field-sm", md: "", lg: "field-lg" }

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Visual height: sm 36px, md 44px (default), lg 48px. */
  controlSize?: ControlSize
  /** Marks the control invalid (red border + aria-invalid). `<Field error>` sets this for you. */
  invalid?: boolean
}

/** Text input using the shared `.field` look (44px, rounded-xl, gold focus). */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, controlSize = "md", invalid, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn("field", SIZE_CLASS[controlSize], className)}
        aria-invalid={invalid || undefined}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

/** Multi-line input; grows from 3 rows, vertically resizable. */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 3, ...props }, ref) => {
    return (
      <textarea
        rows={rows}
        className={cn("field", className)}
        aria-invalid={invalid || undefined}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  controlSize?: ControlSize
  invalid?: boolean
  /** Renders a disabled empty first option, e.g. "انتخاب کنید". */
  placeholder?: string
}

/** Native select with the shared `.field` look and a chevron on the inline-end side. */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, controlSize = "md", invalid, placeholder, children, ...props }, ref) => {
    return (
      <select
        className={cn("field", SIZE_CLASS[controlSize], className)}
        aria-invalid={invalid || undefined}
        ref={ref}
        {...props}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
    )
  }
)
Select.displayName = "Select"

export { Input, Textarea, Select }
