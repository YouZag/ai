# Firestore

- Every document/collection shape has a TypeScript `interface`.
- Always access Firestore through a typed `withConverter()` (`FirestoreDataConverter`) — client (`firebase`) and server (`firebase-admin`) alike. No untyped `doc()` / `collection()` reads or writes.
