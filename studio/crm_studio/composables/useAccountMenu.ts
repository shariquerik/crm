import { useTheme } from "frappe-ui"
import { computed } from "vue"

import { currentUser, loadCurrentUser, logout, userLabel } from "@app/data/session"

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
