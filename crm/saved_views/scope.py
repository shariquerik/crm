# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

"""The navigation scope every section CRM owns is created and read in.

A Navigation Section belongs to an app, and only that app's sections reach its
sidebar — so seeding, migrating, and the frontend all have to name the same one.
The client half of this constant is `APP_NAME` in `crm_studio/data/apps.ts`.
"""

CRM_APP = "crm"
