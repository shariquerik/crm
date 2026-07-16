// frappe-ui's `call` attaches the server's own messages on `error.messages`; `error.message`
// alone loses them.
export function errorMessage(error: any) {
	if (error?.messages?.length) return error.messages.join("\n")
	return error?.message || "Something went wrong"
}
