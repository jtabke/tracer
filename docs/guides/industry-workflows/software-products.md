# Software product development

[Product development across industries](README.md)

GitLab's published workflow combines a validation track for uncertain problems and solutions with an ongoing build track. It is one concrete company practice. [GitLab product development flow](https://handbook.gitlab.com/handbook/product-development/how-we-work/product-development-flow/).

## Workflow and working artifacts

| Work                      | Example artifacts                             | Coordination question            |
| ------------------------- | --------------------------------------------- | -------------------------------- |
| Understand an opportunity | Observations, hypotheses and success measures | Is the problem worth addressing? |
| Explore a solution        | Prototypes, research and experiments          | Does the solution help?          |
| Break down delivery       | Features, issues and acceptance conditions    | What increment should be built?  |
| Implement and evaluate    | Changes, reviews and test results             | What behavior was checked?       |
| Release and learn         | Usage, feedback and follow-up issues          | Was the outcome achieved?        |

This table synthesizes GitLab's discovery, build and post-launch feedback activities. Its process includes revisiting results and further iteration after launch. [GitLab workflow](https://handbook.gitlab.com/handbook/product-development/how-we-work/product-development-flow/).

A product requirements document, or PRD, can provide a concise home for goals, assumptions, user stories, design links, open questions and scope. Atlassian describes a collaborative document that evolves with the work. That is one possible artifact structure; requirements can also be maintained in issues and other project records. [Atlassian PRD guidance](https://www.atlassian.com/agile/product-management/requirements).

Delivery relationships often cross tools. GitHub supports explicit links between issues and pull requests, including links that close an issue when the relevant pull request merges. That records a work relationship; assessing whether the change achieves the product outcome needs additional evidence. [GitHub issue and pull-request linking](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue).

## Illustrative trace model

**Outcome → opportunity → proposed solution → delivery item → implementation → evaluation → release observation → follow-up decision.**

There can also be a product hierarchy such as initiative → feature → story, and a separate architecture describing services, components and interfaces. Neither determines the entire other structure. An initiative may require several services; an infrastructure change may serve several features.

In the fictional [Gatherline seed](../realistic-examples.md#technology-gatherline), one synchronization worker supports scans, restart recovery, bookmarks and agenda refresh. A change to the supported offline retry window affects the check-in contract and prior evaluation evidence. Different features still need their own acceptance conditions; a connected test for one behavior does not establish all behavior that uses the worker.

## Product learning and implementation evidence

For exploration, distinguish three questions: whether users experience the problem, whether a proposed solution helps them, and whether an implementation behaves as intended. Unit or integration results can address implementation behavior; prototype observations and usage findings can address different parts of the product argument. Those records may disagree or leave questions unresolved.

Tracer should make those scopes understandable and preserve their links to decisions and versions. The current Gatherline seed emphasizes delivery and dependencies; its fictional incidents and simulated runs do not represent actual customer research, executed code or production outcomes.
