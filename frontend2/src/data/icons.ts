let lookup = new Set<string>()

function load() {
  if (lookup.size) return
  const sprite = document.getElementById('lucide-sprite')
  if (!sprite) return
  lookup = new Set(
    Array.from(sprite.getElementsByTagName('symbol'), (symbol) => symbol.id),
  )
}

export function isIconName(name: string): boolean {
  load()
  return lookup.has(name)
}
