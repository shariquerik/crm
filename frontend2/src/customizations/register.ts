// CRM's own record-page scripts, bound by filename: `CRM Deal.js` customizes
// the CRM Deal record page. Glob order is path order, so run order is
// deterministic and inspectable in the repo.
import { registerRecordPage } from '@framework/ui/experimental'
import type { RecordPageHandlers } from '@framework/ui/experimental'

const scripts = import.meta.glob<{ default: RecordPageHandlers }>('./*.js', {
  eager: true,
})

for (const [path, script] of Object.entries(scripts)) {
  const doctype = path.replace('./', '').replace(/\.js$/, '')
  if (script.default) registerRecordPage(doctype, script.default)
}
