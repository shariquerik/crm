// The app's front door, and nothing else — there is no home screen. This page exists so `/`
// resolves: Studio's published router registers a route per page and removes its catch-all
// once they're in, so a route with no page aborts the navigation with a toast rather than
// rendering a Not Found. It redirects to the first module in the rail, read from the same
// server-driven sidebar layout the rail's app mark uses, so the two cannot drift.
import { watch } from "vue"

export default function setup(ctx: any) {
	const { sidebarLayout, router } = ctx

	watch(
		() => sidebarLayout.data,
		(sections: any[]) => {
			const first = (sections || []).flatMap((section: any) => section.items || [])[0]
			// An empty layout leaves the user here rather than sending them to `/undefined`,
			// which would toast "Page does not exist" and strand them anyway.
			if (!first?.dt) return
			// replace(), not push(): the front door must not sit in history, or Back out of the
			// first module would land here and bounce straight forward again.
			router.replace(`/${encodeURIComponent(first.dt)}`)
		},
		{ immediate: true },
	)

	return {}
}
