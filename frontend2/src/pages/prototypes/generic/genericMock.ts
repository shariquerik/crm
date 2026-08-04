// PROTOTYPE — throwaway. A plain Contact record: what /:doctype/:id looks like
// before any Lead- or Deal-specific layout is applied.

export const record = {
  doctype: 'Contact',
  doctypeLabel: 'Contacts',
  id: 'CONTACT-2026-00042',
  name: 'Emma Chen',
  title: 'Emma Chen',
  email: 'emma.chen@acmecorp.example.com',
  subtitle: 'VP Engineering · Acme Corp',
  status: 'Open',
  statusColor: 'bg-green-500',
}

export const currentUser = { fullName: 'Shariq Ansari' }

export const assignees = [
  { fullName: 'Sarah Connor' },
  { fullName: 'Dev Patel' },
]

export const tags = ['champion', 'decision-maker']

export const attachmentCount = 3

export const tabs = [
  { name: 'activity', label: 'Activity', icon: 'lucide-activity' },
  { name: 'emails', label: 'Emails', icon: 'lucide-mail' },
  { name: 'files', label: 'Files', icon: 'lucide-paperclip' },
]

export const formTab = {
  name: 'details',
  label: 'Details',
  icon: 'lucide-table-properties',
}

export type PanelField = {
  label: string
  value: string
  link?: boolean
  avatar?: boolean
  readOnly?: boolean
}

export const quickFields: PanelField[] = [
  { label: 'Email', value: 'emma.chen@acmecorp.example.com' },
  { label: 'Mobile No', value: '+1 415 555 0132' },
  { label: 'Company Name', value: 'Acme Corp', link: true },
  { label: 'Designation', value: 'VP Engineering' },
  { label: 'Status', value: 'Open' },
  { label: 'Contact Owner', value: 'Sarah Connor', avatar: true },
]

export const allFieldCount = 16

export const formSections: { label: string; fields: PanelField[] }[] = [
  {
    label: 'Contact Details',
    fields: [
      { label: 'Salutation', value: 'Ms' },
      { label: 'First Name', value: 'Emma' },
      { label: 'Last Name', value: 'Chen' },
      { label: 'Full Name', value: 'Emma Chen', readOnly: true },
      { label: 'Email', value: 'emma.chen@acmecorp.example.com' },
      { label: 'Mobile No', value: '+1 415 555 0132' },
      { label: 'Phone', value: '' },
      { label: 'Status', value: 'Open' },
    ],
  },
  {
    label: 'More Information',
    fields: [
      { label: 'Company Name', value: 'Acme Corp', link: true },
      { label: 'Designation', value: 'VP Engineering' },
      { label: 'Department', value: 'Engineering' },
      { label: 'Address', value: '' },
      { label: 'Gender', value: 'Female' },
      { label: 'User', value: '' },
      { label: 'Language', value: 'English' },
      { label: 'Unsubscribed', value: 'No' },
      { label: 'Territory', value: 'West Coast', link: true },
      { label: 'Lead Source', value: 'Conference' },
      { label: 'Industry', value: 'Software' },
      { label: 'Time Zone', value: 'America/Los_Angeles' },
      { label: 'Preferred Contact', value: 'Email' },
      { label: 'Owner', value: 'Sarah Connor' },
      { label: 'Created On', value: '12 Apr 2026', readOnly: true },
      { label: 'Last Modified', value: '28 Jul 2026', readOnly: true },
      { label: 'Account Manager', value: 'Dev Patel' },
      { label: 'Company Size', value: '500-1000' },
      { label: 'Annual Revenue', value: '$42M' },
      { label: 'Website', value: 'acmecorp.example.com', link: true },
      { label: 'LinkedIn', value: 'in/emmachen', link: true },
      { label: 'Twitter', value: '' },
      { label: 'Street', value: '1 Market Street' },
      { label: 'City', value: 'San Francisco' },
      { label: 'State', value: 'California' },
      { label: 'Country', value: 'United States', link: true },
      { label: 'Postal Code', value: '94105' },
      { label: 'Billing Contact', value: '' },
      { label: 'Payment Terms', value: 'Net 30' },
      { label: 'Contract Ends', value: '31 Dec 2026' },
      { label: 'Do Not Call', value: 'No' },
      { label: 'Email Opt Out', value: 'No' },
    ],
  },
]

export const activity = [
  {
    kind: 'log',
    icon: 'lucide-user-plus',
    who: 'Sarah Connor',
    what: 'created this contact',
    when: '3 months ago',
  },
  {
    kind: 'comment',
    who: 'Dev Patel',
    what: 'added a comment',
    when: '6 weeks ago',
    body: 'Emma is the technical decision maker at Acme. Prefers email over calls, and is usually in meetings before 11am PT.',
  },
  {
    kind: 'email',
    who: 'Sarah Connor',
    to: 'emma.chen@acmecorp.example.com',
    subject: 'Intro — platform overview',
    when: '5 weeks ago',
    body: 'Hi Emma,\n\nGreat to be connected. Sharing the platform overview we discussed, plus a short summary of how teams your size typically roll this out.\n\nHappy to set up time with your engineering leads.',
  },
  {
    kind: 'log',
    icon: 'lucide-mail-open',
    who: 'Emma Chen',
    what: 'opened the email “Intro — platform overview”',
    when: '5 weeks ago',
  },
  {
    kind: 'email',
    who: 'Emma Chen',
    to: 'sarah.connor@example.com',
    subject: 'Re: Intro — platform overview',
    when: '4 weeks ago',
    body: 'Thanks Sarah — this is useful. I have shared it with two of my engineering leads.\n\nOne question before we book anything: how does the rollout work for teams already on a homegrown pipeline?',
  },
  {
    kind: 'log',
    icon: 'lucide-phone',
    who: 'Sarah Connor',
    what: 'logged a call — 12 minutes',
    when: '4 weeks ago',
  },
  {
    kind: 'comment',
    who: 'Sarah Connor',
    what: 'added a comment',
    when: '4 weeks ago',
    body: 'Call went well. Their blocker is the homegrown pipeline — Emma wants a migration story before she takes it to her VP.',
  },
  {
    kind: 'log',
    icon: 'lucide-circle-dot',
    who: 'Sarah Connor',
    what: 'changed Status from Replied to Qualified',
    when: '4 weeks ago',
  },
  {
    kind: 'email',
    who: 'Sarah Connor',
    to: 'emma.chen@acmecorp.example.com',
    subject: 'Migration from a homegrown pipeline',
    when: '3 weeks ago',
    body: 'Hi Emma,\n\nWriting up the migration path we discussed. Most teams run both side by side for a sprint, then cut over one service at a time.\n\nI have attached the checklist we give to platform teams.',
  },
  {
    kind: 'log',
    icon: 'lucide-user-check',
    who: 'Dev Patel',
    what: 'was assigned to this contact',
    when: '3 weeks ago',
  },
  {
    kind: 'comment',
    who: 'Dev Patel',
    what: 'added a comment',
    when: '3 weeks ago',
    body: 'Picking up the technical thread. I will put together a short migration walkthrough for their leads.',
  },
  {
    kind: 'log',
    icon: 'lucide-calendar',
    who: 'Dev Patel',
    what: 'scheduled a meeting — Technical walkthrough',
    when: '3 weeks ago',
  },
  {
    kind: 'email',
    who: 'Emma Chen',
    to: 'dev.patel@example.com',
    subject: 'Re: Migration from a homegrown pipeline',
    when: '2 weeks ago',
    body: 'The checklist answered most of it. Two of my leads will join the walkthrough — can we keep it to 30 minutes?',
  },
  {
    kind: 'log',
    icon: 'lucide-circle-dot',
    who: 'Sarah Connor',
    what: 'changed Designation from Director of Engineering to VP Engineering',
    when: '2 weeks ago',
  },
  {
    kind: 'log',
    icon: 'lucide-tag',
    who: 'Sarah Connor',
    what: 'added the tag decision-maker',
    when: '2 weeks ago',
  },
  {
    kind: 'comment',
    who: 'Sarah Connor',
    what: 'added a comment',
    when: '10 days ago',
    body: 'Emma is now VP Engineering, so she owns the budget line for this. Worth revisiting the numbers before the walkthrough.',
  },
  {
    kind: 'log',
    icon: 'lucide-check-circle-2',
    who: 'Dev Patel',
    what: 'completed the task “Prepare migration walkthrough”',
    when: '1 week ago',
  },
  {
    kind: 'email',
    who: 'Dev Patel',
    to: 'emma.chen@acmecorp.example.com',
    subject: 'Walkthrough recap and next steps',
    when: '6 days ago',
    body: 'Hi Emma,\n\nRecap of today: we covered the migration path, the rollback story, and how the pipeline handles your build matrix.\n\nNext step is the security review — I have attached the document your team asked for.',
  },
  {
    kind: 'log',
    icon: 'lucide-eye',
    who: 'Emma Chen',
    what: 'viewed the shared document',
    when: '5 days ago',
  },
  {
    kind: 'log',
    icon: 'lucide-paperclip',
    who: 'Dev Patel',
    what: 'attached security-review.pdf',
    when: '4 days ago',
  },
]

export const siblingRecords = [
  { title: 'Emma Chen', subtitle: 'VP Engineering · Acme Corp', when: '4d' },
  {
    title: 'Alice Johnson',
    subtitle: 'Head of Platform · Acme Corp',
    when: '1w',
  },
  { title: 'Marco Silva', subtitle: 'Procurement · Acme Corp', when: '2w' },
  { title: 'Nadia Rahman', subtitle: 'CTO · Northwind', when: '3w' },
  {
    title: 'Tom Okafor',
    subtitle: 'Engineering Manager · Initech',
    when: '1mo',
  },
  { title: 'Priya Nair', subtitle: 'Head of IT · Globex', when: '1mo' },
  { title: 'Lars Vogt', subtitle: 'Director · Umbrella', when: '2mo' },
]
