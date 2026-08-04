import { computed, onScopeDispose, ref, watch } from 'vue'
import { call, toast } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import {
  getSocketInstance,
  resubscribeHeldDocs,
  subscribeToDoc,
} from '@framework/ui/socket'

import {
  applyDocinfoUpdate,
  assigneesOf,
  emptyDocinfo,
  isForRecord,
  type Docinfo,
  type DocinfoUpdate,
} from '@/data/docinfo'
import { errorMessage } from '@/data/errors'

export type RecordRef = {
  doctype: string
  docname: string
  /** Refetches `getdoc`, keeping the document cache current. */
  refetch: () => void
}

/** The record's `docinfo`: its buckets off the shared `getdoc` response, kept live. */
export function useDocinfo(docResource: any, record: RecordRef) {
  const { doctype, docname, refetch } = record

  const docinfo = ref<Docinfo>(emptyDocinfo())

  watch(
    () => docResource.data,
    (payload: any) => {
      docinfo.value = { ...emptyDocinfo(), ...(payload?.docinfo ?? {}) }
    },
    { immediate: true },
  )

  const assignees = computed(() => assigneesOf(docinfo.value))

  const socket = getSocketInstance()
  subscribe()

  function subscribe() {
    if (!socket) return

    // Refcounted: the Activity tab holds this room too, and the server's doc_unsubscribe
    // is a bare socket.leave that would deafen whichever of us unmounted last.
    const release = subscribeToDoc(socket, doctype, docname)
    socket.on('docinfo_update', onDocinfoUpdate)
    socket.on('disconnect', onDisconnect)
    socket.on('connect', onConnect)

    onScopeDispose(() => {
      release()
      // Pass the handler: a bare off('docinfo_update') kills every other listener.
      socket.off('docinfo_update', onDocinfoUpdate)
      socket.off('disconnect', onDisconnect)
      socket.off('connect', onConnect)
    })
  }

  function onDocinfoUpdate(...args: unknown[]) {
    const event = args[0] as DocinfoUpdate
    if (!isForRecord(event, doctype, docname)) return
    docinfo.value = applyDocinfoUpdate(docinfo.value, event)
    if (event.key === 'assignment_logs') refetchAssignments()
  }

  // `assignments` gets no delta of its own — the echo lands on `assignment_logs` — so the
  // bucket the avatars read comes back off `getdoc`, once for a burst of picks.
  const refetchAssignments = useDebounceFn(refetch, 200)

  let missedDeltas = false

  function onDisconnect() {
    missedDeltas = true
  }

  /** Rejoins every held room and repairs whatever the gap dropped. */
  function onConnect() {
    resubscribeHeldDocs(socket)
    if (!missedDeltas) return
    missedDeltas = false
    refetch()
  }

  function assign(email: string) {
    return mutateAssignment('frappe.desk.form.assign_to.add', {
      doctype,
      name: docname,
      assign_to: [email],
    })
  }

  function unassign(email: string) {
    return mutateAssignment('frappe.desk.form.assign_to.remove', {
      doctype,
      name: docname,
      assign_to: email,
    })
  }

  // The response is discarded: `docinfo_update` is the single writer into the buckets.
  async function mutateAssignment(method: string, args: Record<string, any>) {
    try {
      await call(method, args)
    } catch (error: any) {
      toast.error(errorMessage(error))
    }
  }

  return { docinfo, assignees, assign, unassign }
}
