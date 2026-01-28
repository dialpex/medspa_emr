"use client"

import * as React from "react"
import { motion, type Transition, AnimatePresence } from "motion/react"

import { cn } from "@/lib/utils"

interface MotionHighlightContextType {
  activeValue: string | null
  id: string
  hover: boolean
  registerItem: (value: string, node: HTMLElement | null) => void
  setActiveValue: (value: string | null) => void
}

const MotionHighlightContext = React.createContext<MotionHighlightContextType | null>(null)

function useMotionHighlight() {
  const context = React.useContext(MotionHighlightContext)
  if (!context) {
    throw new Error("useMotionHighlight must be used within a MotionHighlight")
  }
  return context
}

interface MotionHighlightProps {
  children: React.ReactNode
  className?: string
  controlledItems?: boolean
  value?: string
  onValueChange?: (value: string | null) => void
  transition?: Transition
  hover?: boolean
  disabled?: boolean
}

function MotionHighlight({
  children,
  className,
  controlledItems = false,
  value,
  onValueChange,
  transition = {
    type: "spring",
    stiffness: 200,
    damping: 25,
  },
  hover = false,
  disabled = false,
}: MotionHighlightProps) {
  const id = React.useId()
  const [activeValue, setActiveValueState] = React.useState<string | null>(value ?? null)
  const itemsRef = React.useRef(new Map<string, HTMLElement>())

  const isControlled = controlledItems && value !== undefined

  React.useEffect(() => {
    if (isControlled) {
      setActiveValueState(value)
    }
  }, [value, isControlled])

  const registerItem = React.useCallback((itemValue: string, node: HTMLElement | null) => {
    if (node) {
      itemsRef.current.set(itemValue, node)
    } else {
      itemsRef.current.delete(itemValue)
    }
  }, [])

  const setActiveValue = React.useCallback(
    (newValue: string | null) => {
      if (disabled) return
      if (!isControlled) {
        setActiveValueState(newValue)
      }
      onValueChange?.(newValue)
    },
    [isControlled, onValueChange, disabled]
  )

  return (
    <MotionHighlightContext.Provider
      value={{
        activeValue: isControlled ? value : activeValue,
        id,
        hover,
        registerItem,
        setActiveValue,
      }}
    >
      <div className="relative">
        {children}
        <HighlightElement
          className={className}
          itemsRef={itemsRef}
          transition={transition}
        />
      </div>
    </MotionHighlightContext.Provider>
  )
}

interface HighlightElementProps {
  className?: string
  itemsRef: React.MutableRefObject<Map<string, HTMLElement>>
  transition: Transition
}

function HighlightElement({ className, itemsRef, transition }: HighlightElementProps) {
  const { activeValue, id } = useMotionHighlight()
  const [rect, setRect] = React.useState<DOMRect | null>(null)

  React.useEffect(() => {
    if (activeValue && itemsRef.current.has(activeValue)) {
      const element = itemsRef.current.get(activeValue)
      if (element) {
        const updateRect = () => {
          setRect(element.getBoundingClientRect())
        }
        updateRect()

        const resizeObserver = new ResizeObserver(updateRect)
        resizeObserver.observe(element)

        return () => {
          resizeObserver.disconnect()
        }
      }
    } else {
      setRect(null)
    }
  }, [activeValue, itemsRef])

  if (!rect || !activeValue) return null

  const parentElement = itemsRef.current.get(activeValue)?.parentElement
  const parentRect = parentElement?.getBoundingClientRect()

  const relativeRect = parentRect
    ? {
        x: rect.x - parentRect.x,
        y: rect.y - parentRect.y,
        width: rect.width,
        height: rect.height,
      }
    : null

  if (!relativeRect) return null

  return (
    <motion.div
      layoutId={`highlight-${id}`}
      className={cn("absolute inset-0 -z-10", className)}
      initial={false}
      animate={{
        x: relativeRect.x,
        y: relativeRect.y,
        width: relativeRect.width,
        height: relativeRect.height,
      }}
      transition={transition}
    />
  )
}

interface MotionHighlightItemProps {
  children: React.ReactNode
  className?: string
  value: string
  id?: string
}

function MotionHighlightItem({ children, className, value, id }: MotionHighlightItemProps) {
  const { registerItem, setActiveValue, hover, activeValue } = useMotionHighlight()
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    registerItem(value, ref.current)
    return () => registerItem(value, null)
  }, [value, registerItem])

  const handleMouseEnter = () => {
    if (hover) {
      setActiveValue(value)
    }
  }

  const handleMouseLeave = () => {
    if (hover) {
      setActiveValue(null)
    }
  }

  return (
    <div
      ref={ref}
      id={id}
      className={cn("relative", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-value={value}
      data-active={activeValue === value}
    >
      {children}
    </div>
  )
}

export { MotionHighlight, MotionHighlightItem, useMotionHighlight }
