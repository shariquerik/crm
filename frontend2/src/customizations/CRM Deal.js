// The filename binds the script to the doctype.

const markWon = {
  name: 'mark_won',
  label: 'Mark as won',
  icon: 'lucide-trophy',
  description: 'Set this deal to Won',
  run: async (page) => {
    page.doc.status = 'Won'
    await page.save()
  },
}

export default {
  refresh(page) {
    if (page.doc.status !== 'Won') page.quickActions.add(markWon)

    if (page.doc.status === 'Won') {
      page.quickActions.update('email', { label: 'Email the customer' })
    }

    page.quickActions.order(['mark_won', 'email', 'comment', 'attach', 'print'])
  },

  status(page) {
    page.refresh()
  },

  after_save(page) {
    page.toast.success('Deal saved')
  },
}
