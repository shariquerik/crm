export type AddableDoctypes = {
  fetched: boolean
  names: string[]
}

export type ShellChrome = {
  showSidebar: boolean
  showHeader: boolean
  unlistedDoctype: string
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
