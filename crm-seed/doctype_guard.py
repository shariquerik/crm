"""The guard every `/:doctype` page puts in front of itself.

The routes carry the REAL doctype name (`/crm-studio/CRM Lead`) — see config.py for why
that, and not a slug, is what lets the pages work for every doctype without registering
one. The cost of naming a doctype in a URL is that the URL can name one that doesn't
exist, so each page asks the server to resolve its route segment before it renders
anything, and gets one of three answers:

    render     the segment IS a listable doctype -> the page shows it
    redirect   the segment resolves to one under another spelling ("crm-lead", "crm lead")
               -> replace the URL with the canonical one, and Studio re-runs setup on the
               new route, which then renders
    not found  the segment resolves to nothing (a typo, a Single, a child table, or a
               doctype this user may not read) -> the panel below, instead of the page

Resolving on the server is not a convenience, it is the only place it CAN happen: slug ->
name has no computable inverse (`slug("ToDo")` is "todo", and nothing turns "todo" back
into "ToDo"), and only the server holds the real names.

`crm.api.doc.resolve_doctype` answers `{doctype: "CRM Lead"}` or `{doctype: null}`. The
wrapper dict is load-bearing: frappe-ui's createResource starts `data` at null, so a bare
null answer would be indistinguishable from "hasn't answered yet" — and the page would
flash Not Found on every load. Hence the tri-state below.
"""

import json

import blocks

RESOURCE_NAME = "routeDoctype"

RESOURCE = {
	"resource_name": RESOURCE_NAME,
	"resource_type": "API Resource",
	"url": "crm.api.doc.resolve_doctype",
	"method": "GET",  # one string param, so no dict-through-GET problem
	"auto": 1,
	"params": json.dumps({"doctype": "{{ route.params.doctype }}"}),
	"transform": "",
}

# The three states, as block-visibility expressions. `data` is null until the call lands,
# so "loading" is simply `!data` — and neither the page nor the panel is shown then.
RESOLVED = f"{{{{ {RESOURCE_NAME}.data && {RESOURCE_NAME}.data.doctype === route.params.doctype }}}}"
NOT_FOUND = f"{{{{ {RESOURCE_NAME}.data && !{RESOURCE_NAME}.data.doctype }}}}"

# Spliced into every guarded page's setup(). `watch` must already be imported from "vue".
# The page's own first fetch is fired from here (its list/record resources are auto=0), so
# that a bad or non-canonical URL never fires a request for a doctype that isn't there.
# `onResolved` is the page's callback: it runs once, with the canonical doctype in the route.
PAGE_SETUP = f"""
	// Nothing is fetched until the server has resolved the route's doctype: a typo must not
	// fire a get_data for a doctype that does not exist, and a slug URL is about to be
	// replaced by its canonical one anyway (which re-runs this whole setup).
	function guardDoctype(onResolved: () => void, suffix = "") {{
		const {{ {RESOURCE_NAME} }} = ctx
		let done = false
		watch(
			() => {RESOURCE_NAME}.data,
			(res: any) => {{
				if (done || !res) return
				// resolved to nothing — the Not Found panel is what renders; do NOT fetch.
				if (!res.doctype) return
				if (res.doctype !== route.params.doctype) {{
					// a slug or a different casing: send the browser to the canonical URL.
					// replace(), not push(), so Back doesn't bounce through the alias.
					done = true
					router.replace(`/${{encodeURIComponent(res.doctype)}}${{suffix}}`)
					return
				}}
				done = true
				onResolved()
			}},
			{{ immediate: true }},
		)
	}}
""".rstrip()


# Muted body text, matching the sidebar's.
MUTED_TEXT = "#525252"


def block(block_id: str = "not-found") -> dict:
	"""The panel shown in place of the page when the route names nothing."""
	return blocks.container(
		block_id,
		styles={
			"alignItems": "center",
			"justifyContent": "center",
			"gap": "8px",
			"flexGrow": "1",
			"height": "100%",
			"padding": "24px",
		},
		visibility=NOT_FOUND,
		children=[
			blocks.block(
				"TextBlock",
				f"{block_id}-title",
				props={"text": "Page not found"},
				styles={"fontSize": "20px", "fontWeight": "600"},
			),
			blocks.block(
				"TextBlock",
				f"{block_id}-message",
				# Name the thing that failed — a bare "not found" leaves the user guessing
				# whether they mistyped the doctype or the record.
				props={"text": "{{ route.params.doctype + ' is not a doctype you can open here.' }}"},
				styles={"fontSize": "14px", "color": MUTED_TEXT},
			),
			blocks.block(
				"Button",
				f"{block_id}-home",
				props={"label": "Go to home", "variant": "subtle"},
				styles={"marginTop": "8px"},
				events={"click": blocks.event("click", "function handleEvent() { router.push('/') }")},
			),
		],
	)
