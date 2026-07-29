import { call } from 'frappe-ui'
import { computed, ref } from 'vue'

export type CurrentUser = {
  email: string
  full_name?: string
  user_image?: string
}

function sessionUserEmail(): string {
  const cookies = new URLSearchParams(document.cookie.split('; ').join('&'))
  const email = cookies.get('user_id')
  return email && email !== 'Guest' ? decodeURIComponent(email) : ''
}

export const currentUser = ref<CurrentUser>({ email: sessionUserEmail() })

export const userLabel = computed(
  () => currentUser.value.full_name || currentUser.value.email,
)

let loaded = false

export async function loadCurrentUser(): Promise<void> {
  if (loaded) return
  loaded = true
  const email = currentUser.value.email
  if (!email) return
  try {
    const info = await call('frappe.client.get_value', {
      doctype: 'User',
      filters: { name: email },
      fieldname: ['full_name', 'user_image'],
    })
    if (info) currentUser.value = { email, ...info }
  } catch {
    loaded = false
  }
}

export async function saveFullName(fullName: string): Promise<void> {
  await call('frappe.client.set_value', {
    doctype: 'User',
    name: currentUser.value.email,
    fieldname: 'full_name',
    value: fullName,
  })
  currentUser.value = { ...currentUser.value, full_name: fullName }
}

export async function logout(): Promise<void> {
  try {
    await call('logout')
  } finally {
    window.location.href = '/login?redirect-to=/crm2'
  }
}
