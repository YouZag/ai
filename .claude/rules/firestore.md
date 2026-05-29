# Firestore

- Every document/collection shape is a Zod schema, defined in the root `schemas/` directory and imported via the `@schemas` alias — the one and only place for shared shapes. Never declare shared shapes anywhere else.
- Give each shape its own file under `schemas/`, re-exported from `schemas/index.ts`. For each one:
  - Export the schema as `<Name>Schema` (e.g. `export const ErrorDocumentSchema = z.object({ ... })`).
  - Export its inferred type as `export type <Name> = z.infer<typeof <Name>Schema>`.
  - Import the type for annotations and the schema for validation; never hand-write a separate `interface` for a shape that has a schema.
- Validate at the Firestore boundary: a `FirestoreDataConverter`'s `fromFirestore` must return `<Name>Schema.parse(snapshot.data())` — never an `as` cast. `toFirestore` takes the typed value.
- Access Firestore only through a typed `withConverter()` (`FirestoreDataConverter`) — client (`firebase`) and server (`firebase-admin`) alike. No untyped `doc()` / `collection()` reads or writes.
