import { confirm, input, select } from "@inquirer/prompts";
import mongoose from "mongoose";
import { exec } from "child_process";
import { API } from "ynab";
import * as db from "./src/db.js";
import * as utils from "./src/utils.js";
import * as ynab from "./src/ynab.js";

// auditPayees checks for payees that are not used in transactions
async function auditPayees(ynabAPI, budgetID, useMongoDB) {
  // Get payees from API if not using database
  const payees = useMongoDB
    ? await db.queryPayees(ynabAPI, budgetID)
    : (await ynabAPI.payees.getPayees(budgetID)).data.payees;

  // Get transactions from API if not using database
  const transactions = useMongoDB
    ? await db.queryTransactions(ynabAPI, budgetID)
    : (await ynabAPI.transactions.getTransactions(budgetID)).data.transactions;

  // Get list of payees used in transactions
  const usedPayees = transactions.reduce((acc, transaction) => {
    if (!acc.includes(transaction.payee_id)) {
      acc.push(transaction.payee_id);
    }
    return acc;
  }, []);

  // Filter out payees that are not used in transactions
  const unusedPayees = payees.reduce((acc, payee) => {
    if (
      !usedPayees.includes(payee.id) &&
      payee.name != "Manual Balance Adjustment" &&
      payee.transfer_account_id == null
    ) {
      acc.push(payee);
    }
    return acc;
  }, []);

  // List unused payees, if any
  if (unusedPayees.length > 0) {
    console.log("  Unused payees:");
    for (let payee of unusedPayees) {
      console.log("    " + payee.name);
    }
  } else {
    console.log("  No unused payees found.");
  }
}

// bulkEditMemos updates the memo field for selected transactions
async function bulkEditMemos(ynabAPI, budgetID, useMongoDB) {
  // Get list of accounts from API if not using database
  let accounts = [{ name: "All Accounts", value: null }];
  let retrievedAccounts = useMongoDB
    ? await db.queryAccounts(ynabAPI, budgetID)
    : (await ynabAPI.accounts.getAccounts(budgetID)).data.accounts;
  for (let account of retrievedAccounts) {
    accounts.push({ name: account.name, value: account.id });
  }

  // Prompt user to select an account
  const account = await select({
    message: "Which account should be used?",
    choices: accounts,
  });

  // Prompt user to select memo update method
  const method = await select({
    message: "How would you like to search for transactions to update?",
    choices: [
      {
        name: "Existing Memo",
        value: "memoSearch",
        description: "Search for text in existing memos (case sensitive).",
      },
      {
        name: "Payee Name",
        value: "payeeSearch",
        description: "Select a specific payee.",
      },
      {
        name: "Date",
        value: "dateSearch",
        description: "Select a specific date.",
      },
      {
        name: "Cancel",
        value: "cancel",
        description: "Return to home screen without making changes.",
      },
    ],
  });
  if (method === "cancel") {
    return;
  }

  // Get list of transactions from API if not using database
  let transactions = [];
  if (!useMongoDB) {
    let resp;
    if (account === null) {
      resp = await ynabAPI.transactions.getTransactions(budgetID);
    } else {
      resp = await ynabAPI.transactions.getTransactionsByAccount(
        budgetID,
        account
      );
    }
    transactions = resp.data.transactions;
  }

  // Get list of matching transactions based on search method
  if (method === "memoSearch") {
    // Prompt user to enter search term
    const search = await input({
      message: "Existing Memo Includes:",
      required: true,
    });

    if (useMongoDB) {
      // Get filtered transactions from database if using MongoDB
      transactions = await db.queryTransactions(ynabAPI, budgetID, account, {
        "data.memo": { $regex: search, $options: "i" },
      });
    } else {
      // Filter API response transactions by memo
      transactions = transactions.filter(
        (transaction) => transaction.memo && transaction.memo.includes(search)
      );
    }
  } else if (method === "payeeSearch") {
    // Get list of payees from API if not using database
    let payees = (
      useMongoDB
        ? await db.queryPayees(ynabAPI, budgetID)
        : (await ynabAPI.payees.getPayees(budgetID)).data.payees
    ).map((payee) => ({
      name: payee.name,
      value: payee.id,
    }));

    // Get transactions from database if using MongoDB
    if (useMongoDB) {
      transactions = await db.queryTransactions(ynabAPI, budgetID, account);
    }

    if (account !== null) {
      // Filter out payees that are not used in account transactions
      const transactionPayees = transactions.map(
        (transaction) => transaction.payee_id
      );
      payees = payees.reduce((acc, payee) => {
        if (transactionPayees.includes(payee.value)) {
          acc.push(payee);
        }
        return acc;
      }, []);
    }

    // Alphabetize payee names
    payees.sort(function (a, b) {
      // toUpperCase() ensures case insensitive sorting
      let aName = a.name.toUpperCase();
      let bName = b.name.toUpperCase();
      return aName < bName ? -1 : aName > bName ? 1 : 0;
    });

    // Prompt user to select a payee
    const payee = await select({
      message: "Payee Name (type to search list)",
      choices: payees,
    });

    // Filter transactions by payee
    transactions = transactions.filter(
      (transaction) => transaction.payee_id === payee
    );
  } else if (method === "dateSearch") {
    // Get start and end year of budget
    const budget = await ynab.getBudget(ynabAPI, budgetID);
    const startYear = budget.first_month.split("-")[0];
    const endYear = budget.last_month.split("-")[0];

    // Forumlate list of years and months
    const years = utils.range(parseInt(startYear), endYear);
    const months = Array.from({ length: 12 }, (_item, i) => {
      let month = new Date(0, i).toLocaleString("en-US", { month: "long" });
      return { name: month, value: String(i + 1).padStart(2, "0") };
    });

    // Prompt user to select date
    const year = await select({
      message: "Year",
      choices: years.map(String),
    });
    const month = await select({
      message: "Month",
      choices: months,
    });
    const days = utils.range(1, utils.daysInMonth(month, year));
    const day = await select({
      message: "Day",
      choices: days.map(String),
    });
    const date = year + "-" + month + "-" + day;

    if (useMongoDB) {
      // Get filtered transactions from database if using MongoDB
      transactions = await db.queryTransactions(ynabAPI, budgetID, account, {
        "data.date": date,
      });
    } else {
      // Filter API response transactions by date
      transactions = transactions.filter(
        (transaction) => transaction.date === date
      );
    }
  }

  // Output number matching transactions, if any
  if (transactions.length === 0) {
    console.log("  No matching transactions found.");
    return;
  }
  console.log("  Matching transactions: " + transactions.length);

  // Prompt user to select memo update action
  const action = await select({
    message: "What would you like to do?",
    choices: [
      {
        name: "Prepend Memo",
        value: "prepend",
        description:
          "Add text to the beginning of the memo. Spaces are included.",
      },
      {
        name: "Append Memo",
        value: "append",
        description: "Add text to the end of the memo. Spaces are included.",
      },
      {
        name: "Overwrite Memo",
        value: "overwrite",
        description: "Replace the memo with a new one.",
      },
      {
        name: "Cancel",
        value: "cancel",
        description: "Return to home screen without making changes.",
      },
    ],
  });
  if (action === "cancel") {
    return;
  }

  // Prompt user for input text
  const text = await input({
    message: utils.capitalizeFirstLetter(action) + " the memo with:",
  });

  // Prompt user to confirm changes
  const isPlural = transactions.length == 1 ? " transaction" : " transactions";
  const message =
    "Update " +
    transactions.length +
    isPlural +
    " (" +
    action +
    " with '" +
    text +
    "')?";
  const confirmChanges = await confirm({
    message: message,
  });
  if (!confirmChanges) {
    return;
  }

  // Formulate new memo for each transaction
  for (let transaction of transactions) {
    if (action === "prepend") {
      Object.assign(transaction, { memo: text + transaction.memo });
    } else if (action === "append") {
      Object.assign(transaction, { memo: transaction.memo + text });
    } else if (action === "overwrite") {
      Object.assign(transaction, { memo: text });
    }
  }

  // Update transactions in YNAB and database (if used)
  if (useMongoDB) {
    await ynab.updateTransactions(ynabAPI, budgetID, transactions);
  } else {
    await ynabAPI.transactions.updateTransactions(budgetID, {
      transactions: transactions,
    });
  }
}

// isDockerInstalled checks if Docker is installed
function isDockerInstalled() {
  return new Promise((resolve) => {
    exec("docker -v", (err) => {
      if (err) {
        const e = new Error();
        e.name = "DockerInstallationError";
        throw e;
      }
    });
    resolve();
  });
}

// checkContainerStatus checks if a Docker container exists and is running
function checkContainerStatus(containerName) {
  return new Promise((resolve, reject) => {
    exec("docker container inspect " + containerName, (err, output) => {
      if (!err) {
        const outputJson = JSON.parse(output);
        resolve({
          exists: true,
          running: outputJson[0].State.Status === "running",
        });
      } else if (err && err.code === 1) {
        resolve({ exists: false, running: false });
      } else if (err) {
        const e = new Error();
        e.name = "DockerContainerError";
        reject(e);
      }
    });
  });
}

// startMongoDBContainer starts a MongoDB Docker container, creating one if needed
function startMongoDBContainer(containerName) {
  return new Promise(async (resolve, reject) => {
    // Check container status
    const status = await checkContainerStatus(containerName);
    if (status.exists && status.running) {
      let res = status;
      res.started = false;
      res.created = false;
      resolve(res);
    } else if (status.exists && !status.running) {
      // Attempt to start existing container
      exec("docker start " + containerName, async (err) => {
        if (err) {
          const e = new Error();
          e.name = "DockerStartError";
          reject(e);
        }

        // Check and update status
        let res = await checkContainerStatus(containerName);
        res.started = true;
        res.created = false;
        resolve(res);
      });
    } else {
      // Create and start new MongoDB container
      exec(
        "docker run --detach --name " +
          containerName +
          " --volume " +
          containerName +
          ":/data/db --publish 27017:27017 mongo:8",
        async (err) => {
          if (err) {
            const e = new Error();
            e.name = "DockerCreateError";
            reject(e);
          }

          // Check and update status
          let res = await checkContainerStatus(containerName);
          res.started = true;
          res.created = true;
          resolve(res);
        }
      );
    }
  });
}

// stopMongoDBContainer stops a MongoDB Docker container
function stopMongoDBContainer(containerName) {
  return new Promise((resolve, reject) => {
    exec("docker stop " + containerName, (err) => {
      if (err) {
        const e = new Error();
        e.name = "DockerStopError";
        reject(e);
      }
      resolve();
    });
  });
}

async function main() {
  try {
    const containerName = "cli-for-ynab-db";

    // Initialize YNAB API
    let ynabToken;
    if (process.env.YNAB_TOKEN) {
      ynabToken = process.env.YNAB_TOKEN;
    } else {
      ynabToken = await input({
        message: "Enter your YNAB API token:",
        required: true,
        transformer: (text) => {
          return "*".repeat(text.length);
        },
      });
    }
    const ynabAPI = new API(ynabToken);
    const budgets = await ynab.getBudgets(ynabAPI);

    // Initialize MongoDB if selected
    const useMongoDB = await confirm({
      message: "Would you like to use a local MongoDB database?",
    });
    if (useMongoDB) {
      // Check if Docker is installed
      await isDockerInstalled();

      // Check container status
      let status = await checkContainerStatus(containerName);
      if (!status.running) {
        // Prompt to start MongoDB container
        const startMongoDB = await confirm({
          message:
            "Would you like to create/start the '" +
            containerName +
            "' container automatically?",
        });
        if (startMongoDB) {
          await startMongoDBContainer(containerName);
        } else {
          console.log(
            "  Please manually create/start the '" +
              containerName +
              "' container."
          );
          process.exit();
        }
      }

      // Connect to MongoDB
      await mongoose.connect("mongodb://127.0.0.1:27017/db", {
        serverSelectionTimeoutMS: 5000,
      });
    }

    // Prompt user to select a budget
    const budget = await select({
      message: "Which budget should be used?",
      choices: budgets,
    });

    while (true) {
      // Prompt user to select an action
      let action = await select({
        message: "What would you like to do?",
        choices: [
          {
            name: "Audit Payees",
            value: "auditPayees",
            description: "Search transactions to check for any unused payees.",
          },
          {
            name: "Bulk Edit Memos",
            value: "bulkEditMemos",
            description: "Update the memo field for one or more transactions.",
          },
          { name: "Exit", value: "exit" },
        ],
      });
      if (action === "exit") {
        break;
      } else if (action === "auditPayees") {
        await auditPayees(ynabAPI, budget, useMongoDB);
      } else if (action == "bulkEditMemos") {
        await bulkEditMemos(ynabAPI, budget, useMongoDB);
      }
    }

    // Disconnect from MongoDB if used
    if (useMongoDB) {
      mongoose.disconnect();

      // Prompt to stop MongoDB container
      const stopMongoDB = await confirm({
        message:
          "Would you like to stop the '" +
          containerName +
          "' container automatically?",
      });
      if (stopMongoDB) {
        await stopMongoDBContainer(containerName);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "ExitPromptError") {
      // Exit cleanly if user cancels prompt
    } else if (err.error && err.error.id == "401") {
      console.error("  YNAB API token invalid, please try again.");
    } else if (
      err instanceof Error &&
      err.name === "MongooseServerSelectionError"
    ) {
      console.error("  MongoDB connection failed, please try again.");
    } else if (err instanceof Error && err.name === "DockerInstallationError") {
      console.error("  Could not run Docker, please verify installation.");
    } else if (err instanceof Error && err.name === "DockerContainerError") {
      console.error("  Could not check Docker container status.");
    } else if (err instanceof Error && err.name === "DockerStartError") {
      console.error("  Could not start Docker container.");
    } else if (err instanceof Error && err.name === "DockerCreateError") {
      console.error("  Could not create Docker container.");
    } else if (err instanceof Error && err.name === "DockerStopError") {
      console.error("  Could not stop Docker container.");
    } else {
      throw err;
    }
    process.exit();
  }
}

await main();
