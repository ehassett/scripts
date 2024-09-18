from terrasnek.api import TFC
import os

TFC_TOKEN = os.getenv("TFC_TOKEN", None)
TFC_URL = os.getenv("TFC_URL", "https://app.terraform.io")
TFC_ORGANIZATION = os.getenv("TFC_ORGANIZATION", None)
SSL_VERIFY = os.getenv("SSL_VERIFY", False)

api = TFC(TFC_TOKEN, url=TFC_URL, verify=SSL_VERIFY)
api.set_org(TFC_ORGANIZATION)

# Set one of these first
# TFC_WORKSPACES is a list of workspaces to unlock
# TFC_PROJECT is a project name to unlock all workspaces inside (takes priority)
TFC_WORKSPACES = []
TFC_PROJECT = os.getenv("TFC_PROJECT", "")

if len(TFC_WORKSPACES) == 0 and TFC_PROJECT == "":
  raise Exception("Workspaces or Project must be set")

if TFC_PROJECT != "":
  # Get project ID
  projectID = api.projects.list("", "", [], TFC_PROJECT)['data'][0]['id']
  # Get workspaces in project
  filters=[{
    "keys": ["project", "id"],
    "value": projectID
  }]
  workspaces = api.workspaces.list_all("", [], filters)
else:
  workspaces = TFC_WORKSPACES

# Filter locked workspaces
lockedWorkspaces = []
for w in workspaces['data']:
  if w['attributes']['locked']:
    lockedWorkspaces.append({
      "name": w['attributes']['name'],
      "id": w['id']
    })

# Unlock workspaces
for w in lockedWorkspaces:
  print("Unlocking workspace: " + w['name'])
  api.workspaces.force_unlock(w['id'])