"""Inspect Studio page block trees on disk: `python crm_studio/scripts/blocks.py dump saved_view`."""

import argparse
import difflib
import json
from pathlib import Path

PAGES = Path(__file__).resolve().parent.parent / "studio_page"


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("command", choices=sorted(COMMANDS))
	parser.add_argument("page")
	parser.add_argument("component_id", nargs="?")
	arguments = parser.parse_args()
	COMMANDS[arguments.command](BlockTree.load(arguments.page), arguments.component_id)


def dump(tree, component_id):
	print("\n".join(tree.outline()))


def find(tree, component_id):
	if not component_id:
		raise SystemExit("find needs a componentId")
	block = tree.find(component_id)
	if not block:
		raise SystemExit(f"no block with componentId {component_id}")
	print(json.dumps(block, indent=1))


def diff(tree, component_id):
	if tree.draft is None:
		print("no draft_blocks — the page is published")
		return
	lines = difflib.unified_diff(
		tree.outline(tree.draft, detail=True),
		tree.outline(tree.blocks, detail=True),
		"draft_blocks",
		"blocks",
		lineterm="",
	)
	print("\n".join(lines) or "draft_blocks matches blocks")


COMMANDS = {"dump": dump, "find": find, "diff": diff}


class BlockTree:
	"""The block tree of one Studio page, addressed by componentId."""

	def __init__(self, path: Path):
		self.path = path
		self.raw = path.read_text()
		self.document = json.loads(self.raw)

	@classmethod
	def load(cls, page: str):
		path = PAGES / page / f"{page}.json"
		if not path.exists():
			raise SystemExit(f"no such page: {path}")
		return cls(path)

	@property
	def blocks(self):
		return self.document["blocks"]

	@property
	def draft(self):
		return self.document.get("draft_blocks")

	def find(self, component_id: str):
		for block, _, _ in self.walk():
			if block.get("componentId") == component_id:
				return block
		return None

	def outline(self, blocks=None, detail=False):
		lines = []
		for block, depth, slot in self.walk(blocks):
			prefix = f"[slot {slot}] " if slot else ""
			lines.append("  " * depth + prefix + self.describe(block, detail))
		return lines

	# Blocks nest through `children` and through `componentSlots[<slot>].slotContent`; a walk that
	# follows only `children` misses everything a page puts in the app shell's header slot.
	def walk(self, blocks=None, depth=0, slot=None):
		for block in self.blocks if blocks is None else blocks:
			yield block, depth, slot
			yield from self.walk(block.get("children", []), depth + 1)
			for name, content in (block.get("componentSlots") or {}).items():
				yield from self.walk(content.get("slotContent", []), depth + 1, name)

	# `dump` wants a scannable map, so it drops styles and clips props; `diff` needs every field
	# it compares to be spelled out in full.
	@classmethod
	def describe(cls, block, detail=False):
		parts = [f"{block.get('componentName')} #{block.get('componentId')}"]
		keys = ("componentProps", "baseStyles") if detail else ("componentProps",)
		for key in keys:
			if block.get(key):
				value = json.dumps(block[key], sort_keys=True)
				parts.append(f"{key}={value if detail else cls.clip(value)}")
		if block.get("visibilityCondition"):
			parts.append(f"vis={block['visibilityCondition']}")
		return " ".join(parts)

	@staticmethod
	def clip(value, width=70):
		return value if len(value) <= width else value[:width] + "…"

	# Studio's publish() copies draft_blocks over blocks, so leaving a stale draft in place would
	# bury the edit made here.
	def save(self, sync_draft=True):
		if sync_draft and self.draft is not None:
			self.document["draft_blocks"] = json.loads(json.dumps(self.blocks))
		text = json.dumps(self.document, indent=1)
		self.path.write_text(text + "\n" if self.raw.endswith("\n") else text)


if __name__ == "__main__":
	main()
