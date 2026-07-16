// The app's front door, and nothing else — there is no home SCREEN. This page exists purely so
// that `/` resolves: Studio's published router registers a route per page and REMOVES its
// catch-all once they're in (app_router.ts), so a route with no page behind it doesn't render a
// Not Found — `beforeEach` aborts the navigation and toasts "Page does not exist or is not
// published". `/` is where the app opens (`/crm-studio` lands here) and where every "Go to home"
// button leads, so it has to go somewhere real.
//
// It goes to the first module in the rail: the same place the rail's app mark goes, decided from
// the same server-driven sidebar layout, so the two can't drift apart. The page renders no UI —
// its body is empty on purpose. Anything drawn here would flash for one fetch and be replaced.
// That is also why it fetches no saved views (the `views` the other pages hand the sidebar): no
// shell renders here, so there is nothing to hand them to.
import { watch } from "vue"

export default function setup(ctx: any) {
	// `sidebarLayout` is auto=1: already in flight when this runs. Its rows are the sidebar's
	// sections; the rail is their items flattened, exactly as the other pages' block trees bind it
	// ({{ (sidebarLayout.data || []).flatMap(s => s.items || []) }}).
	const { sidebarLayout, router } = ctx

	watch(
		() => sidebarLayout.data,
		(sections: any[]) => {
			const first = (sections || []).flatMap((section: any) => section.items || [])[0]
			// An empty layout leaves the user here on a blank page rather than sending them to
			// `/undefined`, which would toast "Page does not exist" and strand them anyway. The
			// fixture ships six modules, so this is the can't-happen branch, not a real state.
			if (!first?.dt) return
			// replace(), not push(): the front door must not sit in history, or Back out of the
			// first module would land here and bounce straight forward again.
			router.replace(`/${encodeURIComponent(first.dt)}`)
		},
		{ immediate: true },
	)

	return {}
}
