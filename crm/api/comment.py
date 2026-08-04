from collections.abc import Iterable

import frappe
from frappe.desk.form.utils import add_comment as frappe_add_comment
from frappe.utils import get_fullname


@frappe.whitelist()
def add_comment(reference_doctype: str, reference_name: str, content: str, attachments: list | None = None):
	"""Add a comment to the given document

	:param reference_doctype: Reference Doctype
	:param reference_name: Reference Document Name
	:param content: Comment Content (HTML)
	:param attachments: List of File names or dicts with keys "fname" and "fcontent"
	:return: Comment Document
	"""
	comment = frappe_add_comment(
		reference_doctype,
		reference_name,
		content,
		comment_email=frappe.session.user,
		comment_by=get_fullname(frappe.session.user),
	)

	if attachments and comment.name:
		add_attachments(comment.name, attachments)

	return comment


def add_attachments(name: str, attachments: Iterable[str | dict]) -> None:
	"""Add attachments to the given Comment

	:param name: Comment name
	:param attachments: File names or dicts with keys "fname" and "fcontent"
	"""
	# loop through attachments
	for a in attachments:
		if isinstance(a, str):
			attach = frappe.db.get_value("File", {"name": a}, ["file_url", "is_private"], as_dict=1)
			file_args = {
				"file_url": attach.file_url,
				"is_private": attach.is_private,
			}
		elif isinstance(a, dict) and "fcontent" in a and "fname" in a:
			# dict returned by frappe.attach_print()
			file_args = {
				"file_name": a["fname"],
				"content": a["fcontent"],
				"is_private": 1,
			}
		else:
			continue

		file_args.update(
			{
				"attached_to_doctype": "Comment",
				"attached_to_name": name,
				"folder": "Home/Attachments",
			}
		)

		_file = frappe.new_doc("File")
		_file.update(file_args)
		_file.save(ignore_permissions=True)
