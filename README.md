# ehassett's scripts

This repository stores scripts that I've used once upon a time for any future needs.

# migrate-repository

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