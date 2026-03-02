export interface ComparisonImage {
  src: string
  label: string
}

export interface TransformState {
  scale: number
  positionX: number
  positionY: number
}

export type ComparisonMode = "slider" | "side-by-side"

export interface ImageComparisonProps {
  before: ComparisonImage
  after: ComparisonImage
  defaultMode?: ComparisonMode
  showToolbar?: boolean
  className?: string
}
