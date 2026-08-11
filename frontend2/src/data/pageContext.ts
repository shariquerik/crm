// The record page's customization controller, provided by Record.vue and
// injected by every component that renders one of the four surfaces.
import type { InjectionKey } from 'vue'
import type { RecordPageController } from '@framework/ui/experimental'

export const RecordPageKey: InjectionKey<RecordPageController> =
  Symbol('recordPage')
