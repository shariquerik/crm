import frappe
from frappe.query_builder import Order

# `Notification Log.app` follows the reference doctype's owning app: CRM doctypes resolve to
# "crm", Contact and Organization to "frappe". Both belong in this bell; other apps do not.
MENTION_APPS = ("crm", "frappe")

# `frontend/` has no generic `/:doctype/:id` route. A doctype absent from this map serializes
# with `route_name: None` and renders unclickable.
MENTION_ROUTES = {
	"CRM Lead": ("Lead", "lead"),
	"CRM Deal": ("Deal", "deal"),
	"Contact": ("Contact", "contact"),
	"CRM Organization": ("Organization", "organization"),
}


@frappe.whitelist()
def get_notifications():
	notifications = _get_crm_notifications() + _get_mention_notifications()
	notifications.sort(key=lambda n: n["creation"], reverse=True)
	return notifications


def _get_crm_notifications():
	Notification = frappe.qb.DocType("CRM Notification")
	query = (
		frappe.qb.from_(Notification)
		.select("*")
		.where(Notification.to_user == frappe.session.user)
		.orderby("creation", order=Order.desc)
	)

	_notifications = []
	for notification in query.run(as_dict=True):
		_notifications.append(
			{
				"creation": notification.creation,
				"from_user": {
					"name": notification.from_user,
					"full_name": frappe.get_value("User", notification.from_user, "full_name"),
				},
				"type": notification.type,
				"to_user": notification.to_user,
				"read": notification.read,
				"hash": get_hash(notification),
				"notification_text": notification.notification_text,
				"notification_type_doctype": notification.notification_type_doctype,
				"notification_type_doc": notification.notification_type_doc,
				"document_type": notification.reference_doctype,
				"document_name": notification.reference_name,
				"reference_doctype": ("deal" if notification.reference_doctype == "CRM Deal" else "lead"),
				"reference_name": notification.reference_name,
				"route_name": ("Deal" if notification.reference_doctype == "CRM Deal" else "Lead"),
				"source": "CRM Notification",
				"name": notification.name,
			}
		)

	return _notifications


def _get_mention_notifications():
	Log = frappe.qb.DocType("Notification Log")
	query = (
		frappe.qb.from_(Log)
		.select("*")
		.where(Log.for_user == frappe.session.user)
		.where(Log.type == "Mention")
		.where(Log.app.isin(MENTION_APPS))
		.orderby("creation", order=Order.desc)
	)

	_notifications = []
	for log in query.run(as_dict=True):
		route_name, route_key = MENTION_ROUTES.get(log.document_type, (None, None))
		_notifications.append(
			{
				"creation": log.creation,
				"from_user": {
					"name": log.from_user,
					"full_name": frappe.get_value("User", log.from_user, "full_name"),
				},
				"type": "Mention",
				"to_user": log.for_user,
				"read": log.read,
				# The framework's payload carries the record, never the comment, so there is
				# no anchor to land on: a mention opens the feed at the top.
				"hash": "",
				"notification_text": get_mention_text(log),
				"notification_type_doctype": "Notification Log",
				"notification_type_doc": log.name,
				"document_type": log.document_type,
				"document_name": log.document_name,
				"reference_doctype": route_key,
				"reference_name": log.document_name,
				"route_name": route_name,
				"source": "Notification Log",
				"name": log.name,
			}
		)

	return _notifications


def get_mention_text(log):
	"""Render a `Notification Log` mention into the markup the bell already renders.

	`subject` is the framework's message, already bolded and escaped by `notify_mentions`.
	"""
	return f"""
        <div class="mb-2 leading-5 text-ink-gray-5">
            <span>{log.subject or ""}</span>
        </div>
    """


@frappe.whitelist()
def mark_as_read(doc: str | None = None):
	user = frappe.session.user

	filters = {"to_user": user, "read": False}
	or_filters = []
	if doc:
		or_filters = [
			{"comment": doc},
			{"notification_type_doc": doc},
		]
	for n in frappe.get_all("CRM Notification", filters=filters, or_filters=or_filters):
		d = frappe.get_doc("CRM Notification", n.name)
		d.read = True
		d.save()

	log_filters = {"for_user": user, "read": False, "type": "Mention", "app": ["in", MENTION_APPS]}
	if doc:
		log_filters["name"] = doc
	for n in frappe.get_all("Notification Log", filters=log_filters):
		frappe.db.set_value("Notification Log", n.name, "read", 1)


def get_hash(notification):
	_hash = ""
	if notification.type == "Mention" and notification.notification_type_doc:
		_hash = "#" + notification.notification_type_doc

	if notification.type == "WhatsApp":
		_hash = "#whatsapp"

	if notification.type == "Assignment" and notification.notification_type_doctype == "CRM Task":
		_hash = "#tasks"
		if "has been removed by" in notification.message:
			_hash = ""
	return _hash
