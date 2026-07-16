// The plain list page (/:doctype). The screen is useListPage; with no `currentView`
// resource on ctx, the narrowing comes from the URL's query.
import { useListPage } from "@app/composables/useListPage"

export default function setup(ctx: any) {
	return useListPage(ctx)
}
