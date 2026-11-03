// CRM's shell hook: desk v2 runs `setup` once per tab at idle, for people CRM admits.
import { askReload } from '@shell'
// PROTOTYPE (#46115): the call window's content in the standing frame; never merge.
import CallWindowPrototype from './telephony/prototype/CallWindowPrototype.vue'

// Both write Property Setters (and forecasting the deal layouts), which open pages read only on load.
const RELOAD_FIELDS = ['enable_forecasting', 'currency']

export function setup(shell) {
	shell.afterSave('FCRM Settings', (saved) => askReload(saved, RELOAD_FIELDS))
	const width = Number(new URLSearchParams(location.search).get('w')) || 240
	shell.window(CallWindowPrototype, { icon: 'lucide-phone', width })?.open()
}
