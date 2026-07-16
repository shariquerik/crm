// The logged-in user and logout — the session data the app chrome needs.
//
// This code is bundled by Studio, not the CRM frontend, so CRM's pinia stores aren't
// reachable here: the email comes off the `user_id` cookie (the same trick CRM's session
// store uses), enriched with the display name + image over one RPC. The refs live at module
// scope, so every importer shares one `currentUser`.
import { call } from "frappe-ui"
import { computed, ref } from "vue"

export type CurrentUser = { email: string; full_name?: string; user_image?: string }

function sessionUserEmail(): string {
	const cookies = new URLSearchParams(document.cookie.split("; ").join("&"))
	const email = cookies.get("user_id")
	return email && email !== "Guest" ? decodeURIComponent(email) : ""
}

export const currentUser = ref<CurrentUser>({ email: sessionUserEmail() })

export const userLabel = computed(() => currentUser.value.full_name || currentUser.value.email)

let loaded = false

// Runs its RPC at most once; a failure clears the guard so a later mount can retry, and the
// email-initials fallback holds meanwhile.
export async function loadCurrentUser(): Promise<void> {
	if (loaded) return
	loaded = true
	const email = currentUser.value.email
	if (!email) return
	try {
		const info = await call("frappe.client.get_value", {
			doctype: "User",
			filters: { name: email },
			fieldname: ["full_name", "user_image"],
		})
		if (info) currentUser.value = { email, ...info }
	} catch {
		loaded = false
	}
}

// Mirrors CRM's session store: hit `logout`, then hard-navigate to the login page — a full
// reload is what clears the in-memory session state.
export async function logout(): Promise<void> {
	try {
		await call("logout")
	} finally {
		window.location.href = "/login?redirect-to=/crm"
	}
}
