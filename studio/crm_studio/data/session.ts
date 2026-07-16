import { call } from "frappe-ui"
import { computed, ref } from "vue"

/**
 * The logged-in user and logout — the session data the app chrome needs.
 *
 * This code is bundled by Studio, NOT the CRM frontend, so CRM's pinia stores (sessionStore /
 * usersStore) aren't reachable here. We read the session email straight off the `user_id` cookie
 * (the same trick crm's session store uses) and enrich it with the display name + image over one
 * RPC. The refs live at module scope, so this is a shared singleton — the same shape as frappe-ui's
 * own `utils/theme.ts`: every importer reads and writes one `currentUser`.
 *
 * This is plain session data, not a Vue composable, so it lives under `@app/data` rather than
 * `@app/composables`; import the bindings directly.
 */
export type CurrentUser = { email: string; full_name?: string; user_image?: string }

function sessionUserEmail(): string {
	const cookies = new URLSearchParams(document.cookie.split("; ").join("&"))
	const email = cookies.get("user_id")
	return email && email !== "Guest" ? decodeURIComponent(email) : ""
}

/** The current user. Starts as just the cookie email; `loadCurrentUser` fills in name + image. */
export const currentUser = ref<CurrentUser>({ email: sessionUserEmail() })

/** Display name for the avatar/trigger — the full name once loaded, the email until then. */
export const userLabel = computed(() => currentUser.value.full_name || currentUser.value.email)

let loaded = false

/** Fetch the display name + image for the cookie's user. Runs its RPC at most once; a failure
 *  clears the guard so a later mount can retry, and the email-initials fallback holds meanwhile. */
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

/** Mirrors crm's session store: hit the `logout` endpoint, then hard-navigate to the login page
 *  (a full reload clears all in-memory session state) with a redirect back into the CRM app. */
export async function logout(): Promise<void> {
	try {
		await call("logout")
	} finally {
		window.location.href = "/login?redirect-to=/crm"
	}
}
