/** The item currently being dragged (dataTransfer can't be read during dragover). */
export const drag: { current: { fromKey: string; id: string } | null } = { current: null }
