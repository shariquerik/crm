// The Lucide sprite is the only list of names `<Icon>` can actually draw — the
// `.lucide-*` CSS classes exist only for names hard-coded in source, so anything
// data-driven (a saved icon, a picker's grid) has to come from here.

let names: string[] = []
let lookup = new Set<string>()

function load() {
  if (names.length) return
  const sprite = document.getElementById('lucide-sprite')
  if (!sprite) return
  names = Array.from(
    sprite.getElementsByTagName('symbol'),
    (symbol) => symbol.id,
  )
  lookup = new Set(names)
}

export function iconNames(): string[] {
  load()
  return names
}

export function isIconName(name: string): boolean {
  load()
  return lookup.has(name)
}
