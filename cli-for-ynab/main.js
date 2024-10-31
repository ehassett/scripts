import { API } from "ynab";
import { confirm, select } from "@inquirer/prompts";
import mongoose from "mongoose";

const ynabToken = process.env.YNAB_TOKEN;
const ynabAPI = new API(ynabToken);

const useMongoDB = await confirm({
  message: "Would you like to use a local MongoDB database?",
});

const budgetSchema = new mongoose.Schema({
  server_knowledge: Number,
  budget: String,
  payees: Object,
  transactions: Object,
});

// getPayees retrieves all payees for a given budget and updates the database
async function getPayees(budgetID) {
  try {
    let payees;
    if (useMongoDB) {
      // Check database for latest payees
      let storedPayees = [];
      let serverKnowledge = 0;
      const Budget = mongoose.model("Budget", budgetSchema);
      const stored = await Budget.findOne({
        budget: budgetID,
        payees: { $ne: null },
      })
        .sort({
          server_knowledge: -1,
        })
        .exec();

      if (stored != null) {
        serverKnowledge = stored.server_knowledge;
        storedPayees = stored.payees;
      }

      // Get payees from YNAB and concatenate with latest payees in database
      const resp = await ynabAPI.payees.getPayees(budgetID, serverKnowledge);
      payees = filterDeleted(resp.data.payees.concat(storedPayees));

      // Update database with new data from YNAB
      const filter = {
        budget: budgetID,
        server_knowledge: resp.data.server_knowledge,
      };
      const current = await Budget.findOne(filter).exec();

      if (current != null) {
        await Budget.updateOne(filter, { payees: payees });
      } else {
        await Budget.create({
          server_knowledge: resp.data.server_knowledge,
          budget: budgetID,
          payees: payees,
        });
      }
    } else {
      const resp = await ynabAPI.payees.getPayees(budgetID);
      payees = resp.data.payees;
    }

    return payees;
  } catch (err) {
    handleError(err);
  }
}

// getTransactions retrieves all transactions for a given budget and updates the database
async function getTransactions(budgetID) {
  try {
    let transactions;
    if (useMongoDB) {
      // Check database for latest transactions
      let storedTransactions = [];
      let serverKnowledge = 0;
      const Budget = mongoose.model("Budget", budgetSchema);
      const stored = await Budget.findOne({
        budget: budgetID,
        transactions: { $ne: null },
      })
        .sort({
          server_knowledge: -1,
        })
        .exec();

      if (stored != null) {
        serverKnowledge = stored.server_knowledge;
        storedTransactions = stored.transactions;
      }

      // Get transactions from YNAB and concatenate with latest transactions in database
      const resp = await ynabAPI.transactions.getTransactions(
        budgetID,
        "1970-01-01",
        null,
        serverKnowledge
      );
      transactions = filterDeleted(
        resp.data.transactions.concat(storedTransactions)
      );

      // Update database with new data from YNAB
      const filter = {
        budget: budgetID,
        server_knowledge: resp.data.server_knowledge,
      };
      const current = await Budget.findOne(filter).exec();

      if (current != null) {
        await Budget.updateOne(filter, { transactions: transactions });
      } else {
        await Budget.create({
          server_knowledge: resp.data.server_knowledge,
          budget: budgetID,
          transactions: transactions,
        });
      }
    } else {
      const resp = await ynabAPI.transactions.getTransactions(budgetID);
      transactions = resp.data.transactions;
    }

    return transactions;
  } catch (err) {
    handleError(err);
  }
}

// auditPayees checks for payees that are not used in transactions
async function auditPayees(budgetID) {
  console.log("  Checking for unused payees...");

  // Get payees and transactions
  const payees = await getPayees(budgetID);
  const transactions = await getTransactions(budgetID);

  // Filter out payees that are not used in transactions
  const usedPayees = [];
  const unusedPayees = new Map();

  for (let transaction of transactions) {
    if (!usedPayees.includes(transaction.payee_id)) {
      usedPayees.push(transaction.payee_id);
    }
  }

  for (let payee of payees) {
    if (
      !usedPayees.includes(payee.id) &&
      payee.name != "Manual Balance Adjustment" &&
      payee.transfer_account_id == null &&
      payee.deleted == false
    ) {
      unusedPayees.set(payee.id, payee.name);
    }
  }

  // List unused payees
  if (unusedPayees.size > 0) {
    console.log("  Unused payees:");
    for (let payee of unusedPayees.values()) {
      console.log("    " + payee);
    }
  } else {
    console.log("  No unused payees found.");
  }
}

// filterDeleted filters out any items in data that have deleted set to true
function filterDeleted(data) {
  let filteredData = [];
  for (let item of data) {
    if (!item.deleted) {
      filteredData.push(item);
    }
  }
  return filteredData;
}

// handleError formats a message and throws an error based on where the error is coming from
function handleError(err) {
  if (err.error == null) {
    throw new Error(err);
  } else {
    let error =
      err.error.detail + " [" + err.error.id + " " + err.error.name + "]";
    throw new Error(error);
  }
}

async function main() {
  let budget;

  try {
    let budgets = [];

    // Optionally connect to database
    if (useMongoDB) {
      await mongoose.connect("mongodb://127.0.0.1:27017/db");
    }

    // Get budgets
    const resp = await ynabAPI.budgets.getBudgets();

    // Prompt user to select a budget
    for (let budget of resp.data.budgets) {
      budgets.push({ name: budget.name, value: budget.id });
    }
    budget = await select({
      message: "Which budget should be used?",
      choices: budgets,
    });
  } catch (err) {
    handleError(err);
  }

  while (true) {
    // Prompt user to select an action
    let action = await select({
      message: "What would you like to do?",
      choices: [
        { name: "Audit Payees", value: "audit" },
        { name: "Exit", value: "exit" },
      ],
    });

    if (action === "audit") {
      await auditPayees(budget);
    } else if (action === "exit") {
      break;
    }
  }

  if (useMongoDB) {
    mongoose.disconnect();
  }
}

await main();
