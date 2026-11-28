# Finance transaction management

The finance API records branch-owned income and expense transactions and provides a separate approval decision endpoint.

## Endpoints

All endpoints require a bearer access token and an active branch selected with `X-Branch-Id` when the caller has global access.

- `GET /finance` — list up to 200 transactions for the active branch. Optional filters: `status=PENDING|APPROVED|REJECTED` and `type=INCOME|EXPENSE`.
- `POST /finance` — record a transaction. Required fields: `type`, `category`, `amount`, and ISO `transactionDate`. Optional fields: `currency` (currently NGN only), `description`, and `reference`. The API derives the branch and recorder from the authenticated request; client-supplied IDs are ignored. New transactions are always PENDING.
- `GET /finance/:transactionId` — retrieve a transaction only when it belongs to the active branch.
- `POST /finance/:transactionId/decision` — approve or reject a pending transaction. Body: `{ "decision": "APPROVE" }` or `{ "decision": "REJECT", "reason": "..." }`.

## Permissions and controls

- `finance.record` is required to list, retrieve, and record transactions.
- `finance.approve` is required to decide a transaction.
- Every query is scoped to the authenticated active branch.
- A transaction recorder cannot approve their own transaction.
- Only PENDING transactions can be decided. The decision update is conditional on the pending state to prevent concurrent double decisions.
- Approver, decision timestamp, and rejection reason are stored with the transaction.
- Amounts use PostgreSQL `DECIMAL(12,2)`; the API accepts positive values with at most two decimal places.

The current API records NGN transactions only. It does not yet implement account reconciliation, budgets, cashbook exports, or financial reporting.
