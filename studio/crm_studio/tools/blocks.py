"""Inspect Studio page block trees on disk: `python crm_studio/tools/blocks.py dump saved_view`."""

import argparse
import difflib
import json
from pathlib import Path

PAGES = Path(__file__).resolve().parent.parent / "studio_page"


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	commands = parser.add_subparsers(dest="command", required=True)
	for name in ("dump", "diff"):
		commands.add_parser(name).add_argument("page")
	locate = commands.add_parser("find")
	locate.add_argument("page")
	locate.add_argument("component_id")
	commands.add_parser("check").add_argument("pages", nargs="*")
	arguments = parser.parse_args()
	return COMMANDS[arguments.command](arguments)


def dump(arguments):
	print("\n".join(BlockTree.load(arguments.page).outline()))


def find(arguments):
	block = BlockTree.load(arguments.page).find(arguments.component_id)
	if not block:
		raise SystemExit(f"no block with componentId {arguments.component_id}")
	print(json.dumps(block, indent=1))


def diff(arguments):
	tree = BlockTree.load(arguments.page)
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


# Committing a page whose draft_blocks is set commits builder state that Studio has not published,
# and the builder would then show that draft instead of what the file's `blocks` say.
def check(arguments):
	drafted = [tree.path.name for tree in BlockTree.load_all(arguments.pages) if tree.draft]
	if not drafted:
		return 0
	print(f"unpublished draft_blocks in: {', '.join(drafted)}")
	print("Publish the page in the builder, or clear draft_blocks, before committing.")
	return 1


COMMANDS = {"dump": dump, "find": find, "diff": diff, "check": check}


class BlockTree:
	"""The block tree of one Studio page, addressed by componentId."""

	def __init__(self, path: Path):
		self.path = path
		self.raw = path.read_text()
		self.document = json.loads(self.raw)

	# Takes a page name for a human, or a path for whatever pre-commit hands `check`.
	@classmethod
	def load(cls, page):
		path = Path(page)
		if not path.suffix:
			path = PAGES / page / f"{page}.json"
		if not path.exists():
			raise SystemExit(f"no such page: {path}")
		return cls(path)

	@classmethod
	def load_all(cls, pages):
		return [cls.load(page) for page in pages or sorted(PAGES.glob("*/*.json"))]

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

	# Dropping draft_blocks is what Studio's own publish() does, and an exported page omits the key
	# entirely. Keeping a draft would bury this edit: the builder renders the draft over `blocks`.
	def save(self):
		self.document.pop("draft_blocks", None)
		text = json.dumps(self.document, indent=1)
		self.path.write_text(text + "\n" if self.raw.endswith("\n") else text)


if __name__ == "__main__":
	raise SystemExit(main())
