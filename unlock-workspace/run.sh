#!/bin/bash -e

python3 -m venv . && source ./bin/activate && python3 -m pip install -r requirements.txt
python3 unlock-workspace.py