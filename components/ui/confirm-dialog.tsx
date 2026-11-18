"use client"

import * as React from "react"

import { Button } from "./button"
import { Dialog } from "./dialog"
import { mountOnce } from "./portal-host"

export interface ConfirmDialogProps {
  open: boolean
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` (default) paints the confirm button red; `default` uses gold. */
  tone?: "danger" | "default"
  /** Shows a spinner on the confirm button and blocks closing. */
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Themed replacement for window.confirm(). Cancel is focused first so Enter
 * never triggers the destructive action by accident.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  tone = "danger",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      dismissible={!pending}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "gold"} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}

export type ConfirmOptions = Pick<
  ConfirmDialogProps,
  "title" | "description" | "confirmLabel" | "cancelLabel" | "tone"
>

type Request = ConfirmOptions & { resolve: (ok: boolean) => void }

let pushRequest: ((req: Request) => void) | null = null
const backlog: Request[] = []

function ConfirmHost() {
  const [queue, setQueue] = React.useState<Request[]>([])

  React.useEffect(() => {
    pushRequest = (req) => setQueue((q) => [...q, req])
    if (backlog.length) setQueue((q) => [...q, ...backlog.splice(0)])
    return () => {
      pushRequest = null
    }
  }, [])

  const current = queue[0]
  const settle = (ok: boolean) => {
    current?.resolve(ok)
    setQueue((q) => q.slice(1))
  }

  return (
    <ConfirmDialog
      open={Boolean(current)}
      title={current?.title ?? ""}
      description={current?.description}
      confirmLabel={current?.confirmLabel}
      cancelLabel={current?.cancelLabel}
      tone={current?.tone}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )
}

/**
 * Promise-based confirm, callable from any client event handler:
 *
 *   if (!(await confirmDialog({ title: 'این آدرس حذف شود؟', confirmLabel: 'حذف' }))) return;
 *
 * Needs no provider: the dialog host mounts itself on first use.
 */
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false)
  const opts: ConfirmOptions = typeof options === "string" ? { title: options } : options
  return new Promise<boolean>((resolve) => {
    const req: Request = { ...opts, resolve }
    if (pushRequest) {
      pushRequest(req)
    } else {
      backlog.push(req)
      mountOnce("confirm", <ConfirmHost />)
    }
  })
}

/** Hook form of {@link confirmDialog}: `const confirm = useConfirm()`. */
export function useConfirm(): (options: ConfirmOptions | string) => Promise<boolean> {
  return confirmDialog
}
