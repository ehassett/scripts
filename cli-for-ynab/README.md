# CLI for YNAB

Tool for performing various YNAB actions via CLI.

# Contents

- [CLI for YNAB](#cli-for-ynab)
- [Contents](#contents)
- [Prerequisites](#prerequisites)
- [Usage](#usage)
  - [MongoDB Backend (preferred)](#mongodb-backend-preferred)
  - [No Database](#no-database)

# Prerequisites

1. `YNAB_TOKEN` must be set in your environment variables. For more info, view the [docs](https://api.ynab.com/#personal-access-tokens).
2. Node must installed along with dependencies (`npm install`).
3. If using MongoDB backend, Docker must be installed as well.

# Usage

## MongoDB Backend (preferred)

Using this tool with a local MongoDB backend allows for quicker tasks as data is saved locally rather than retrieved from YNAB on every request.

First, create the database container:

```bash
docker run --detach \
    --name cli-for-ynab-db \
    --volume cli-for-ynab-db:/data/db \
    --publish 27017:27017 \
    mongo:8
```

Then, run the tool: `npm run start`

Make sure to select _yes_ when prompted to use local MongoDB storage.

## No Database

> **ℹ️** This may result in slower performance and potential rate limiting by YNAB.

Run the tool: `npm run start`

Make sure to select _no_ when prompted to use local MongoDB storage.
