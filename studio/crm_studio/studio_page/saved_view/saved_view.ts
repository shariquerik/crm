// The saved-view page (/:doctype/view/:viewName). The screen is useListPage; the
// `currentView` resource this page declares is what makes it read its narrowing from the
// stored view rather than from the URL's query.
import { useListPage } from "@app/composables/useListPage"

export default function setup(ctx: any) {
	return useListPage(ctx)
}
