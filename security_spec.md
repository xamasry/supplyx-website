# Security Specification - SupplyX

## Data Invariants
1. A Request must have a valid buyerId matching the authenticated user during creation.
2. An Offer can only be managed (update/delete) by its supplier.
3. A Bid must be linked to a valid Request.
4. Notifications are private to the recipient.
5. User profile updates are restricted to the owner or admins.
6. Requests created from offers must include the correct supplierId and price.

## The "Dirty Dozen" Payloads (Deny List)
1. Creating a request with another user's `buyerId`.
2. Updating a request's `buyerId` (immutability).
3. Deleting a request that is not 'active'.
4. Creating a bid with a negative price.
5. Updating another supplier's bid.
6. Reading private user profile fields of another user.
7. Creating a notification for another user as a non-system/admin.
8. Updating an offer's `supplierId`.
9. Injecting a 2MB string into `productName`.
10. Setting a request status to 'delivered' as a buyer without supplier confirmation (if enforced).
11. Reading the list of all bids across all requests.
12. Creating a request with a future `createdAt` timestamp.

## Test Runner Plan
- Verify `create` on `/requests` fails if `buyerId != auth.uid`.
- Verify `update` on `/offers` fails if `auth.uid != supplierId`.
- Verify `read` on `/notifications` fails if `auth.uid != notification.userId`.
