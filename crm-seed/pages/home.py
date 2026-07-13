"""The home page at `/` — a placeholder until the app's real landing screen exists."""

import blocks
from components import crm_sidebar

PAGE_NAME = "crm-home"

SCRIPT = f"""
import {{ watch }} from "vue"

export default function setup(ctx: any) {{{crm_sidebar.PAGE_SETUP}

	return {{}}
}}
""".lstrip()


def build() -> dict:
	body = blocks.container(
		"home-body",
		styles={"padding": "40px", "gap": "8px", "flexGrow": "1", "minWidth": "0"},
		children=[
			blocks.block(
				"TextBlock",
				"home-title",
				props={"text": "CRM on Studio"},
				styles={"fontSize": "24px", "fontWeight": "600"},
			),
			blocks.block(
				"TextBlock",
				"home-subtitle",
				props={"text": "Pick a doctype from the sidebar to see its list."},
				styles={"color": "#6b7280"},
			),
		],
	)

	return {
		"page_name": PAGE_NAME,
		"page_title": "Home",
		"route": "/",
		# No doctype in this route, so nothing is highlighted.
		"blocks": blocks.root([crm_sidebar.instance(), body]),
		"resources": [crm_sidebar.RESOURCE],
		"variables": list(crm_sidebar.VARIABLES),
		"script": SCRIPT,
	}
