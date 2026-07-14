"""Helpers for building Studio block trees.

A Studio page's `blocks` is a JSON string holding a list with ONE root block; each
block is a node of {componentName, componentProps, componentSlots, children, ...}.
See docs/how-studio-works.md ("Block JSON shape").

Only `componentName` is required per block — Studio's Block constructor fills the
rest — but seeds set ids explicitly so re-running produces byte-identical JSON.
"""


def root(children: list[dict], styles: dict | None = None) -> list[dict]:
	"""The page's root block. Studio expects `componentId: "root"` on a body div."""
	base = {
		"display": "flex",
		"flexDirection": "row",
		"flexShrink": 0,
		"width": "inherit",
		"overflowX": "hidden",
		"height": "100%",
	}
	base.update(styles or {})
	return [
		{
			"componentId": "root",
			"componentName": "div",
			"blockName": "body",
			"originalElement": "body",
			"baseStyles": base,
			"children": children,
		}
	]


def block(
	component_name: str,
	component_id: str,
	props: dict | None = None,
	styles: dict | None = None,
	children: list[dict] | None = None,
	slots: dict | None = None,
	events: dict | None = None,
	visibility: str = "",
	block_name: str | None = None,
	original_element: str | None = None,
	is_studio_component: bool = False,
	is_custom_vue_component: bool = False,
) -> dict:
	"""One block. `component_id` is the instance id and must be unique within the page."""
	node: dict = {
		"componentId": component_id,
		"componentName": component_name,
		"blockName": block_name or component_id,
	}
	if original_element:
		node["originalElement"] = original_element
	if props:
		node["componentProps"] = props
	if styles:
		node["baseStyles"] = styles
	if children:
		node["children"] = children
	if slots:
		node["componentSlots"] = {
			name: {"slotName": name, "slotContent": content} for name, content in slots.items()
		}
	if events:
		node["componentEvents"] = events
	if visibility:
		node["visibilityCondition"] = visibility
	if is_studio_component:
		node["isStudioComponent"] = True
	if is_custom_vue_component:
		node["isCustomVueComponent"] = True
	return node


def container(component_id: str, children: list[dict], styles: dict | None = None, **kw) -> dict:
	"""A plain flex div. `container` is one of Studio's non-Vue names, rendered as its
	originalElement — so it never gets pulled into the app's component bundle."""
	base = {"display": "flex", "flexDirection": "column", "width": "100%"}
	base.update(styles or {})
	return block("container", component_id, styles=base, children=children, original_element="div", **kw)


def studio_component(component_id_ref: str, instance_id: str, props: dict | None = None, **kw) -> dict:
	"""Reference a saved Studio Component.

	`componentName` must be the component's DOCNAME (its component_id), not its
	human component_name, and isStudioComponent must be true. Props are keyed by
	the component's input names; inside the component they read as {{ inputs.x }}.
	"""
	return block(
		component_id_ref,
		instance_id,
		props=props,
		is_studio_component=True,
		**kw,
	)


def custom_component(component_name: str, component_id: str, **kw) -> dict:
	"""A custom Vue SFC shipped by the frappe app (apps/crm/studio/<studio_app>/**/*.vue).

	`studio.api.get_custom_vue_components` discovers it by FILENAME, and the app build
	registers it as a component — but only if the block says so: StudioAppBuilder reads
	`isCustomVueComponent` to know the name isn't one of its own, and to look the file up.
	Without the flag the build treats it as a missing standard component and drops it.

	This is the supported way past a frappe-ui component's limits (an event it doesn't
	re-emit, state it won't let you write, a slot it renders internally): wrap it in an SFC
	that widens the seam, and keep the app itself in blocks. See CrmListView.vue.
	"""
	return block(component_name, component_id, is_custom_vue_component=True, **kw)


def bind(variable_name: str) -> dict:
	"""Two-way bind a prop to a page variable.

	Studio reads the variable for the prop and writes back on `update:<prop>`, which
	is exactly what a Vue `defineModel` emits. This is how @framework/ui's controlled
	controls (Filter, SortBy, ColumnSettings, FormLayout's doc) get their v-model —
	and how two controls SHARE state: point them at the same variable name.
	"""
	return {"$type": "variable", "name": variable_name}


def run_script(script: str) -> dict:
	"""A "Run Script" block event, e.g. events={"click": run_script("...")}."""
	return {"event": "click", "action": "Run Script", "script": script}


def event(name: str, script: str) -> dict:
	return {"event": name, "action": "Run Script", "script": script}
