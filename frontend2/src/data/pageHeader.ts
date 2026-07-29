import { shallowRef, type Slot } from 'vue'

/** Header markup a page hands up to the shell, via PageHeaderPortal. */
export const pageHeader = shallowRef<{ owner: symbol; slot: Slot } | null>(null)
