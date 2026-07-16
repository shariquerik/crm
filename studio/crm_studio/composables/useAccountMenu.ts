import { useTheme } from "frappe-ui"
import { computed } from "vue"

import { currentUser, loadCurrentUser, logout, userLabel } from "@app/data/session"

/**
 * The account menu for the app chrome (the avatar at the foot of the rail): the current user for
 * the avatar, plus the dropdown's options — a "Toggle theme" submenu (Light / Dark / System, the
 * active one flagged via `selected`) and "Log out".
 *
 * Theme is frappe-ui's `useTheme()` singleton: it drives `<html data-theme>` and persists the
 * choice to localStorage, so it sticks across reloads. The `lucide-*` icons are written as literal
 * strings on purpose — frappe-ui registers lucide through a Tailwind matchComponents pack, so a
 * class only gets CSS when its exact name appears in scanned source (the same constraint the
 * shell's RAIL_ICONS documents).
 *
 * Session data (user, logout) comes from `@app/data/session`; this composable only layers the
 * theme + menu assembly on top, so the shell consumes one thing.
 */
export function useAccountMenu() {
	const { currentTheme, setTheme } = useTheme()

	const userMenuOptions = computed(() => [
		{
			icon: "lucide-moon",
			label: "Toggle theme",
			submenu: [
				{
					icon: "lucide-sun",
					label: "Light Mode",
					selected: currentTheme.value === "light",
					onClick: () => setTheme("light"),
				},
				{
					icon: "lucide-moon",
					label: "Dark Mode",
					selected: currentTheme.value === "dark",
					onClick: () => setTheme("dark"),
				},
				{
					icon: "lucide-monitor",
					label: "System Default",
					selected: currentTheme.value === "system",
					onClick: () => setTheme("system"),
				},
			],
		},
		{
			icon: "lucide-log-out",
			label: "Log out",
			onClick: logout,
		},
	])

	return { currentUser, userLabel, userMenuOptions, loadCurrentUser }
}
