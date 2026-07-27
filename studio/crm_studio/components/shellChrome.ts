// Which pieces of app chrome a route gets, derived from the doctype it is scoped to.

/** The `addable_doctypes` answer, and whether it has arrived. */
export type AddableDoctypes = {
  fetched: boolean
  names: string[]
}

export type ShellChrome = {
  showSidebar: boolean
  /** Stays for a route with no doctype: such a page has nothing to list in the
   *  sidebar, but its own title still belongs in the header. */
  showHeader: boolean
  unlistedDoctype: string
  /** This route needs the addable list and does not have it yet. */
  needsAddableDoctypes: boolean
}

export function deriveShellChrome(
  activeDoctype: string,
  railDoctypes: string[],
  addable: AddableDoctypes,
): ShellChrome {
  const offRail = isOffRail(activeDoctype, railDoctypes)
  const unlistedDoctype =
    offRail && addable.names.includes(activeDoctype) ? activeDoctype : ''
  // While the answer is in flight the chrome stays: blinking it away on every load of
  // a perfectly good doctype is worse than a moment of it framing a page that is not.
  const isReal = !offRail || !addable.fetched || Boolean(unlistedDoctype)

  return {
    showSidebar: Boolean(activeDoctype) && isReal,
    showHeader: isReal,
    unlistedDoctype,
    needsAddableDoctypes: offRail && !addable.fetched,
  }
}

function isOffRail(activeDoctype: string, railDoctypes: string[]) {
  return (
    Boolean(activeDoctype) &&
    railDoctypes.length > 0 &&
    !railDoctypes.includes(activeDoctype)
  )
}
