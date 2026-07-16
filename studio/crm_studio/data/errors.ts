// frappe-ui's `call` rejects with the server's own messages attached (e.g. "Value missing
// for CRM Lead: First Name"); never swallow them.
export function errorMessage(error: any) {
	if (error?.messages?.length) return error.messages.join("\n")
	return error?.message || "Something went wrong"
}
