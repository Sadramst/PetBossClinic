"use client"

import type { ReactNode } from "react"
import { createRoot } from "react-dom/client"

const mounted = new Set<string>()

/**
 * Renders `node` once into its own container at the end of <body>. Lets the
 * imperative helpers (`toast()`, `confirmDialog()`) work on any screen without
 * a provider having to be mounted in a layout first.
 */
export function mountOnce(key: string, node: ReactNode): void {
  if (typeof document === "undefined" || mounted.has(key)) return
  mounted.add(key)
  const container = document.createElement("div")
  container.setAttribute("data-ui-host", key)
  document.body.appendChild(container)
  createRoot(container).render(node)
}
