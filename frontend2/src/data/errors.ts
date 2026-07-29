export function errorMessage(error: any) {
  if (error?.messages?.length) return error.messages.join('\n')
  return error?.message || 'Something went wrong'
}
