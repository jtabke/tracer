# Getting started with Tracer

Choose one path: [Explore an example](#explore-an-example) with populated records, or [Start your own project](#start-your-own-project) with the editable Engineering starter.

Both use the same Graph / Matrix / History workspace. From the repository root, use Node.js **24.15+** and install dependencies once:

```sh
npm ci
```

## Explore an example

```sh
npm run demo
```

Open the printed URL. It opens **Orbit R1**, a fictional robot-vacuum project with requirements, shared designs and simulated evaluation results.

1. In **Graph**, search `DES-01` and select the blower-control firmware design. Read its statement and recorded connections in the inspector.
2. Switch to **Matrix** to inspect the selected scope as an aligned trace. Graph and Matrix use the same saved records and relationships.
3. Edit a statement, save it, and open **History** to inspect the recorded change. **Explore potential impact** follows recorded paths; a connection alone does not establish an assessed effect.
4. Open **Project settings → Advanced → Evaluation records** and inspect `EVAL-R02`. It captured an earlier version of `DES-01`; its simulated outcome remains unchanged while input freshness shows the difference. A changed input, a failed result and a review decision are separate facts.
5. Stop the server with Ctrl+C. To continue your edits, use the printed **Resume saved setup** command. Running `npm run demo` again creates a fresh example database.

All example targets and results are invented. Saved edits remain in the printed database. Unsaved drafts do not survive closing or reloading; finish or discard them before leaving.

## Start your own project

Use the [primitive guide](workspace-guide.md#primitives-what-to-create-and-when) to decide what belongs in a record, when to reference supporting material, and how to capture a result separately from a plan.

Begin by checking what your development model needs to represent: one real outcome, the behavior that supports it, the design/components and how you will check them. The starter below is an editable starting point. Use **Model** in the workspace navigation to inspect the type-level model on its dedicated page; Search / ⌘K also opens the same page.

Use a stable database file for your own work:

```sh
npm start -- --db co2-monitor.sqlite
```

1. Open **Model** and choose **Engineering** under **Starter structure**. It provides intents, requirements, designs and test plans. Requirements include optional acceptance criteria; tests include method and expected result. Optional subsystem/build fields are text references you define.
2. Leave **Save 3 starter Matrix views with this model** checked, then **Save model**. The model, four structural coverage policies and named recipes save together. The confirmation identifies the saved version and views. You can customize every definition; uncheck starter views if your revised types/paths no longer match them.
3. Choose **Return to map**. The empty project opens **Requirements → design → verification** as a project-wide Matrix. Choose **New requirement**, enter a title such as “CO₂ measurement range,” and press Enter. Inspect it to add the statement and measurable acceptance criterion, such as “Within ±50 ppm from 400 to 5000 ppm in the planned simulated fixture.” This is a criterion, not a test result.
4. Use **Link design → Create design** in that row to record the sensor/firmware design. Basic linking does not require review metadata. To author the plan, choose **Create record → test**, enter its title, **method**, **expected_result** and optional build reference, and save. Return to Matrix and choose that plan under **Link test** in the design column.
5. Use **Saved configurations** to switch to **Requirement acceptance → verification** and link the same plan directly to the requirement whose criteria it evaluates. **Requirements → intent** connects the requirement to an intent you author. These direct links serve different structural policies; design-to-test reachability alone does not fill the requirement-to-plan expectation. A test plan is not an execution result; record actual or clearly labeled simulated outcomes separately under **Evaluations**.
6. Close the server with Ctrl+C and use the printed **Resume saved setup** command to reopen it. The same SQLite file retains model edits, records, links, policies and all named Matrix views. Nothing is reseeded. In a clean browser, choose **Matrix → Saved configurations** to load the trace. Selection and graph positions recover only in the same browser/origin; unsaved edits are not retained after closing or reloading.

See [local operation and recovery](local-operation.md) for build-once starts, explicit database paths, online backups, upgrades and uncertain-save handling.

The Engineering starter is a starting model, not an imposed approval workflow. Coverage policies check recorded connections; neither a link nor a covered row proves that a requirement passed verification. Reopening an existing project does not replace its customized model. Use the [workspace reference](workspace-guide.md) when you need more detail on editing, evidence and configurations.
