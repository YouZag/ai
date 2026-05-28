# Firestore

- Every document/collection shape has a TypeScript `interface`.
- All interfaces and types live in the root `interfaces/` directory, imported via the `@interfaces` alias — this is the one and only place for them. Never declare shared shapes anywhere else.
- Always access Firestore through a typed `withConverter()` (`FirestoreDataConverter`) — client (`firebase`) and server (`firebase-admin`) alike. No untyped `doc()` / `collection()` reads or writes.
