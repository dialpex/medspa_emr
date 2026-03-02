"use client"

import { RuntimeLoader } from "@rive-app/react-webgl2"
import { useEffect } from "react"

/**
 * Preloads the Rive WASM runtime on mount so it's ready
 * before any Persona component renders. Renders nothing.
 */
export function RivePreload() {
  useEffect(() => {
    RuntimeLoader.awaitInstance()
  }, [])
  return null
}
