import { describe, expect, it } from 'vitest'

import { linkTitle, rememberLinkTitles } from '@/data/linkTitles'

describe('linkTitles', () => {
  it('names a record getdoc reported a title for', () => {
    rememberLinkTitles({ 'CRM Lead::CRM-LEAD-0001': 'Alice Johnson' })
    expect(linkTitle('CRM Lead', 'CRM-LEAD-0001')).toBe('Alice Johnson')
  })

  it('falls back to the ID of a record no title came back for', () => {
    expect(linkTitle('CRM Lead', 'CRM-LEAD-0002')).toBe('CRM-LEAD-0002')
  })

  it('keeps what earlier records were called', () => {
    rememberLinkTitles({ 'Contact::CONTACT-0001': 'Emma Chen' })
    expect(linkTitle('CRM Lead', 'CRM-LEAD-0001')).toBe('Alice Johnson')
    expect(linkTitle('Contact', 'CONTACT-0001')).toBe('Emma Chen')
  })

  it('drops the oldest titles past the cap, back to the record ID', () => {
    rememberLinkTitles(
      Object.fromEntries(
        Array.from({ length: 200 }, (_, index) => [
          `CRM Task::TASK-${index}`,
          `Task ${index}`,
        ]),
      ),
    )

    expect(linkTitle('CRM Lead', 'CRM-LEAD-0001')).toBe('CRM-LEAD-0001')
    expect(linkTitle('CRM Task', 'TASK-199')).toBe('Task 199')
  })
})
