# UI ownership

The product has one default Atlas workbench and a retained Development map over the same headless contracts. Keep feature state and mutation authority with their current owners, not with directory-specific frameworks.

| Owner               | Responsibility                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `workbench/`        | Default shell, investigation/session state, Graph/Matrix/History and inspector bindings                             |
| `map/`              | Retained Development map and its view/session policies                                                              |
| `assessments/`      | Controlled assessment scope, candidate judgments, actions and context                                               |
| `verifications/`    | Verification basis, activities, result selection and conclusions                                                    |
| `configurations/`   | Exact capture, comparison, dependency investigation, native capture catalogue and handoff requests                  |
| `records/`          | Native record details/editing and typed object fields used by both shipped presentations                            |
| Shared root modules | Typed API/transport, mutation/read guards, common fields, schema editor, evidence/reference tasks and documentation |

`configurations/native-capture.tsx` preserves the existing native-only capture path; it is distinct from controlled topology/content capture. `records/fields.tsx` owns object field rendering; root `fields.tsx` still owns shared field controls/serialization. These are relocations of existing owners, not parallel state models or compatibility shims.

Production cannot import `test/`, studies or private development data. Browser tests target `dist/`; the [production-backed workbench harness](../test/workbench/README.md) only orchestrates disposable fixtures. See [architecture](../docs/architecture.md) and the [coverage map](../test/README.md).
