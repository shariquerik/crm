import { describe, expect, it } from 'vitest'

import { deriveShellChrome } from '@app/components/shellChrome'

const RAIL = ['CRM Lead', 'CRM Deal']

describe('deriveShellChrome', () => {
  it('renders the sidebar and header for a doctype on the rail', () => {
    const chrome = deriveShellChrome('CRM Deal', RAIL, null)

    expect(chrome.showSidebar).toBe(true)
    expect(chrome.showHeader).toBe(true)
    expect(chrome.unlistedDoctype).toBe('')
    expect(chrome.addableDoctypesUnknown).toBe(false)
  })

  it('renders no sidebar without an active doctype, but keeps the header', () => {
    const chrome = deriveShellChrome('', RAIL, null)

    expect(chrome.showSidebar).toBe(false)
    expect(chrome.showHeader).toBe(true)
    expect(chrome.addableDoctypesUnknown).toBe(false)
  })

  it('keeps the chrome while the rail layout is still empty', () => {
    expect(deriveShellChrome('CRM Deal', [], null).showSidebar).toBe(true)
  })

  it('keeps the chrome for an off-rail doctype until addable_doctypes lands', () => {
    const chrome = deriveShellChrome('Contact', RAIL, null)

    expect(chrome.showSidebar).toBe(true)
    expect(chrome.addableDoctypesUnknown).toBe(true)
  })

  it('offers an off-rail doctype for the rail once it is known to be real', () => {
    const chrome = deriveShellChrome('Contact', RAIL, ['Contact'])

    expect(chrome.showSidebar).toBe(true)
    expect(chrome.unlistedDoctype).toBe('Contact')
    expect(chrome.addableDoctypesUnknown).toBe(false)
  })

  it('drops all chrome for a URL naming no real doctype', () => {
    const chrome = deriveShellChrome('Nonsense', RAIL, ['Contact'])

    expect(chrome.showSidebar).toBe(false)
    expect(chrome.showHeader).toBe(false)
    expect(chrome.unlistedDoctype).toBe('')
  })
})
