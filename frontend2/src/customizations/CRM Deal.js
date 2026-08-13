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

// Ticket 04's reference script: the dialog is the whole action, and `page.call`
// runs on the values it resolves with. A throw from `onSubmit` — a permission
// error, say — holds the dialog open with the message inline.
const callLog = {
  name: 'log_call',
  label: 'Log call',
  icon: 'lucide-phone',
  description: 'Log a call against this deal',
  run: async (page) => {
    const data = await page.dialog.form({
      title: 'Log call',
      size: 'lg',
      fields: [
        {
          fieldname: 'summary',
          fieldtype: 'Small Text',
          label: 'Summary',
          reqd: 1,
        },
      ],
      onSubmit: (data) =>
        page.call('frappe.desk.form.utils.add_comment', {
          reference_doctype: page.doctype,
          reference_name: page.docname,
          content: `Call logged: ${data.summary}`,
          comment_email: page.doc.owner,
          comment_by: page.doc.owner,
        }),
    })
    if (!data) return
    page.toast.success('Call logged')
  },
}

export default {
  refresh(page) {
    page.quickActions.add(callLog, { before: 'email' })

    if (page.doc.status !== 'Won') page.quickActions.add(markWon)

    if (page.doc.status === 'Won') {
      page.quickActions.update('email', { label: 'Email the customer' })
    }

    page.quickActions.order([
      'mark_won',
      'log_call',
      'email',
      'comment',
      'attach',
      'print',
    ])
  },

  status(page) {
    page.refresh()
  },

  after_save(page) {
    page.toast.success('Deal saved')
  },
}
