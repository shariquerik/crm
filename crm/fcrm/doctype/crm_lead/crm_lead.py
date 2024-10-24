# Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from frappe.utils import has_gravatar, validate_email_address


class CRMLead(Document):
	def validate(self):
		self.set_full_name()
		self.set_lead_name()
		self.set_title()
		self.validate_email()
		if not self.is_new():
			self.validate_contact()
	
	def set_full_name(self):
		if self.first_name:
			self.lead_name = " ".join(
				filter(None, [self.salutation, self.first_name, self.middle_name, self.last_name])
			)

	def set_lead_name(self):
		if not self.lead_name:
			# Check for leads being created through data import
			if not self.organization_name and not self.email and not self.flags.ignore_mandatory:
				frappe.throw(_("A Lead requires either a person's name or an organization's name"))
			elif self.organization_name:
				self.lead_name = self.organization_name
			else:
				self.lead_name = self.email.split("@")[0]

	def set_title(self):
		self.title = self.organization_name or self.lead_name
	
	def validate_email(self):
		if self.email:
			if not self.flags.ignore_email_validation:
				validate_email_address(self.email, throw=True)

			if self.email == self.lead_owner:
				frappe.throw(_("Lead Owner cannot be same as the Lead Email Address"))

			if self.is_new() or not self.image:
				self.image = has_gravatar(self.email)
	
	def validate_contact(self):
		link = frappe.db.exists("Dynamic Link", {"link_doctype": "CRM Lead", "link_name": self.name})

		if link:
			for field in ["first_name", "last_name", "email", "mobile_no", "phone", "salutation", "image"]:
				if self.has_value_changed(field):
					contact = frappe.db.get_value("Dynamic Link", link, "parent")
					contact_doc = frappe.get_doc("Contact", contact)
					contact_doc.update({
						"first_name": self.first_name or self.lead_name,
						"last_name": self.last_name,
						"salutation": self.salutation,
						"image": self.image or "",
					})
					if self.has_value_changed("email"):
						contact_doc.email_ids = []
						contact_doc.append("email_ids", {"email_id": self.email, "is_primary": 1})

					if self.has_value_changed("phone"):
						contact_doc.append("phone_nos", {"phone": self.phone, "is_primary_phone": 1})

					if self.has_value_changed("mobile_no"):
						contact_doc.phone_nos = []
						contact_doc.append("phone_nos", {"phone": self.mobile_no, "is_primary_mobile_no": 1})

					contact_doc.save()
					break
		else:
			self.contact_doc = self.create_contact()
			self.link_to_contact()

	def before_insert(self):
		self.contact_doc = None
		self.contact_doc = self.create_contact()
	
	def after_insert(self):
		self.link_to_contact()
	
	def link_to_contact(self):
		# update contact links
		if self.contact_doc:
			self.contact_doc.append(
				"links", {"link_doctype": "CRM Lead", "link_name": self.name, "link_title": self.lead_name}
			)
			self.contact_doc.save()
	
	def create_contact(self):
		if not self.lead_name:
			self.set_full_name()
			self.set_lead_name()

		contact = frappe.new_doc("Contact")
		contact.update(
			{
				"first_name": self.first_name or self.lead_name,
				"last_name": self.last_name,
				"salutation": self.salutation,
				"gender": self.gender,
				"designation": self.job_title,
				"company_name": self.organization_name,
				"image": self.image or "",
			}
		)

		if self.email:
			contact.append("email_ids", {"email_id": self.email, "is_primary": 1})

		if self.phone:
			contact.append("phone_nos", {"phone": self.phone, "is_primary_phone": 1})

		if self.mobile_no:
			contact.append("phone_nos", {"phone": self.mobile_no, "is_primary_mobile_no": 1})

		contact.insert(ignore_permissions=True)
		contact.reload()  # load changes by hooks on contact

		return contact

	@staticmethod
	def sort_options():
		return [
			{ "label": 'Created', "value": 'creation' },
			{ "label": 'Modified', "value": 'modified' },
			{ "label": 'Status', "value": 'status' },
			{ "label": 'Lead owner', "value": 'lead_owner' },
			{ "label": 'Organization', "value": 'organization_name' },
			{ "label": 'Name', "value": 'lead_name' },
			{ "label": 'First Name', "value": 'first_name' },
			{ "label": 'Last Name', "value": 'last_name' },
			{ "label": 'Email', "value": 'email' },
			{ "label": 'Mobile no', "value": 'mobile_no' },
		]