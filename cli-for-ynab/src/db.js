import mongoose from "mongoose";
import * as ynab from "./ynab.js";

export const schema = new mongoose.Schema({
  budget_id: String,
  data: Object,
  server_knowledge: Number,
});

// queryAccounts returns a list of accounts, optionally filtered
export async function queryAccounts(ynabAPI, budgetID, filter = {}) {
  const Account = mongoose.model("Account", schema);
  ynab.getAccounts(ynabAPI, budgetID);
  filter = { budget_id: budgetID, ...filter };
  return (await Account.find(filter)).map((account) => account.data);
}

// queryPayees returns a list of payees, optionally filtered
export async function queryPayees(ynabAPI, budgetID, filter = {}) {
  const Payee = mongoose.model("Payee", schema);
  ynab.getPayees(ynabAPI, budgetID);
  filter = { budget_id: budgetID, ...filter };
  return (await Payee.find(filter)).map((payee) => payee.data);
}

// queryTransactions returns a list of transactions, optionally filtered or scoped to an account
export async function queryTransactions(
  ynabAPI,
  budgetID,
  accountID = null,
  filter = {}
) {
  const Transaction = mongoose.model("Transaction", schema);
  ynab.getTransactions(ynabAPI, budgetID);

  const accountFilter =
    accountID === null ? {} : { "data.account_id": accountID };
  filter = { budget_id: budgetID, ...accountFilter, ...filter };

  return (await Transaction.find(filter)).map(
    (transaction) => transaction.data
  );
}
