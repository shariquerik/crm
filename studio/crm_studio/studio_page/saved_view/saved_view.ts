// The saved-view page (/:doctype/view/:viewName). The screen is useListPage; the `currentView`
// resource this page declares is what makes it read its narrowing from the stored view.
import { useListPage } from "@app/composables/useListPage"

export default function setup(ctx: any) {
	return useListPage(ctx)
}
