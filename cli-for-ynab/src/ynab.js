import mongoose from "mongoose";
import * as db from "./db.js";
import * as utils from "./utils.js";

// getBudget retrieves a budget by ID
export async function getBudget(ynabAPI, budgetID) {
  const resp = await ynabAPI.budgets.getBudgetById(budgetID);
  return resp.data.budget;
}

// getBudgets retrieves all budgets and returns an array of objects with name and id
export async function getBudgets(ynabAPI) {
  let budgets = [];
  const resp = await ynabAPI.budgets.getBudgets();
  for (let budget of resp.data.budgets) {
    budgets.push({ name: budget.name, value: budget.id });
  }
  return budgets;
}

// getAccounts retrieves all accounts for a given budget and updates the database
export async function getAccounts(ynabAPI, budgetID) {
  const Account = mongoose.model("Account", db.schema);
  let serverKnowledge = 0;
  let accounts = [];

  // Get all accounts from collection
  const storedAccounts = await Account.find({
    budget_id: budgetID,
  }).exec();

  // Set server knowledge to lowest saved value
  if (storedAccounts.length > 0) {
    const leastServerKnowledge = storedAccounts.reduce((prev, curr) => {
      return prev.server_knowledge < curr.server_knowledge ? prev : curr;
    });
    serverKnowledge = leastServerKnowledge.server_knowledge;
  }

  // Get accounts from YNAB
  const resp = await ynabAPI.accounts.getAccounts(budgetID, serverKnowledge);

  if (resp.data.server_knowledge === serverKnowledge) {
    // If server knowledge is the same, do nothing
    accounts = storedAccounts;
  } else if (
    resp.data.accounts.length === 0 &&
    resp.data.server_knowledge > serverKnowledge
  ) {
    // If no new accounts are returned, update server knowledge in records
    accounts = storedAccounts;
    await Account.updateMany(
      {
        budget_id: budgetID,
        server_knowledge: { $lt: resp.data.server_knowledge },
      },
      { server_knowledge: resp.data.server_knowledge }
    );
  } else {
    // Add budget ID and server knowledge to YNAB response
    for (let account of resp.data.accounts) {
      let document = {
        budget_id: budgetID,
        data: account,
        server_knowledge: resp.data.server_knowledge,
      };
      accounts.push(document);
    }

    // Concatenate with stored accounts
    accounts = accounts.concat(storedAccounts);

    // Remove duplicate accounts with lower server knowledge
    accounts = utils.filterServerKnowledge(accounts);

    // Update/create/delete records
    for (let account of accounts) {
      account.server_knowledge = resp.data.server_knowledge;
      const filter = {
        budget_id: budgetID,
        "data.id": account.data.id,
      };

      if (account.data.deleted) {
        await Account.deleteOne(filter);
      } else {
        await Account.updateOne(filter, account, {
          upsert: true,
        });
      }
    }
  }
}

// getPayees retrieves all payees for a given budget and updates the database
export async function getPayees(ynabAPI, budgetID) {
  const Payee = mongoose.model("Payee", db.schema);
  let serverKnowledge = 0;
  let payees = [];

  // Get all payees from collection
  const storedPayees = await Payee.find({
    budget_id: budgetID,
  }).exec();

  // Set server knowledge to lowest saved value
  if (storedPayees.length > 0) {
    const leastServerKnowledge = storedPayees.reduce((prev, curr) => {
      return prev.server_knowledge < curr.server_knowledge ? prev : curr;
    });
    serverKnowledge = leastServerKnowledge.server_knowledge;
  }

  // Get payees from YNAB
  const resp = await ynabAPI.payees.getPayees(budgetID, serverKnowledge);

  if (resp.data.server_knowledge === serverKnowledge) {
    // If server knowledge is the same, do nothing
    payees = storedPayees;
  } else if (
    resp.data.payees.length === 0 &&
    resp.data.server_knowledge > serverKnowledge
  ) {
    // If no new payees are returned, update server knowledge in records
    payees = storedPayees;
    await Payee.updateMany(
      {
        budget_id: budgetID,
        server_knowledge: { $lt: resp.data.server_knowledge },
      },
      { server_knowledge: resp.data.server_knowledge }
    );
  } else {
    // Add budget ID and server knowledge to YNAB response
    for (let payee of resp.data.payees) {
      let document = {
        budget_id: budgetID,
        data: payee,
        server_knowledge: resp.data.server_knowledge,
      };
      payees.push(document);
    }

    // Concatenate with stored payees
    payees = payees.concat(storedPayees);

    // Remove duplicate payees with lower server knowledge
    payees = utils.filterServerKnowledge(payees);

    // Update/create/delete records
    for (let payee of payees) {
      payee.server_knowledge = resp.data.server_knowledge;
      const filter = {
        budget_id: budgetID,
        "data.id": payee.data.id,
      };

      if (payee.data.deleted) {
        await Payee.deleteOne(filter);
      } else {
        await Payee.updateOne(filter, payee, {
          upsert: true,
        });
      }
    }
  }
}

// getTransactions retrieves all transactions for a given budget and updates the database
export async function getTransactions(ynabAPI, budgetID) {
  const Transaction = mongoose.model("Transaction", db.schema);
  let serverKnowledge = 0;
  let transactions = [];

  // Get transactions from collection
  const storedTransactions = await Transaction.find({
    budget_id: budgetID,
  }).exec();

  // Set server knowledge to lowest saved value
  if (storedTransactions.length > 0) {
    const leastServerKnowledge = storedTransactions.reduce((prev, curr) => {
      return prev.server_knowledge < curr.server_knowledge ? prev : curr;
    });
    serverKnowledge = leastServerKnowledge.server_knowledge;
  }

  // Get transactions from YNAB
  const resp = await ynabAPI.transactions.getTransactions(
    budgetID,
    "1970-01-01",
    null,
    serverKnowledge
  );

  if (resp.data.server_knowledge === serverKnowledge) {
    // If server knowledge is the same, do nothing
    transactions = storedTransactions;
  } else if (
    resp.data.transactions.length === 0 &&
    resp.data.server_knowledge > serverKnowledge
  ) {
    // If no new transactions are returned, update server knowledge in records
    transactions = storedTransactions;
    await Transaction.updateMany(
      {
        budget_id: budgetID,
        server_knowledge: { $lt: resp.data.server_knowledge },
      },
      { server_knowledge: resp.data.server_knowledge }
    );
  } else {
    // Add budget ID and server knowledge to YNAB response
    for (let transaction of resp.data.transactions) {
      let document = {
        budget_id: budgetID,
        data: transaction,
        server_knowledge: resp.data.server_knowledge,
      };
      transactions.push(document);
    }

    // Concatenate with stored transactions
    transactions = transactions.concat(storedTransactions);

    // Remove duplicate transactions with lower server knowledge
    transactions = utils.filterServerKnowledge(transactions);

    // Update/create/delete records
    for (let transaction of transactions) {
      transaction.server_knowledge = resp.data.server_knowledge;
      const filter = {
        budget_id: budgetID,
        "data.id": transaction.data.id,
      };

      if (transaction.data.deleted) {
        await Transaction.deleteOne(filter);
      } else {
        await Transaction.updateOne(filter, transaction, {
          upsert: true,
        });
      }
    }
  }
}

// updateTransactions updates transactions in YNAB and the database
export async function updateTransactions(ynabAPI, budgetID, transactions) {
  // Update transactions in YNAB
  const resp = await ynabAPI.transactions.updateTransactions(budgetID, {
    transactions: transactions,
  });

  // Update transactions in database
  const Transaction = mongoose.model("Transaction", db.schema);
  for (let transaction of resp.data.transactions) {
    // Filter for matching transaction ID
    const filter = {
      budget_id: budgetID,
      "data.id": transaction.id,
    };

    // Update records
    const storedTransaction = await Transaction.findOne(filter).exec();
    const document = {
      budget_id: budgetID,
      data: transaction,
      server_knowledge: storedTransaction.server_knowledge,
    };

    await Transaction.updateOne(filter, document, {
      upsert: true,
    });
  }
}
