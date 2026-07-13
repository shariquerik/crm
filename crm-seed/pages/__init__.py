"""Page seeders, auto-discovered.

Each module in this package exposes:
    PAGE_NAME : str      the Studio Page docname (also its export folder key)
    build()   -> dict    keys: page_name, page_title, route, blocks,
                               resources, variables, script

Discovery is automatic so that adding a page means adding a file — no shared
registry to edit (and no merge conflict when pages are built in parallel).

`seed.py --page <PAGE_NAME>` re-seeds exactly one of these.
"""

import importlib
import pkgutil

SEEDERS: dict[str, callable] = {}

for _module in pkgutil.iter_modules(__path__):
	if _module.name.startswith("_"):
		continue
	_mod = importlib.import_module(f"{__name__}.{_module.name}")
	if not hasattr(_mod, "PAGE_NAME") or not hasattr(_mod, "build"):
		raise ImportError(f"page seeder '{_module.name}' must define PAGE_NAME and build()")
	if _mod.PAGE_NAME in SEEDERS:
		raise ImportError(f"duplicate PAGE_NAME '{_mod.PAGE_NAME}' in pages/{_module.name}.py")
	SEEDERS[_mod.PAGE_NAME] = _mod.build
