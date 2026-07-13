"""Studio Component seeders, auto-discovered.

Each module in this package exposes:
    COMPONENT_ID : str    the Studio Component docname; page blocks reference it as
                          their `componentName` (with isStudioComponent: true)
    build()      -> dict  keys: component_name, block (a SINGLE block dict), inputs

Inputs are declared as [{"input_name", "type", "required", "default"}] and are read
inside the component's block tree as {{ inputs.<input_name> }}.

Discovery is automatic — adding a component means adding a file.
"""

import importlib
import pkgutil

SEEDERS: dict[str, callable] = {}

for _module in pkgutil.iter_modules(__path__):
	if _module.name.startswith("_"):
		continue
	_mod = importlib.import_module(f"{__name__}.{_module.name}")
	if not hasattr(_mod, "COMPONENT_ID") or not hasattr(_mod, "build"):
		raise ImportError(f"component seeder '{_module.name}' must define COMPONENT_ID and build()")
	if _mod.COMPONENT_ID in SEEDERS:
		raise ImportError(f"duplicate COMPONENT_ID '{_mod.COMPONENT_ID}' in components/{_module.name}.py")
	SEEDERS[_mod.COMPONENT_ID] = _mod.build
