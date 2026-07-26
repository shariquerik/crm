// Which pieces of app chrome a route gets, derived from the doctype it is scoped to.

export type ShellChrome = {
  showSidebar: boolean
  /** Stays for a route with no doctype: such a page has nothing to list in the
   *  sidebar, but its own title still belongs in the header. */
  showHeader: boolean
  unlistedDoctype: string
  addableDoctypesUnknown: boolean
}

/** `addableDoctypes` is null until the answer has landed. */
export function deriveShellChrome(
  activeDoctype: string,
  railDoctypes: string[],
  addableDoctypes: string[] | null,
): ShellChrome {
  const offRail =
    Boolean(activeDoctype) &&
    railDoctypes.length > 0 &&
    !railDoctypes.includes(activeDoctype)

  const unlistedDoctype =
    offRail && (addableDoctypes ?? []).includes(activeDoctype)
      ? activeDoctype
      : ''

  // A doctype on the rail is known without asking; anything else waits on the same
  // `addable_doctypes` answer the hint tile does. Unknown only once that has landed —
  // while it is in flight the chrome stays, since blinking it away on every load of a
  // perfectly good doctype is worse than a moment of it framing a page that is loading.
  const known = !offRail || addableDoctypes === null || Boolean(unlistedDoctype)

  return {
    showSidebar: Boolean(activeDoctype) && known,
    showHeader: known,
    unlistedDoctype,
    addableDoctypesUnknown: offRail && addableDoctypes === null,
  }
}
