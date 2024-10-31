# ehassett's scripts

This repository stores scripts that I've used once upon a time for any future needs.

# Contents

- [ehassett's scripts](#ehassetts-scripts)
- [Contents](#contents)
- [CLI for YNAB](#cli-for-ynab)
  - [Usage](#usage)
- [migrate-repository](#migrate-repository)
  - [Usage](#usage-1)
- [migrate-tfc-state](#migrate-tfc-state)
  - [Usage](#usage-2)
- [unlock-workspace](#unlock-workspace)
  - [Usage](#usage-3)
- [sed commands](#sed-commands)

# [CLI for YNAB](./cli-for-ynab/README.md)

Tool for performing various YNAB actions via CLI.

## Usage

Please take a look at the dedicated [README](./cli-for-ynab/README.md).

# [migrate-repository](./migrate-repository/)

Interactive script to copy files, remove artifacts, and perform other actions as a migration from a base repo to a target repo.

## Usage

```
Options:
  -d (dry-run) - run script without making changes to files to test for intended outcome.
  -h (help)    - display this help text.
  -q (quiet)   - run all tasks using default values.
Default Values:
  target repository path: .
  base repository path:   ../base-repository
  artifacts to remove:    .chglog, CHANGELOG.md, Jenkinsfile, build-spec.yml
  files to copy:          .editorconfig, .gitattributes, .gitignore, .terraform-docs.yml, .tfsec.yml, CODE_OF_CONDUCT.md, CODEOWNERS, commitlint.config.js, CONTRIBUTORS.md, LICENSE, SUPPORT.md
  codeowners to add:      @ehassett
  branch name:            migrate-repository
  commit message:         chore: remove artifacts and copy files
```

# [migrate-tfc-state](./migrate-tfc-state/)

Python script for copying the Terraform Cloud (or Enterprise) state file from one workspace to another.

## Usage

1. Ensure that you have the `TFC_TOKEN` and `TFC_ORGANIZATION` environment variables set.
   - If using Terraform Enterprise, `TFC_URL` will need set as well. It defaults to `app.terraform.io`.
2. Run the command `python migrate-tfc-state.py <source_workspace> <target_workspace> [-auto]`:
   - replace `<source_workspace>` with the workspace you want to copy state from
   - replace `<target_workspace>` with the workspace you want to copy state to
   - optionally specify `-auto` at the end of the command to skip confirmation

# [unlock-workspace](./unlock-workspace/)

Python script for unlocking Terraform Cloud (or Enterprise) workspaces by list or project.

## Usage

1. Ensure that you have the `TFC_TOKEN` and `TFC_ORGANIZATION` environment variables set.
   - If using Terraform Enterprise, `TFC_URL` will need set as well. It defaults to `app.terraform.io`.
2. If you want to unlock a whole project, set the `TFC_PROJECT` environment variable.
3. If you want to unlock a list of workspaces, edit the script by adding the list to `TFC_WORKSPACES`.
4. Run `unlock-workspace.py` or to make it easier, run `run.sh` to set up venev automatically.

# sed commands

- Replace aliased Terraform provider in tfstate file with unaliased one:

```bash
sed -i '' '/registry/s/"provider\[\\"registry\.terraform\.io\/hashicorp\/aws\\"\]\..*"/"provider\[\\"registry\.terraform\.io\/hashicorp\/aws\\"\]"/g' *.tfstate
```
