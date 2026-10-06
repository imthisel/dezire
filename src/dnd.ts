/** The item currently being dragged (dataTransfer can't be read during dragover). */
export const drag: { current: { fromKey: string; id: string } | null } = { current: null }

/** The yearly goal currently being dragged. */
export const goalDrag: { current: { year: number; id: string } | null } = { current: null }
