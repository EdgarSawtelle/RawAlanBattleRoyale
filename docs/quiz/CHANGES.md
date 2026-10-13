# Fact-check changes

Only the questions that were fixed or replaced in the second-pass check.

# Check 1 - fixed and replaced items

## a-006 (fixed)

**Before**

```
You add rows to a PivotTable's source data. What must you do to see them?
  [*] Refresh the PivotTable
  [ ] Nothing, it always updates instantly
  [ ] Re-sort the source data by date
  [ ] Rebuild the PivotTable on a new sheet
```

**After**

```
A PivotTable is based on an Excel table. You add rows to the table. What must you do to see them?
  [*] Refresh the PivotTable
  [ ] Nothing, it always updates instantly
  [ ] Re-sort the source data by date
  [ ] Rebuild the PivotTable on a new sheet
```

**Reason:** Question now says the source is an Excel table. Originally "source data" was ambiguous: with a plain range, a refresh alone does not include rows added outside the range.

**Source:** https://support.microsoft.com/en-us/office/create-a-pivottable-to-analyze-worksheet-data-a9a84538-bfe9-40a9-a8e9-f99134456576

## a-009 (fixed)

**Before**

```
In Excel, what is a workbook connection?
  [ ] A hidden worksheet that holds imported data
  [ ] A formula link between two worksheets
  [ ] A named range pointing at a table
  [*] Saved details for reaching and refreshing external data
```

**After**

```
In Excel, what is a workbook connection?
  [ ] A hidden worksheet that holds imported data
  [ ] A formula link between two worksheets
  [ ] A named range pointing at a table
  [*] Stored info Excel uses to find and access external data
```

**Reason:** Correct answer reworded to match the doc definition (information describing how to locate, log in to, query and access an external source). Old wording "reaching and refreshing" was looser. Source changed to the page that defines it.

**Source:** https://support.microsoft.com/en-us/excel/create-edit-and-manage-connections-to-external-data

## a-012 (replaced)

**Before**

```
What is a key difference between Power Query and worksheet formulas?
  [ ] Power Query cannot connect to databases or files
  [ ] Worksheet formulas keep a step-by-step history
  [*] Power Query records steps once and re-runs them on refresh
  [ ] Power Query recalculates live as you type in cells
```

**After**

```
How does the Power Query editor let you apply a transformation?
  [ ] Write each step in M code by hand
  [ ] Type a worksheet formula into every cell
  [*] Pick it from ribbons and menus; no code is required
  [ ] Record a VBA macro, then run it on the data
```

**Reason:** Old item ("records steps once and re-runs them on refresh") was not a clean contrast with formulas, which also recalculate, and the docs never make that comparison. New item uses an explicit doc statement: PQ works through ribbons and menus without code.

**Source:** https://learn.microsoft.com/en-us/power-query/power-query-what-is-power-query

## a-016 (fixed)

**Before**

```
What does a 'connection only' query do in Excel?
  [ ] Loads only the first 1,000 rows
  [ ] Deletes itself after one refresh
  [ ] Locks the query so it cannot be edited
  [*] Keeps the query available without putting data on a sheet
```

**After**

```
What does the Only Create Connection load option do in Excel?
  [ ] Loads only the first 1,000 rows
  [ ] Deletes itself after one refresh
  [ ] Locks the query so it cannot be edited
  [*] Stores the connection in the workbook for later use
```

**Reason:** Question now names the exact Import Data option and the answer follows the doc wording ("store the selected connection in the workbook for later use"). The old phrasing was an inference not stated on the page.

**Source:** https://support.microsoft.com/en-us/office/import-data-dialog-box-e8a1eb00-73b8-4d5c-9249-6cf718c7cd6a

## a-017 (replaced)

**Before**

```
Why load a helper query, such as a parameter value, as connection only?
  [ ] It makes the helper refresh faster than any other query
  [*] Other queries can use it without extra data on a sheet
  [ ] Excel refuses to load single values to a sheet
  [ ] It lets the helper skip credential prompts
```

**After**

```
In the Power Query editor, which option do you clear so a helper query does not load its output?
  [ ] Use original column name as prefix
  [*] Enable load
  [ ] Use fuzzy matching to perform the merge
  [ ] Skip files with errors
```

**Reason:** Old question depended on an inferred benefit of connection-only loading that no official page states. New question uses the doc step: clear the Enable load option to disable a query's load.

**Source:** https://learn.microsoft.com/en-us/power-query/power-query-ui

## a-021 (replaced)

**Before**

```
Row 1 holds column names and other rows hold numbers. Which step order is safest?
  [ ] Set data types first, then promote headers
  [ ] Order never affects the result
  [*] Promote headers first, then set data types
  [ ] Merge queries first, then promote headers
```

**After**

```
For CSV or text sources, which two steps does automatic type detection add?
  [ ] Remove duplicates and Sorted rows
  [ ] Filtered rows and Renamed columns
  [*] Promote column headers and Changed type
  [ ] Merged queries and Grouped rows
```

**Reason:** Old item (promote headers before setting types is "safest") is sensible but no official page states a rule on ordering. New item uses the doc statement that detection adds Promote column headers and Changed type.

**Source:** https://learn.microsoft.com/en-us/power-query/data-types

## a-026 (fixed)

**Before**

```
Which join kind keeps every left-table row plus matching right-table rows?
  [ ] Inner
  [*] Left outer
  [ ] Full outer
  [ ] Left anti
```

**After**

```
Which join kind keeps all left rows but only matching right rows?
  [ ] Inner
  [*] Left outer
  [ ] Full outer
  [ ] Left anti
```

**Reason:** Old wording "every left-table row plus matching right-table rows" also describes Full outer, which keeps those and unmatched right rows too. Added "only" to make Left outer the sole fit.

**Source:** https://learn.microsoft.com/en-us/power-query/merge-queries-overview

## a-029 (fixed)

**Before**

```
Why does query folding usually make refreshes faster?
  [ ] It skips credential checks
  [*] The source does the work, so less data reaches Power Query
  [ ] It caches the results on disk forever
  [ ] It converts all columns to text
```

**After**

```
Why does query folding usually make refreshes faster?
  [ ] It skips credential checks
  [*] The data source does the work instead of Power Query
  [ ] It caches the results on disk forever
  [ ] It converts all columns to text
```

**Reason:** Correct answer reworded to what the doc states (processing is pushed to the source, often faster than extracting all data and transforming it in the engine). Removed the unstated "less data reaches" claim.

**Source:** https://learn.microsoft.com/en-us/power-query/query-folding-basics

## a-032 (fixed)

**Before**

```
Which Excel path starts loading data from a web address?
  [*] Data > Get Data > From Other Sources > From Web
  [ ] Data > Get Data > From File > From Workbook
  [ ] Insert > Links > Link
  [ ] Data > Data Tools > Text to Columns
```

**After**

```
In Excel's Data ribbon, which command loads data from a web page address?
  [*] From Web
  [ ] From Text/CSV
  [ ] From Table/Range
  [ ] Queries & Connections
```

**Reason:** Replaced the long menu path (not stated on the page) with the doc wording: "From Web in the Data ribbon in Excel". Distractors are other real Data ribbon commands.

**Source:** https://learn.microsoft.com/en-us/power-query/connectors/web/web

## a-045 (fixed)

**Before**

```
Which Power BI component is used mainly to model data and build reports?
  [ ] Power BI Mobile app
  [ ] Power BI service
  [*] Power BI Desktop
  [ ] Power BI Report Server
```

**After**

```
Which Power BI component is best suited to data modeling and report creation?
  [ ] Power BI Mobile app
  [ ] Power BI service
  [*] Power BI Desktop
  [ ] Power BI Report Server
```

**Reason:** Reworded to the doc statement ("Desktop is best for data modeling and report creation") because the service can also edit models and reports, which made "mainly" arguable.

**Source:** https://learn.microsoft.com/en-us/power-bi/fundamentals/power-bi-overview

## a-046 (fixed)

**Before**

```
In Power BI, what is an app?
  [ ] The Windows program used to build reports
  [*] Dashboards and reports bundled from a workspace for users
  [ ] A custom visual from the marketplace
  [ ] A saved Power Query connector
```

**After**

```
In Power BI, what is a workspace app?
  [ ] The Windows program used to build reports
  [*] Content from a workspace packaged and shared with users
  [ ] A custom visual from the marketplace
  [ ] A saved Power Query connector
```

**Reason:** Question now uses the current name "workspace app" (formerly Power BI app) because "app" alone is ambiguous with Desktop, the mobile app and org apps.

**Source:** https://learn.microsoft.com/en-us/power-bi/explore-reports/end-user-apps

## a-047 (fixed)

**Before**

```
What is a Power BI semantic model?
  [ ] A single report page with its visuals
  [ ] A saved gateway connection
  [ ] A list of DAX queries that were run
  [*] A data model of tables, relationships and calculations
```

**After**

```
What is a Power BI semantic model?
  [ ] A single report page with its visuals
  [ ] A saved gateway connection
  [ ] A list of DAX queries that were run
  [*] A data model that is ready for reporting and visualization
```

**Reason:** Correct answer reworded to the doc definition ("a source of data ready for reporting and visualization", based on Analysis Services data models) instead of an unstated list of contents.

**Source:** https://learn.microsoft.com/en-us/power-bi/connect-data/service-datasets-understand

## a-056 (fixed)

**Before**

```
When are a calculated column's values computed and stored?
  [ ] For each cell in a visual, never stored
  [ ] Only when a report page is opened
  [ ] In the data source before loading
  [*] At data refresh, stored in the model
```

**After**

```
When are a calculated column's values computed and stored?
  [ ] For each cell in a visual, never stored
  [ ] Only when a report page is opened
  [ ] In the data source before loading
  [*] When created and on data refresh; stored in the model
```

**Reason:** Answer now says values are computed when the column is created and again on refresh. Old "at data refresh" omitted that they are calculated as soon as the formula is entered.

**Source:** https://learn.microsoft.com/en-us/dax/dax-overview

## a-072 (fixed)

**Before**

```
Dates like 22/03/2025 turn into errors when set to Date. What fixes this?
  [ ] Set the type to Any
  [*] Change type using a locale such as English (UK)
  [ ] Change the type to Duration
  [ ] Sort the column ascending first
```

**After**

```
With a US locale, dates like 22/03/2025 error when set to Date. What fixes this?
  [ ] Set the type to Any
  [*] Change type using a locale such as English (UK)
  [ ] Change the type to Duration
  [ ] Sort the column ascending first
```

**Reason:** Added the US locale cause stated in the doc. Without it "Any" looked like a way to avoid errors and the question was open to argument.

**Source:** https://learn.microsoft.com/en-us/power-query/data-types



---

# check-2 log: fixed and replaced items

## b-004 - fixed

- **Before:** Which need points to Dataverse rather than a SharePoint list as the app data source?
  - Answers: A simple one-table tracker for a small team | **Relational tables with role-based, row-level security** (correct) | Data that users already maintain in SharePoint | Avoiding any extra licensing cost
- **After:** Which need points to Dataverse rather than a SharePoint list as the data source?
  - Answers: A simple one-table tracker for a small team | **Relational tables with field-level security** (correct) | Data that users already maintain in SharePoint | Sharing a simple checklist with a few colleagues
- **Reason:** Correct answer reworded from "role-based, row-level security" (SharePoint also has item-level permissions, and the page does not state row-level) to field-level security, which the page lists only for Dataverse; replaced the "no extra licensing cost" distractor, which the page does not cover.
- **Source:** https://learn.microsoft.com/en-us/power-apps/teams/compare-data-sources

## b-006 - replaced

- **Before:** In Power Apps, what is an input control used for?
  - Answers: Showing read-only text, like a Label | Repeating a template per record, like a Gallery | Running a formula on a timer, like a Timer | **Letting users enter or pick a value, like Text input** (correct)
- **After:** What is the Text input control used for?
  - Answers: Showing a chart of values from a data source | Repeating a template once per record | Running a formula on a timer | **Letting users type text, numbers, and other data** (correct)
- **Reason:** The docs do not define "input control" as a category, so the old question was not stated on its source page. Replaced with the Text input control, whose purpose the control page states explicitly.
- **Source:** https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-text-input

## b-030 - fixed

- **Before:** Inside a gallery template, what does ThisItem refer to?
  - Answers: The record the user selected last | The first record of the data source | The gallery control itself | **The record shown in the current row** (correct)
- **After:** Inside a gallery template, what does ThisItem refer to?
  - Answers: The record the user selected last | The first record of the data source | The gallery control itself | **The record shown in the current gallery item** (correct)
- **Reason:** Answer reworded from "current row" to "current gallery item" (galleries can lay out items in columns or wraps); source changed to the operators page, which actually states the ThisItem definition (the gallery page does not).
- **Source:** https://learn.microsoft.com/en-us/power-platform/power-fx/reference/operators

## b-043 - fixed

- **Before:** Which formula shows a green success banner to the user?
  - Answers: **Notify("Saved", NotificationType.Success)** (correct) | Notify("Saved", Success) | Notify(NotificationType.Success) | Notify("Saved", Color.Green)
- **After:** Which formula shows a success message banner to the user?
  - Answers: **Notify("Saved", NotificationType.Success)** (correct) | Notify("Saved", Success) | Notify(NotificationType.Success) | Notify("Saved", Color.Green)
- **Reason:** Dropped "green" from the question because the docs do not state a banner colour, only that colour and icon depend on the NotificationType.
- **Source:** https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-showerror

## b-053 - fixed

- **Before:** Which trigger must a child flow start with?
  - Answers: Recurrence | **Manually trigger a flow** (correct) | When an item is created | The Power Apps trigger
- **After:** Which trigger must a child flow start with?
  - Answers: Recurrence | **Manually trigger a flow** (correct) | When an item is created | When a new email arrives (V3)
- **Reason:** Replaced the distractor "The Power Apps trigger" (also an instant trigger, so arguably confusable) with "When a new email arrives (V3)", an event trigger that is clearly wrong.
- **Source:** https://learn.microsoft.com/en-us/power-automate/create-child-flows

## b-059 - replaced

- **Before:** Why use a non-personal service account for a flow's connections?
  - Answers: It removes the need for any license | It makes the flow run faster | **The flow keeps running when an individual leaves** (correct) | It lets the flow skip data policies
- **After:** Why make a service principal, not a person, the owner of a critical flow?
  - Answers: The flow can skip data loss prevention policies | The flow runs faster than user-owned flows | **The flow keeps running when an employee leaves** (correct) | Human approval steps become simpler
- **Reason:** The old question used the phrase "non-personal service account", which the docs do not use, and the benefit was not stated for it. Replaced with the documented service principal (SPN) ownership guidance: SPN-owned flows are not tied to individuals.
- **Source:** https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/understand-access-to-flows

## b-064 - replaced

- **Before:** Which approach best avoids nested loops hurting performance?
  - Answers: Add a Delay action inside the inner loop | **Reduce the array first with a filter, then loop once** (correct) | Turn on Secure inputs on the loop | Put the inner loop inside a Compose
- **After:** Which fix does Microsoft give for a nested Apply to each over related Dataverse rows?
  - Answers: Add a Delay action inside the inner loop | **Use OData query expansion with a single For each** (correct) | Turn on Secure inputs on the loop | Put the inner loop inside a Compose
- **Reason:** The old correct answer (filter the array, then loop once) is not stated on the cited page. Replaced with the fix the anti-patterns page explicitly gives: OData query expansion with a single For each.
- **Source:** https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/avoid-anti-patterns


---

# Check 3 log: fixed and replaced items

## b-074 (fixed)

- Before: Q: What do environment variables let you do when moving a solution?
  Answers: [*] Use different parameter values in each environment | [ ] Store user passwords inside the solution | [ ] Skip solution checks during import | [ ] Share one run history across environments
- After: Q: What do environment variables let you do when moving a solution?
  Answers: [*] Use different parameter values in each environment | [ ] Make a managed solution editable in Prod | [ ] Skip solution checks during import | [ ] Share one run history across environments
- Reason: Replaced the distractor "Store user passwords inside the solution": environment variables can carry secrets (Key Vault references), so it was arguably partly true. New distractor: "Make a managed solution editable in Prod" (clearly false).
- Source: https://learn.microsoft.com/en-us/power-apps/maker/data-platform/environmentvariables

## b-076 (fixed)

- Before: Q: Which Get items setting lets a flow return more than the default page of items?
  Answers: [ ] Concurrency control | [*] Pagination with a threshold | [ ] Trigger conditions | [ ] Retry policy
- After: Q: Which Get items setting must be on to read more than 5,000 items from a list?
  Answers: [ ] Concurrency control | [*] Pagination | [ ] Trigger conditions | [ ] Retry policy
- Reason: Reworded the question around a documented fact: the docs say to enable Pagination in the Get items settings for lists above 5,000 items. The old "default page ... Pagination with a threshold" wording leaned on a Q&A thread, not the docs. Answer text shortened to "Pagination".
- Source: https://learn.microsoft.com/en-us/sharepoint/dev/business-apps/power-automate/guidance/working-with-get-items-and-get-files

## b-077 (fixed)

- Before: Q: What is the maximum paginated item count for most Power Automate plans?
  Answers: [ ] 10,000 | [*] 100,000 | [ ] 1,000 | [ ] 1,000,000
- After: Q: What is the paginated items limit for flows outside the Low performance profile?
  Answers: [ ] 10,000 | [*] 100,000 | [ ] 1,000 | [ ] 1,000,000
- Reason: The doc says 5,000 for Low and 100,000 for all others; Low includes Free, Microsoft 365 and trial plans, so "most Power Automate plans" was inaccurate. Question now names the performance profile.
- Source: https://learn.microsoft.com/en-us/power-automate/limits-and-config

## b-085 (fixed)

- Before: Q: What is a SharePoint list?
  Answers: [ ] A library for storing documents and folders | [ ] A page for publishing news posts | [*] A collection of data items stored in rows and columns | [ ] A chat channel for a team
- After: Q: What is a SharePoint list?
  Answers: [ ] A library for storing documents and folders | [ ] A page for publishing news posts | [*] A shareable collection of data organized in columns | [ ] A chat channel for a team
- Reason: Aligned the correct answer with the doc wording ("collection of data ... add columns") instead of "rows and columns", which the page does not state.
- Source: https://support.microsoft.com/en-us/sharepoint/lists/data-and-lists/what-is-a-list-in-microsoft-365

## b-086 (fixed)

- Before: Q: Which data source offers roles and field-level security for app data?
  Answers: [*] Dataverse | [ ] A SharePoint list | [ ] An Excel workbook | [ ] A collection
- After: Q: Which data source supports business units and field-level security?
  Answers: [*] Dataverse | [ ] A SharePoint list | [ ] An Excel workbook | [ ] A collection
- Reason: Original asked for "roles and field-level security", but SharePoint lists also have roles (Owners, Members, Visitors). Reworded to "business units and field-level security", which only Dataverse offers in the comparison table.
- Source: https://learn.microsoft.com/en-us/power-apps/teams/compare-data-sources

## b-093 (fixed)

- Before: Q: Which approach can refresh a date-based calculated column each day?
  Answers: [ ] Turning on versioning for the list | [ ] Setting the column as indexed | [ ] Using [Today] inside the column formula | [*] A scheduled flow that updates the items
- After: Q: TODAY in a calculated column is a snapshot. What keeps date logic current?
  Answers: [ ] Turning on versioning for the list | [ ] Setting the column as indexed | [ ] Using [Today] inside the column formula | [*] A daily flow that writes today's date to a column
- Reason: Old question presented a scheduled flow as a way to "refresh" the calculated column itself. Reworded to match the Microsoft Q&A answer: a daily flow updates a custom Date column that date logic uses. Distractors unchanged.
- Source: https://learn.microsoft.com/en-us/answers/questions/5381956/use-today()-function-in-sharepoint-list

## b-098 (fixed)

- Before: Q: Which statement about the Title column of a SharePoint list is correct?
  Answers: [*] It is built in, required by default and cannot be deleted | [ ] It can be deleted once an app uses the list | [ ] It is added only when a Person column exists | [ ] It is created only for lists built from Excel
- After: Q: Which statement about the Title column of a SharePoint list is correct?
  Answers: [*] It is built in and cannot be deleted | [ ] It can be deleted once an app uses the list | [ ] It is added only when a Person column exists | [ ] It is created only for lists built from Excel
- Reason: Dropped "required by default" from the correct answer: the cited page only says Title is a required column that cannot be deleted, and the Title requirement can be changed in column settings. Answer now says "built in and cannot be deleted".
- Source: https://support.microsoft.com/en-us/office/delete-a-column-in-a-list-or-library-72cfd78d-dcca-4fa6-b499-c89214917604

## b-101 (replaced)

- Before: Q: Why can a required list column cause trouble for apps and flows?
  Answers: [ ] It stops the column from being indexed | [*] Every writer must send a value or its save fails | [ ] It makes the whole list read-only | [ ] It hides the column in all views
- After: Q: When a flow inserts or updates an item, which columns must it provide data for?
  Answers: [ ] Every column in the list | [*] All required columns | [ ] Only the first three columns | [ ] Only columns changed since the last run
- Reason: Old item asked "why can a required column cause trouble", which is opinion and its cited page (create a column) never covers required columns. Replaced by a fact stated on the Power Automate "Filter and copy data" page: all required columns must be supplied on insert or update.
- Source: https://learn.microsoft.com/en-us/power-automate/odata-filters

## b-128 (fixed)

- Before: Q: Which approval type finishes as soon as any one approver responds?
  Answers: [ ] Approve/Reject - Everyone must approve | [ ] Custom Responses - Wait for all responses | [*] Approve/Reject - First to respond | [ ] Sequential approvals (one approver at a time)
- After: Q: Which approval type completes the request as soon as one approver approves?
  Answers: [ ] Approve/Reject - Everyone must approve | [ ] Custom Responses - Wait for all responses | [*] Approve/Reject - First to respond | [ ] Sequential approvals (one approver at a time)
- Reason: Original "finishes as soon as any one approver responds" was slightly loose because Everyone must approve also ends when any one approver rejects. Reworded to "as soon as one approver approves"; answers unchanged.
- Source: https://learn.microsoft.com/en-us/power-automate/get-started-approvals

