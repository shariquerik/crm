import { watch } from "vue"

export default function setup(ctx: any) {
	const { sidebarLayout, router } = ctx

	watch(
		() => sidebarLayout.data,
		(sections: any[]) => {
			const first = (sections || []).flatMap((section: any) => section.items || [])[0]
			if (!first?.dt) return
			router.replace(`/${encodeURIComponent(first.dt)}`)
		},
		{ immediate: true },
	)

	return {}
}
