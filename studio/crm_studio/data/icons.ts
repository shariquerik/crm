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
