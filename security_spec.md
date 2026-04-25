# Security Specification for Tawredat App

## Data Invariants
- A `Request` must have a valid `buyerId` matching the authenticated user.
- A `Bid` must reference a valid `requestId` and have a `supplierId` matching the authenticated user.
- Only the `buyer` who created a request can update its status to 'completed' or 'cancelled'.
- Only the `supplier` who created a bid can update its price or details.
- Only the `buyer` who owns the request can change a bid status to 'accepted'.

## The Dirty Dozen Payloads
1. Create a request with someone else's `buyerId`. (Denied)
2. Create a request with an invalid status (e.g., 'admin'). (Denied)
3. Create a request with a huge product name (resource exhaustion). (Denied)
4. Update a request owned by another user. (Denied)
5. Create a bid for a non-existent request. (Denied)
6. Create a bid with a negative price. (Denied)
7. Create a bid with someone else's `supplierId`. (Denied)
8. Update a bid status to 'accepted' as a supplier (privilege escalation). (Denied)
9. List all requests without being logged in. (Denied)
10. Update the `createdAt` timestamp of a request. (Denied)
11. Inject non-string product names. (Denied)
12. Delete a request (not allowed by rules). (Denied)
