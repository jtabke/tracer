# Workspace reference

Start with [Explore an example](getting-started.md#explore-an-example) or [Start your own project](getting-started.md#start-your-own-project). This reference covers additional editing, evidence, configurations and the retained Development map.

## Graph, Matrix and History

The normal launch opens **Graph**. Search for an artifact, use **Matrix** for title-first creation and direct connections, then edit a statement and open **History** to read its saved diff. **Explore potential impact** follows exact recorded paths; connectivity alone does not establish an assessed effect.

For a project without seeded evidence, open **Project tools → Evaluations → Record native-input receipt**. Choose the output, write the actual outcome and declare the exact input items and field scope. Historical native versions and configuration pins are available when needed. Record the receipt before changing an input, then return to that input and choose **Assess evidence**. Compare the captured and current values, select **Review receipt**, choose a decision and record its rationale. The receipt, freshness comparison and review remain separate facts.

**Project tools** also opens **Configure model**, **New item**, complete **Edit item and connections**, **Configurations**, and **Documentation**. Returning from a task retains its in-session draft. These tools use the selected database and existing version guards.

Reload recovers selection, graph positions, Matrix settings, revision and investigation scope in the same browser and origin. Use **Save Matrix configuration** for a named database-backed row-type/path/search recipe; loading one applies it across the project. Unsaved edits and review rationales are not recovered after reload or close: the browser warns, and reopening explains that policy. An unconfirmed save requires inspection and acknowledgment before new writes; it is never automatically resubmitted.

**Graph — investigate a change through its recorded dependency paths.**

![Tracer workbench Graph showing the changed Aster requirement, recorded dependency paths and artifact inspector.](images/aster-workbench-graph.png)

**Matrix — edit engineering information without leaving the traceability context.**

![Tracer workbench Matrix with grouped requirement-to-verification paths and a floating statement editor.](images/aster-workbench-matrix.png)

**History — inspect the saved change and connected engineering work.**

![Tracer workbench History showing the saved operating-temperature change at revision 400 and its field-level diff.](images/aster-workbench-history.png)

**Assessments — compare captured inputs and record an engineering decision.**

![Tracer workbench assessment showing captured versus current requirement statements and a recorded Needs reevaluation decision.](images/aster-workbench-assessment.png)

_Native-backed workbench at 1440×1000 using fictional Aster data. The walkthrough saves an edit at r400 and an immutable review; evaluation outcomes are explicitly simulated._

## Search, edit and connect

Open **Search** or press **Command/Control-K** to find an artifact by identifier, title or statement, or run a workspace command. Use Up/Down to move through suggestions and Enter to choose one; Escape closes search. Counts disclose matches beyond the displayed results.

![Aster search results for pressure, showing the matching artifact count, active suggestion and keyboard guidance.](images/aster-workbench-search.png)

Click a declared text field to edit it in the inspector. **Command/Control-Enter** saves the active editor; **Escape** cancels it. Saving or cancelling one inline field retains other unsaved field proposals in the same tab. **Unsaved changes** describes the proposal; a saved revision is confirmed only after the guarded write succeeds. Pending saves lock their controls, and conflicts retain the proposal for deliberate review.

![Aster statement editor with an unsaved field proposal, Save and Cancel controls, and keyboard help.](images/aster-workbench-editor.png)

Choose **Add relationship** in the inspector or **Connect** on the graph. The source uses an existing identifier. Search the target by identifier or title, then choose a compatible suggestion to supply its exact identifier. Review the selected target, relationship type and any required scope before **Connect**. **Cancel** closes the dialog without creating a relationship. Returning from relationship inspection or a dismissed dialog restores a usable focus target, including after resize.

![Aster connection dialog at 390 pixels wide, with exact source and target summaries, required scope, and Connect and Cancel actions.](images/aster-workbench-connection-mobile.png)

_These additional captures use a fresh fictional Aster project at r399. The statement is an unsaved proposal; the connection is prepared but has not been submitted. The phone capture is 390×844; desktop captures are 1440×1000._

## Use the retained Development map

The following map walkthrough uses **Project tools → Development map**. It retains the overview, Items table and guided connection controls; **Graph / Matrix / History** returns to the main workspace. Finish or deliberately discard unsaved drafts before changing workspaces.

## Follow a shared design

Choose **Orbit R1**, search `DES-01`, and open the matching result. The map follows the actual recorded relationships around the blower-control firmware design. Use **Levels** and **Trace direction** to adjust context, or **Follow connections** to walk one native link at a time. **← Data model** returns to the overview. **Frame all** changes the camera; it does not change scope or evidence.

Choose **Items table** to read the same scope as rows. Select an item for its full statement and immediate connections. **Graph** returns to the map. A shared item retains one native identity, even when several requirements refer to it.

In Aster, search `PRS-01` to follow a product requirement into its subsystem allocations and verification plan. Allowed schema routes and recorded links remain distinct; a plan is not an executed test result.

## Make and retain an edit

Select an item and choose **Edit item and connections**. Click a displayed field or choose **Edit item** for the complete form. **Save item** checks the captured version. **Cancel** discards that editor's local proposal; rejected saves retain it. Review current versions deliberately after a conflict.

**Return to map** or Escape hides the task while keeping its in-session draft. Open the same task to resume. Choosing another item with a dirty editor requires an explicit discard decision. Reloading the browser does not preserve an unsaved draft.

The task's connection controls create native typed directed links with captured endpoint/schema guards. A saved connection is trace information, not approval or proof of satisfaction.

## Create records and configure the model

Use **Configure model** to define item types, typed fields and allowed relationships. The [custom model exercise](custom-model.md) walks through defining a vocabulary from scratch. The existing Visual/Text proposal editor retains its schema-version checks and conflict recovery. On a new project, choose a starter or define your own model. **New item** creates a native record using that project's actual fields; optional keys remain optional. A model change retains a creation proposal and requires explicit adoption before saving.

## Import existing CSV data

Use **Project tools → Import CSV** after saving a model. Map record fields and key-based links, inspect errors and ignored columns, then commit the entire file together. See the [CSV import guide](csv-import.md) for record/link modes, formats, limits and concurrency behavior.

## Export project records and evidence references

Use **Project tools → Export project** to prepare and download one consistent snapshot with exact current/historical versions, original provenance, recorded evidence and captures. The prepared file stays fixed until you prepare again. External content must be preserved separately. See the [export guide](project-export.md) for the format, CLI/API access and bounds.

## Choose the next piece of work

Open **Next work** from the workspace header or Project tools. Statement, allocation, verification-plan, evidence-drift and review queues have separate counts and direct actions. Return from editing/review refreshes the list while retaining in-session drafts. The [next-work guide](next-work.md) explains queue definitions, model choices and why a review decision does not clear input changes.

## Review evidence and change

Open **Evaluations**, choose a receipt, and compare its captured/current declared inputs. Orbit's `EVAL-R02` predates a change to `DES-01`. The recorded outcome stays unchanged while input freshness shows the difference. Freshness, technical outcome and missing execution evidence are different questions.

Record a native-input receipt, observe an external artifact or record a scoped review through the existing evidence controls. Unknown save outcomes pause further saves and offer **Refresh saved records**; inspect the result before explicitly continuing. A lost response is not evidence that nothing saved.

## Inspect a build

Open **Configurations** to read or capture exact native member revisions. Orbit includes `BUILD-R01 · selected native inputs`, which captures older firmware while the current design identity has moved forward. Captures are immutable selected sets, not proof of a complete BOM or release readiness.

## Organize and return

Expand a type on the **Development map**, open a folder where one has been explicitly authored in this session, or use **Browse folders**. Categories narrow records across types. Unassigned records remain directly discoverable; no folder hierarchy is inferred from an engineering trace.

Folder/category edits, their Undo operation and map **Save view** recipes are session-only. They do not change native engineering identities/links and are discarded on reload or project switching. The headless API/CLI's existing saved-view contracts are separate from these map recipes. Durable map organization is not delivered by this integration.

## Open multiple projects

Supply the databases explicitly to add a second project to the picker:

```sh
npm start -- --db first/project.sqlite --secondary-db second/project.sqlite
```

Optional `--guide` and `--secondary-guide` arguments attach example guides. The databases must be different. Switching projects confirms draft disposal and reloads against the selected database; records and browser recovery stay project-specific. Use the printed **Resume saved setup** command to reopen the configured projects. See [realistic examples](realistic-examples.md) for seeding and resuming example databases.
