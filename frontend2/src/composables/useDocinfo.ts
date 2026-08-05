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
  sharedWith,
  type Docinfo,
  type DocinfoUpdate,
  type RecordChrome,
} from '@/data/docinfo'
import { errorMessage } from '@/data/errors'
import { tagsOf } from '@/data/tags'

export type RecordRef = {
  doctype: string
  docname: string
  /** Refetches `getdoc`, keeping the document cache current. */
  refetch: () => void
  /** Refetches the Files tab's `File` query, which no bucket carries. */
  reloadFiles: () => void
}

/** The record's `docinfo`: its buckets off the shared `getdoc` response, kept live. */
export function useDocinfo(docResource: any, record: RecordRef) {
  const { doctype, docname, refetch, reloadFiles } = record

  const docinfo = ref<Docinfo>(emptyDocinfo())

  watch(
    () => docResource.data,
    (payload: any) => {
      docinfo.value = { ...emptyDocinfo(), ...(payload?.docinfo ?? {}) }
    },
    { immediate: true },
  )

  const assignees = computed(() => assigneesOf(docinfo.value))
  const tags = computed(() => tagsOf(docinfo.value))
  const shared = computed(() => sharedWith(docinfo.value))
  const following = computed(() => Boolean(docinfo.value.is_document_followed))

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
    if (event.key === 'assignment_logs') refetchSoon()
    // Attaching a file posts a Comment, so the echo lands here and the file list
    // it changed has to come back off its own query.
    if (event.key === 'attachment_logs') reloadFiles()
  }

  // The buckets no delta carries come back off `getdoc`, once for a burst of edits.
  const refetchSoon = useDebounceFn(refetch, 200)

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
    return sendMutation('frappe.desk.form.assign_to.add', {
      doctype,
      name: docname,
      assign_to: [email],
    })
  }

  function unassign(email: string) {
    return sendMutation('frappe.desk.form.assign_to.remove', {
      doctype,
      name: docname,
      assign_to: email,
    })
  }

  function addTag(tag: string) {
    return mutateChrome('frappe.desk.doctype.tag.tag.add_tag', {
      tag,
      dt: doctype,
      dn: docname,
    })
  }

  function removeTag(tag: string) {
    return mutateChrome('frappe.desk.doctype.tag.tag.remove_tag', {
      tag,
      dt: doctype,
      dn: docname,
    })
  }

  function toggleFollow() {
    return mutateChrome('frappe.desk.form.document_follow.update_follow', {
      doctype,
      doc_name: docname,
      following: !following.value,
    })
  }

  function share(user: string) {
    return mutateChrome('frappe.share.add', {
      doctype,
      name: docname,
      user,
      read: 1,
      write: 1,
    })
  }

  // Dropping read drops the higher permissions with it, and the empty share deletes itself.
  function unshare(user: string) {
    return mutateChrome('frappe.share.set_permission', {
      doctype,
      name: docname,
      user,
      permission_to: 'read',
      value: 0,
    })
  }

  // Tags, shares and follows publish no `docinfo_update`, so the round trip each of them
  // closes is its own refetch.
  async function mutateChrome(method: string, args: Record<string, any>) {
    await sendMutation(method, args)
    refetchSoon()
  }

  // The response is discarded: nothing here writes into the buckets, only the socket
  // and the refetch do.
  async function sendMutation(method: string, args: Record<string, any>) {
    try {
      await call(method, args)
    } catch (error: any) {
      toast.error(errorMessage(error))
    }
  }

  const chrome = computed<RecordChrome>(() => ({
    tags: tags.value,
    shared: shared.value,
    following: following.value,
    addTag,
    removeTag,
    toggleFollow,
    share,
    unshare,
  }))

  return { docinfo, assignees, chrome, assign, unassign }
}
