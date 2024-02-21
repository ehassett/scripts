from terrasnek.api import TFC
import base64
import hashlib
import json
import os
import sys
import urllib

TFC_TOKEN = os.getenv("TFC_TOKEN", None)
TFC_URL = os.getenv("TFC_URL", "https://app.terraform.io")
TFC_ORGANIZATION = os.getenv("TFC_ORGANIZATION", None)
SSL_VERIFY = os.getenv("SSL_VERIFY", False)

api = TFC(TFC_TOKEN, url=TFC_URL, verify=SSL_VERIFY)
api.set_org(TFC_ORGANIZATION)

# Get source and target workspaces from args
auto = False
if len(sys.argv) < 3:
  raise RuntimeError("Both source and target workspace names are required")
source = sys.argv[1]
target = sys.argv[2]
if len(sys.argv) > 3:
  auto = sys.argv[3] == "-auto"

# Prompt user for confirmation
confirmation = "y" if auto else input("Migrate state from " + source + " to " + target + "? (y/[n]) ")
if confirmation != "y":
  print("No changes have been made, exiting...")
  exit(0)

# Get workspace IDs from names
sourceWorkspaceID = api.workspaces.show(source)['data']['id']
targetWorkspaceID = api.workspaces.show(target)['data']['id']
print("source: " + sourceWorkspaceID + " | target: " + targetWorkspaceID)

# Download source workspace state
sourceStateUrl = api.state_versions.get_current(sourceWorkspaceID)['data']['attributes']['hosted-state-download-url']
fileName = "/tmp/" + sourceWorkspaceID + ".tfstate"
opener = urllib.request.build_opener()
opener.addheaders = [("Authorization", "Bearer " + TFC_TOKEN)]
urllib.request.install_opener(opener)
urllib.request.urlretrieve(sourceStateUrl, fileName)

# Lock target workspace to prep for state push
payload = {
  "reason": "migrating state"
}
api.workspaces.lock(targetWorkspaceID, payload)

# Form payload for state push
f = open(fileName, 'rb').read()
md5 = hashlib.md5(f).hexdigest()
base64state = base64.b64encode(f)

f = open(fileName)
jsonState = json.load(f)
serial = jsonState['serial']
f.close()

payload = {
  "data": {
    "type": "state-versions",
    "attributes": {
      "serial": serial,
      "md5": md5,
      "state": base64state.decode("utf-8")
    }
  }
}

api.state_versions.create(targetWorkspaceID, payload)

# Clean up
api.workspaces.unlock(targetWorkspaceID)
os.remove(fileName)
