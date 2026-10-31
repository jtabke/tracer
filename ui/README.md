# UI ownership

The product has one default Atlas workbench and a retained Development map over the same headless contracts. Keep feature state and mutation authority with their current owners, not with directory-specific frameworks.

| Owner               | Responsibility                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `workbench/`        | Default shell, investigation/session state, Graph/Matrix/History and inspector bindings                                        |
| `map/`              | Retained Development map and its view/session policies                                                                         |
| `assessments/`      | Controlled assessment scope, candidate judgments, actions and context                                                          |
| `verifications/`    | Verification basis, activities, result selection and conclusions                                                               |
| `configurations/`   | Exact capture, comparison, dependency investigation, native capture catalogue and handoff requests                             |
| `records/`          | Native record details/editing and typed object fields used by both shipped presentations                                       |
| `evidence/`         | Receipt authoring, captured-input reading, external observations and applicability review                                      |
| `references/`       | Resource/reference drafts, editing, qualification and contextual reference reading                                             |
| Shared root modules | Typed API/transport, mutation/read guards, common fields, native revision/provenance controls, schema editor and documentation |

`configurations/native-capture.tsx` preserves the existing native-only capture path; it is distinct from controlled topology/content capture. `records/fields.tsx` owns object field rendering; root `fields.tsx` still owns shared field controls/serialization. These are relocations of existing owners, not parallel state models or compatibility shims.

Evidence and reference files retain their existing state owners and direct exports; there are no old-path forwarding modules or new folder-level state/barrels. `native-pin-provenance.tsx` and `native-revision-select.tsx` remain shared because configurations, evidence and engineering tasks use the same captured-native identity controls. Feature styles stay with their components. The retired Studio root selectors and read-only model-overview styles are removed; active native-task selectors keep their specificity and declarations.

Production cannot import `test/`, studies or private development data. Browser tests target `dist/`; the [production-backed workbench harness](../test/workbench/README.md) only orchestrates disposable fixtures. See [architecture](../docs/architecture.md) and the [coverage map](../test/README.md).
