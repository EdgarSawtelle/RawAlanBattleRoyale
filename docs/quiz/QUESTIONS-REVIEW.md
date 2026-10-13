# Quiz questions - review sheet

224 questions, each checked against the Microsoft page linked under it. The correct answer is in bold.
Tags: [added] = not from the roadmap, [fixed] / [replaced] = changed in the fact-check pass (details in CHANGES.md).

## Excel (21)

**1. Why is an Excel table a better PivotTable source than a plain range?** (a-001)
- **New rows are included when the PivotTable is refreshed** (correct)
- It stores the data in the cloud instead of the file
- It locks the data so nobody can edit it
- It converts every column to text automatically

Why: Rows added to an Excel table are picked up automatically when the PivotTable is refreshed; a plain range needs its source changed or a dynamic named range.
Source: https://support.microsoft.com/en-us/office/create-a-pivottable-to-analyze-worksheet-data-a9a84538-bfe9-40a9-a8e9-f99134456576

**2. Which Windows shortcut opens the Create Table dialog for the selected data?** (a-002)
- Ctrl+Alt+F5
- F4
- **Ctrl+T** (correct)
- Ctrl+;

Why: Ctrl+T opens the Create Table dialog. F4 cycles reference types, Ctrl+; enters today's date and Ctrl+Alt+F5 is Refresh All.
Source: https://support.microsoft.com/en-us/office/keyboard-shortcuts-in-excel-1798d9d5-842a-42b8-9c99-9b7213f0040f

**3. In an Excel table formula, what does [@Sales] refer to?** (a-003)
- The whole Sales column including its header
- A cell named Sales on another worksheet
- The Sales cell in the table's total row
- **The Sales value in the same row as the formula** (correct)

Why: @ is shorthand for #This Row, so [@Sales] means the Sales cell in the same row as the formula. The whole column would be [Sales].
Source: https://support.microsoft.com/en-us/office/using-structured-references-with-excel-tables-f5ed2452-2337-4f71-bed3-c8ae6d2b276e

**4. Which structured reference specifier means the whole table, including headers and totals?** (a-004)
- Table1[#Data]
- Table1[#Headers]
- Table1[#Totals]
- **Table1[#All]** (correct)

Why: [#All] covers headers, data and totals. [#Data] is only the data rows, [#Headers] only the header row, [#Totals] only the total row.
Source: https://support.microsoft.com/en-us/office/using-structured-references-with-excel-tables-f5ed2452-2337-4f71-bed3-c8ae6d2b276e

**5. What is a PivotTable mainly used for?** (a-005)
- Looking up one value by key from another table
- Restricting which values users can type in cells
- **Summarizing and analyzing data by arranging fields** (correct)
- Recording repeatable macro steps

Why: A PivotTable calculates, summarizes and analyzes data by letting you arrange fields. Looking up a value by key is a job for XLOOKUP or INDEX/MATCH.
Source: https://support.microsoft.com/en-us/office/create-a-pivottable-to-analyze-worksheet-data-a9a84538-bfe9-40a9-a8e9-f99134456576

**6. A PivotTable is based on an Excel table. You add rows to the table. What must you do to see them?** (a-006) [fixed]
- **Refresh the PivotTable** (correct)
- Nothing, it always updates instantly
- Re-sort the source data by date
- Rebuild the PivotTable on a new sheet

Why: Rows added to the source table are included when you refresh the PivotTable. Pivots do not update instantly. With a plain range, the source would also need changing.
Source: https://support.microsoft.com/en-us/office/create-a-pivottable-to-analyze-worksheet-data-a9a84538-bfe9-40a9-a8e9-f99134456576

**7. Which statement about XLOOKUP versus VLOOKUP is true?** (a-007)
- **It can return values from columns left of the lookup column** (correct)
- It only works if the data is sorted ascending
- It needs a column index number as an argument
- It defaults to an approximate match

Why: XLOOKUP takes separate lookup and return arrays, so the return column can be left of the lookup column. It defaults to exact match, needs no sorting and no column index.
Source: https://support.microsoft.com/en-us/office/xlookup-function-b7fd680e-6d10-43e6-84f9-88eae8bf5929

**8. In INDEX/MATCH, what does MATCH(25,A1:A3,0) return if A1:A3 holds 5, 25, 38?** (a-008)
- 25
- 3
- **2** (correct)
- #N/A

Why: MATCH returns the position of the match within the range, not the value. 25 is the 2nd item in 5, 25, 38, so MATCH(25,A1:A3,0) returns 2.
Source: https://support.microsoft.com/en-us/office/match-function-e8dffd45-c762-47d6-bf89-533f4a37673a

**9. In Excel, what is a workbook connection?** (a-009) [fixed]
- A hidden worksheet that holds imported data
- A formula link between two worksheets
- A named range pointing at a table
- **Stored info Excel uses to find and access external data** (correct)

Why: A connection is the stored set of information Excel uses to locate and access an external data source. It is not a worksheet, a formula link or a named range.
Source: https://support.microsoft.com/en-us/excel/create-edit-and-manage-connections-to-external-data

**10. Which VBA call refreshes all external data ranges and PivotTables in a workbook?** (a-036)
- Application.Calculate
- ThisWorkbook.Save
- Workbooks.Open
- **ThisWorkbook.RefreshAll** (correct)

Why: Workbook.RefreshAll refreshes all external data ranges and PivotTable reports in the workbook. Calculate only recalculates formulas.
Source: https://learn.microsoft.com/en-us/office/vba/api/excel.workbook.refreshall

**11. How do you make a worksheet shape run a macro when clicked?** (a-037)
- **Right-click it and choose Assign Macro** (correct)
- Name the shape after the macro
- Type the macro code into the shape's text
- Protect the sheet so shapes act as buttons

Why: Right-click the shape, choose Assign Macro and pick the macro; clicking the shape then runs it.
Source: https://support.microsoft.com/en-us/office/run-a-macro-in-excel-5e855fd2-02d1-45f5-90a3-50e645fe3155

**12. Which Excel feature gives a cell a drop-down list of allowed values?** (a-038)
- Conditional Formatting
- Text to Columns
- **Data Validation set to List** (correct)
- Goal Seek

Why: Data Validation with Allow set to List gives a cell a drop-down of allowed values. Conditional Formatting only changes appearance.
Source: https://support.microsoft.com/en-us/office/apply-data-validation-to-cells-29fecbcc-d1b9-42c1-9d76-eff3ce5f7249

**13. Which VBA method shows an Open dialog and returns the file name without opening it?** (a-039)
- Workbooks.Open
- Application.GetSaveAsFilename
- Application.InputBox
- **Application.GetOpenFilename** (correct)

Why: Application.GetOpenFilename shows the Open dialog and returns the chosen file name without opening it. Workbooks.Open actually opens the file.
Source: https://learn.microsoft.com/en-us/office/vba/api/excel.application.getopenfilename

**14. What does Refresh All do that Refresh on one query does not?** (a-040)
- Recalculates every formula on every sheet
- Reloads the workbook from disk
- Updates only the active worksheet
- **Updates every connection and PivotTable in the workbook** (correct)

Why: Refresh updates the selected connection only. Refresh All updates all data in the workbook, including every connection and PivotTable.
Source: https://support.microsoft.com/en-us/office/refresh-an-external-data-connection-in-excel-1524175f-777a-48fc-8fc7-c8514b984440

**15. Which Windows shortcut runs Refresh All in Excel?** (a-041)
- F9
- Ctrl+T
- Shift+F9
- **Ctrl+Alt+F5** (correct)

Why: Ctrl+Alt+F5 is Refresh All. F9 calculates all open workbooks and Shift+F9 calculates the active sheet; neither refreshes external data.
Source: https://support.microsoft.com/en-us/office/keyboard-shortcuts-in-excel-1798d9d5-842a-42b8-9c99-9b7213f0040f

**16. Where do you make an Excel query refresh when the workbook opens?** (a-042)
- File > Options > Formulas > Calculation options
- **Connection Properties, Usage tab** (correct)
- Review > Protect Workbook
- Home > Conditional Formatting

Why: In Connection Properties, on the Usage tab, tick Refresh data when opening the file.
Source: https://support.microsoft.com/en-us/office/refresh-an-external-data-connection-in-excel-1524175f-777a-48fc-8fc7-c8514b984440

**17. What does Excel's UNIQUE function return?** (a-063) [added]
- Only values that appear more than once
- A count of the distinct values
- The first value of each column
- **The distinct values from a list or range** (correct)

Why: UNIQUE returns the distinct values of a list or range. Only with exactly_once=TRUE does it return values that appear exactly once.
Source: https://support.microsoft.com/en-us/office/unique-function-c5ab87fd-30a3-4ce9-9d1a-40204fb85e1e

**18. Which function returns only the rows that meet a condition and spills them?** (a-064) [added]
- **FILTER** (correct)
- VLOOKUP
- SUMIFS
- COUNTIF

Why: FILTER returns the rows that meet your criteria and spills them. VLOOKUP returns one value; SUMIFS and COUNTIF return a single number.
Source: https://support.microsoft.com/en-us/office/filter-function-f4f7cb66-82eb-4767-8f7c-4877ad80c759

**19. What most often causes a #SPILL! error in a dynamic array formula?** (a-065) [added]
- The source range contains duplicates
- **Something blocks the cells where results would spill** (correct)
- The workbook has too many sheets
- The formula uses a named range

Why: #SPILL! means something is blocking the cells where the formula would spill. Remove the obstruction and the results appear.
Source: https://support.microsoft.com/en-us/office/dynamic-array-formulas-and-spilled-array-behavior-205c6b06-03ba-4151-89a1-87a7eb36e531

**20. FILTER finds no matches and if_empty is omitted. What does it return?** (a-066) [added]
- **#CALC!** (correct)
- #N/A
- #VALUE!
- An empty cell

Why: FILTER returns #CALC! when nothing matches, because Excel has no empty arrays. Supply the if_empty argument to return something else.
Source: https://support.microsoft.com/en-us/office/filter-function-f4f7cb66-82eb-4767-8f7c-4877ad80c759

**21. What does clearing 'Enable background refresh' do for an Excel query?** (a-070) [added]
- **Excel waits for the refresh to finish before you continue** (correct)
- The query stops refreshing when the file opens
- The query is removed from Refresh All
- The query loads only its connection information

Why: With background refresh on, Excel stays usable during a refresh. With it cleared, the refresh runs while you wait.
Source: https://support.microsoft.com/en-us/office/refresh-an-external-data-connection-in-excel-1524175f-777a-48fc-8fc7-c8514b984440

## Power Query (34)

**1. What problem does Power Query mainly solve?** (a-010)
- Building interactive dashboards online
- **Repeatable import and reshaping of data you can refresh** (correct)
- Recording macros without writing VBA
- Storing very large databases inside Excel

Why: Power Query connects to data, reshapes it and saves the steps as a repeatable query you can refresh. It is not a dashboard tool, macro recorder or database.
Source: https://learn.microsoft.com/en-us/power-query/power-query-what-is-power-query

**2. After you apply Power Query steps to a file, what happens to the original file?** (a-011)
- It is overwritten with the shaped data
- It is moved into the workbook
- **It stays unchanged; the steps run when the query runs** (correct)
- It is converted into an Excel table

Why: Power Query records transformations as query steps and applies them when the query runs; it does not modify the source data.
Source: https://learn.microsoft.com/en-us/power-query/power-query-what-is-power-query

**3. How does the Power Query editor let you apply a transformation?** (a-012) [replaced]
- Write each step in M code by hand
- Type a worksheet formula into every cell
- **Pick it from ribbons and menus; no code is required** (correct)
- Record a VBA macro, then run it on the data

Why: The editor applies transformations from ribbons, menus and buttons and writes the M code for you. Writing M by hand is optional (Advanced Editor).
Source: https://learn.microsoft.com/en-us/power-query/power-query-what-is-power-query

**4. In Power Query, what is a step?** (a-013)
- A saved copy of the source file
- A scheduled refresh run
- **One recorded transformation listed in Applied Steps** (correct)
- A column's data type setting

Why: Every transformation you apply is saved as a step in the Applied steps list of the query settings pane.
Source: https://learn.microsoft.com/en-us/power-query/power-query-ui

**5. What is M in Power Query?** (a-014)
- **The formula language behind every query step** (correct)
- A macro recorder for Excel workbooks
- The connector used for Microsoft databases
- A chart type in the editor

Why: M is the Power Query M formula language. The editor writes M behind the scenes for every transformation, and you can edit it in the Advanced Editor.
Source: https://learn.microsoft.com/en-us/power-query/power-query-what-is-power-query

**6. Which Excel command opens the Import Data dialog to choose where a query loads?** (a-015)
- Close & Load
- Refresh All
- **Close & Load To...** (correct)
- Advanced Editor

Why: Close & Load To... opens the Import Data dialog where you choose how and where the query loads.
Source: https://support.microsoft.com/en-us/excel/create-a-parameter-query-power-query

**7. What does the Only Create Connection load option do in Excel?** (a-016) [fixed]
- Loads only the first 1,000 rows
- Deletes itself after one refresh
- Locks the query so it cannot be edited
- **Stores the connection in the workbook for later use** (correct)

Why: Only Create Connection saves the connection in the workbook for later use instead of placing the data in a PivotTable report. The other options describe things it does not do.
Source: https://support.microsoft.com/en-us/office/import-data-dialog-box-e8a1eb00-73b8-4d5c-9249-6cf718c7cd6a

**8. In the Power Query editor, which option do you clear so a helper query does not load its output?** (a-017) [replaced]
- Use original column name as prefix
- **Enable load** (correct)
- Use fuzzy matching to perform the merge
- Skip files with errors

Why: Clearing Enable load stops a query from loading to a destination while other queries can still use it. The other options belong to expand, merge and connector dialogs.
Source: https://learn.microsoft.com/en-us/power-query/power-query-ui

**9. Which Power Query command splits one text column into several columns at a comma?** (a-018)
- Group By
- **Split Column by Delimiter** (correct)
- Merge Columns
- Transpose

Why: Split Column by Delimiter splits a text column at a character such as a comma or space. Merge Columns does the opposite; Group By and Transpose do other jobs.
Source: https://learn.microsoft.com/en-us/power-query/split-columns-delimiter

**10. Which Power Query transform counts rows per category, such as customers per country?** (a-019)
- Append Queries
- Unpivot Columns
- **Group By** (correct)
- Use First Row as Headers

Why: Group By with the Count rows operation counts rows per group, for example customers per country. Append, Unpivot and promoting headers do other jobs.
Source: https://learn.microsoft.com/en-us/power-query/power-query-ui

**11. What does Use First Row as Headers do?** (a-020)
- **Promotes the first row of data to column names** (correct)
- Sorts the table by its first row
- Freezes the first row on the worksheet
- Deletes the first row and keeps the old names

Why: Use First Row as Headers (Promote headers) turns the first row of data into the column names. It does not sort the table or freeze a row.
Source: https://learn.microsoft.com/en-us/power-query/data-types

**12. For CSV or text sources, which two steps does automatic type detection add?** (a-021) [replaced]
- Remove duplicates and Sorted rows
- Filtered rows and Renamed columns
- **Promote column headers and Changed type** (correct)
- Merged queries and Grouped rows

Why: For unstructured sources, detection promotes the first row to headers and then converts Any columns to real data types (Changed type).
Source: https://learn.microsoft.com/en-us/power-query/data-types

**13. When is unpivoting most useful?** (a-022)
- When you need to stack two tables together
- When you want to count rows per group
- When you want to join tables on a key
- **When a table has one column per month or period** (correct)

Why: Unpivot turns columns (such as one per month) into attribute-value rows, which is easier to filter and analyze. Append stacks, Group By counts, Merge joins.
Source: https://learn.microsoft.com/en-us/power-query/unpivot-column

**14. A source gains new month columns each period. Which option unpivots them automatically?** (a-023)
- Unpivot Only Selected Columns
- Pivot Column
- **Unpivot Other Columns** (correct)
- Transpose

Why: Unpivot Other Columns unpivots everything except the columns you select, so new month columns added later are unpivoted on refresh. Only Selected Columns ignores them.
Source: https://learn.microsoft.com/en-us/power-query/unpivot-column

**15. Which Power Query operation stacks the rows of two tables on top of each other?** (a-024)
- **Append Queries** (correct)
- Merge Queries
- Group By
- Unpivot Columns

Why: Append Queries adds the rows of one or more tables to another, stacking them. Merge Queries joins tables side by side on key columns.
Source: https://learn.microsoft.com/en-us/power-query/append-queries

**16. Which Power Query operation matches rows of two tables on key columns, like a join?** (a-025)
- Append Queries
- Transpose
- **Merge Queries** (correct)
- Fill Down

Why: Merge Queries joins two tables on matching key columns, like a SQL join. Append stacks rows instead.
Source: https://learn.microsoft.com/en-us/power-query/merge-queries-overview

**17. Which join kind keeps all left rows but only matching right rows?** (a-026) [fixed]
- Inner
- **Left outer** (correct)
- Full outer
- Left anti

Why: Left outer keeps all left rows and only the matching right rows. Full outer also keeps unmatched right rows; Left anti keeps only unmatched left rows.
Source: https://learn.microsoft.com/en-us/power-query/merge-queries-overview

**18. Which join kind keeps only rows that match in both tables?** (a-027)
- Left outer
- Right outer
- **Inner** (correct)
- Right anti

Why: Inner join keeps only rows that have a match in both tables. Outer joins keep unmatched rows from one or both sides.
Source: https://learn.microsoft.com/en-us/power-query/merge-queries-overview

**19. What is query folding in Power Query?** (a-028)
- Collapsing several queries into one in the pane
- Compressing the loaded table to save memory
- Hiding steps in the Applied Steps list
- **Pushing transformations to the data source to run there** (correct)

Why: Query folding translates supported transformations into operations the data source runs, instead of Power Query doing them after loading all data.
Source: https://learn.microsoft.com/en-us/power-query/query-folding-basics

**20. Why does query folding usually make refreshes faster?** (a-029) [fixed]
- It skips credential checks
- **The data source does the work instead of Power Query** (correct)
- It caches the results on disk forever
- It converts all columns to text

Why: Folding pushes work to the data source, which is often faster than pulling all the data and transforming it in the Power Query engine.
Source: https://learn.microsoft.com/en-us/power-query/query-folding-basics

**21. Which Power Query feature stores a reusable value such as a file path or date?** (a-030)
- Column profile
- Diagram view
- Query Dependencies view
- **Parameter** (correct)

Why: A parameter stores a value (text, number, date) that you can reuse and change in one place to alter queries, such as a filter value or source argument.
Source: https://learn.microsoft.com/en-us/power-query/power-query-query-parameters

**22. How do you turn a query that holds a simple constant into a parameter?** (a-031)
- Rename it with a leading @ symbol
- Append it to a table named Parameters
- **Right-click it and choose Convert to Parameter** (correct)
- Clear its Enable load option

Why: Right-click a query that holds a simple constant (date, text, number) and choose Convert to Parameter. Clearing Enable load only stops loading.
Source: https://learn.microsoft.com/en-us/power-query/power-query-query-parameters

**23. In Excel's Data ribbon, which command loads data from a web page address?** (a-032) [fixed]
- **From Web** (correct)
- From Text/CSV
- From Table/Range
- Queries & Connections

Why: From Web on the Data ribbon starts the Web connector. From Text/CSV is for local files and From Table/Range is for data already in the workbook.
Source: https://learn.microsoft.com/en-us/power-query/connectors/web/web

**24. A CSV file sits at a URL. Which Power Query Desktop connector imports it?** (a-033)
- **Web** (correct)
- Text/CSV
- Folder
- OData Feed

Why: A file on the web must be imported with the Web connector in Power Query Desktop; the file-type connectors such as Text/CSV are for local files.
Source: https://learn.microsoft.com/en-us/power-query/connectors/web/web

**25. In the From Web dialog, which setting builds a URL from text parts and parameters?** (a-034)
- Basic
- **Advanced** (correct)
- Navigator
- Web View

Why: Advanced in the From Web dialog lets you assemble a URL from parts, using text constants and parameters. Basic takes one complete URL.
Source: https://learn.microsoft.com/en-us/power-query/connectors/web/web

**26. Where in the Power Query editor do you create or edit a parameter?** (a-035)
- Transform > Group By
- View > Advanced Editor
- Add Column > Custom Column
- **Home > Manage Parameters** (correct)

Why: Home > Manage Parameters opens the Manage Parameters window, where you create and edit parameters.
Source: https://learn.microsoft.com/en-us/power-query/power-query-query-parameters

**27. Which Power BI tool runs a scheduled refresh of an Import semantic model?** (a-043)
- **The Power BI service** (correct)
- Power BI Desktop
- The Power Query editor
- A DAX measure

Why: Scheduled refresh for an Import semantic model is configured and run in the Power BI service. Power BI Desktop only refreshes on demand.
Source: https://learn.microsoft.com/en-us/power-bi/connect-data/refresh-data

**28. Which join kind returns only left rows that have no match in the right table?** (a-067) [added]
- Inner
- **Left anti** (correct)
- Full outer
- Right outer

Why: Left anti keeps only left-table rows with no match in the right table. Inner keeps matches; outer joins keep unmatched rows too.
Source: https://learn.microsoft.com/en-us/power-query/merge-queries-left-anti

**29. Which source type commonly supports query folding?** (a-068) [added]
- **A SQL Server database** (correct)
- A CSV file
- An Excel workbook file
- A plain text file

Why: Structured sources with a query engine, such as SQL Server, commonly support folding. Sources without one, such as CSV and Excel files, do not.
Source: https://learn.microsoft.com/en-us/power-query/query-folding-basics

**30. Which M function returns the tables and named ranges of the current workbook?** (a-069) [added]
- Excel.Workbook
- File.Contents
- **Excel.CurrentWorkbook** (correct)
- Web.Contents

Why: Excel.CurrentWorkbook returns the tables, named ranges and dynamic arrays of the current workbook. Excel.Workbook reads a file and returns sheets.
Source: https://learn.microsoft.com/en-us/powerquery-m/excel-currentworkbook

**31. Which M pattern returns a fallback value when a step raises an error?** (a-071) [added]
- if ... else error
- **try ... otherwise** (correct)
- catch ... finally
- on error resume next

Why: try expression otherwise fallback catches an error and returns the fallback value instead. The other options are not M patterns that return a fallback.
Source: https://learn.microsoft.com/en-us/powerquery-m/m-spec-error-handling

**32. With a US locale, dates like 22/03/2025 error when set to Date. What fixes this?** (a-072) [added] [fixed]
- Set the type to Any
- **Change type using a locale such as English (UK)** (correct)
- Change the type to Duration
- Sort the column ascending first

Why: The US locale reads dates as month/day/year, so month 22 fails. Change type > Using locale with English (United Kingdom) reads them correctly.
Source: https://learn.microsoft.com/en-us/power-query/data-types

**33. Which Power Query data type has four fixed decimals and is always precise?** (a-073) [added]
- **Fixed decimal number** (correct)
- Decimal number
- Percentage
- Date/Time

Why: Fixed decimal (Currency) always has four digits after the decimal point and is always precise. Decimal number is floating point and can show tiny rounding differences.
Source: https://learn.microsoft.com/en-us/power-query/data-types

**34. What does the Reference option on a query create?** (a-074) [added]
- An independent copy of its steps
- **A new query that starts from the output of that query** (correct)
- A hyperlink to the source file
- A parameter holding its name

Why: Reference creates a new query that points to the output of the existing query. Duplicate would be the independent copy of its steps.
Source: https://learn.microsoft.com/en-us/power-query/power-query-ui

## Power BI (30)

**1. Which statement best describes Power BI compared with Excel?** (a-044)
- **An analytics platform with a service for sharing reports** (correct)
- A newer Excel version with more rows per sheet
- A database engine that stores your source data
- An add-in that only formats worksheets

Why: Power BI is a business analytics platform: Desktop is for modeling and building reports, the service for sharing and collaboration. It is not an Excel version or a database.
Source: https://learn.microsoft.com/en-us/power-bi/fundamentals/power-bi-overview

**2. Which Power BI component is best suited to data modeling and report creation?** (a-045) [fixed]
- Power BI Mobile app
- Power BI service
- **Power BI Desktop** (correct)
- Power BI Report Server

Why: The docs say Power BI Desktop is best for data modeling and report creation; the service is ideal for sharing and collaboration.
Source: https://learn.microsoft.com/en-us/power-bi/fundamentals/power-bi-overview

**3. In Power BI, what is a workspace app?** (a-046) [fixed]
- The Windows program used to build reports
- **Content from a workspace packaged and shared with users** (correct)
- A custom visual from the marketplace
- A saved Power Query connector

Why: A workspace app packages related dashboards, reports and semantic models from a workspace and publishes them to a wider audience.
Source: https://learn.microsoft.com/en-us/power-bi/explore-reports/end-user-apps

**4. What is a Power BI semantic model?** (a-047) [fixed]
- A single report page with its visuals
- A saved gateway connection
- A list of DAX queries that were run
- **A data model that is ready for reporting and visualization** (correct)

Why: A semantic model is the reporting-ready data model that reports and visuals are built on. A report page, gateway or query list is something else.
Source: https://learn.microsoft.com/en-us/power-bi/connect-data/service-datasets-understand

**5. Which term replaced 'dataset' in Power BI?** (a-048)
- Dataflow
- **Semantic model** (correct)
- Data mart
- Data lake

Why: Microsoft renamed the dataset content type to semantic model. It is a rename only, with no change to how it works.
Source: https://learn.microsoft.com/en-us/power-bi/connect-data/service-datasets-rename

**6. Which storage mode copies data into the model, so it is only as fresh as the last refresh?** (a-049)
- DirectQuery
- Live connection
- **Import** (correct)
- Streaming

Why: Import mode loads data into the model, so it is only as current as the last refresh. DirectQuery and live connections query the source at view time.
Source: https://learn.microsoft.com/en-us/power-bi/connect-data/service-dataset-modes-understand

**7. Which is a typical reason to choose DirectQuery over Import?** (a-050)
- You need every DAX function and calculated tables
- You want the fastest in-memory visuals
- You want to avoid any connection to the source
- **Data is too large to load or must be near real time** (correct)

Why: DirectQuery suits data too large to import or needing near real-time results. Import offers full DAX, calculated tables and the fastest in-memory queries.
Source: https://learn.microsoft.com/en-us/power-bi/connect-data/service-dataset-modes-understand

**8. What does a model relationship between two tables do?** (a-051)
- Copies rows from one table into the other
- Merges both tables into one table
- Enforces referential integrity on load
- **Propagates filters from one table to the other** (correct)

Why: A relationship propagates filters applied on a column of one table to a related table. It does not copy rows or merge tables.
Source: https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand

**9. Which cardinality is most common between a dimension and a fact table?** (a-052)
- One-to-one
- Many-to-many
- **One-to-many** (correct)
- Self-referencing

Why: One-to-many (dimension to fact) is the most common cardinality. Many-to-many is rarely used and needs more care.
Source: https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand

**10. In a star schema, which table type stores events such as sales orders?** (a-053)
- Dimension table
- **Fact table** (correct)
- Calculated table
- Parameter table

Why: Fact tables store observations or events such as sales orders. Dimension tables describe entities such as products or dates.
Source: https://learn.microsoft.com/en-us/power-bi/guidance/star-schema

**11. In a star schema, which tables mainly provide filtering and grouping?** (a-054)
- Fact tables
- Calculated tables
- **Dimension tables** (correct)
- Staging tables

Why: Dimension tables enable filtering and grouping; fact tables enable summarization.
Source: https://learn.microsoft.com/en-us/power-bi/guidance/star-schema

**12. Which DAX object is evaluated at query time and stores no values in the model?** (a-055)
- Calculated column
- **Measure** (correct)
- Calculated table
- Power Query custom column

Why: A measure is evaluated in the current filter context when a visual asks for it, so no results are stored. Calculated columns and tables store values.
Source: https://learn.microsoft.com/en-us/dax/dax-overview

**13. When are a calculated column's values computed and stored?** (a-056) [fixed]
- For each cell in a visual, never stored
- Only when a report page is opened
- In the data source before loading
- **When created and on data refresh; stored in the model** (correct)

Why: Calculated column values are computed as soon as the formula is valid, recalculated on refresh and stored in the model. Measures are not stored.
Source: https://learn.microsoft.com/en-us/dax/dax-overview

**14. In DAX, what is row context?** (a-057)
- The filters coming from slicers and report filters
- The rows hidden by row-level security
- The first row of a table
- **The current row, such as in a calculated column** (correct)

Why: Row context is "the current row", for example when a calculated column formula is evaluated row by row. Slicer filters belong to filter context.
Source: https://learn.microsoft.com/en-us/dax/dax-overview

**15. In DAX, what is filter context?** (a-058)
- The current row of a calculated column
- **The set of filters applied to columns, such as slicers** (correct)
- The data type allowed in each column
- A list of visuals on the page

Why: Filter context is the set of values allowed in each column, from slicers, report filters or filter arguments in a formula. Row context is the current row.
Source: https://learn.microsoft.com/en-us/dax/dax-overview

**16. Which language do Power Query steps use in both Excel and Power BI Desktop?** (a-059)
- DAX
- **M** (correct)
- VBA
- SQL

Why: Power Query uses the M formula language in both Excel and Power BI Desktop. DAX is for model calculations.
Source: https://learn.microsoft.com/en-us/power-query/power-query-what-is-power-query

**17. In Power BI Desktop, which Home button opens the Power Query editor?** (a-060)
- Get data
- Enter data
- New measure
- **Transform data** (correct)

Why: In Power BI Desktop, Transform data on the Home tab opens the Power Query editor. Get data opens the connect experience instead.
Source: https://learn.microsoft.com/en-us/power-query/power-query-ui

**18. Why does scheduled refresh often need an on-premises data gateway?** (a-061)
- The gateway converts DAX measures into M
- The gateway compresses the model to save space
- The gateway stores the report visuals
- **The service cannot reach the data source directly** (correct)

Why: If Power BI cannot reach a source over a direct network connection, as with on-premises sources, a gateway must be configured before scheduled refresh can work.
Source: https://learn.microsoft.com/en-us/power-bi/connect-data/refresh-data

**19. How many gateway connections can one semantic model use?** (a-062)
- One per data source
- **One** (correct)
- Two: a primary and a backup
- Unlimited

Why: A semantic model can use only a single gateway connection, so all needed data source definitions must be on the same gateway.
Source: https://learn.microsoft.com/en-us/power-bi/connect-data/refresh-data

**20. What does the DAX function CALCULATE do?** (a-075) [added]
- **Evaluates an expression in a modified filter context** (correct)
- Adds a calculated column to a table
- Calculates only for the current row
- Converts a measure into a table

Why: CALCULATE evaluates an expression in a filter context modified by its filter arguments.
Source: https://learn.microsoft.com/en-us/dax/calculate-function-dax

**21. A slicer filters Color to Red; CALCULATE adds Color = "Blue". Which filter applies?** (a-076) [added]
- Red wins; the Blue filter is ignored
- **Blue replaces the Red filter on Color** (correct)
- Both apply and the result is blank
- Power BI shows an error

Why: When CALCULATE filters a column already filtered in context, the existing filter is overwritten, so Blue replaces the slicer's Red. KEEPFILTERS would keep both.
Source: https://learn.microsoft.com/en-us/dax/calculate-function-dax

**22. How does SUMX differ from SUM?** (a-077) [added]
- **It evaluates an expression for each row, then sums** (correct)
- It sums only the rows hidden by filters
- It ignores all filter context
- It sums text columns as numbers

Why: SUMX evaluates an expression for each row of a table and then sums the results. SUM only adds up one column.
Source: https://learn.microsoft.com/en-us/dax/sumx-function-dax

**23. Which DAX function returns a value from the one-side table in row context?** (a-078) [added]
- RELATEDTABLE
- CALCULATETABLE
- **RELATED** (correct)
- USERELATIONSHIP

Why: RELATED follows a many-to-one relationship in row context to return a value from the related (one-side) table. RELATEDTABLE returns the many-side rows.
Source: https://learn.microsoft.com/en-us/dax/related-function-dax

**24. In a one-to-many relationship with Single cross filter direction, filters flow...** (a-079) [added]
- **From the one side to the many side** (correct)
- From the many side to the one side
- In both directions
- Only between hidden tables

Why: For one-to-many relationships, filters always flow from the one side and only optionally also from the many side (Both).
Source: https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand

**25. Which DAX function activates an inactive relationship for one calculation?** (a-080) [added]
- **USERELATIONSHIP** (correct)
- CROSSFILTER
- TREATAS
- RELATED

Why: USERELATIONSHIP activates an inactive relationship during one calculation. CROSSFILTER changes direction instead.
Source: https://learn.microsoft.com/en-us/dax/userelationship-function-dax

**26. Which DAX function creates a table of consecutive dates between two dates?** (a-081) [added]
- TODAY
- EOMONTH
- DATEDIFF
- **CALENDAR** (correct)

Why: CALENDAR returns a table with one Date column holding every date from the start to the end date.
Source: https://learn.microsoft.com/en-us/dax/calendar-function-dax

**27. Which describes a valid date column for Mark as date table?** (a-082) [added]
- **Unique dates with no blanks and no gaps** (correct)
- Only the dates that occur in the sales data
- Any dates; gaps are filled in automatically
- Dates may repeat if the table is sorted

Why: The column must hold unique dates with no blanks and no gaps from first to last date. Dates that only occur in sales data would leave gaps.
Source: https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-date-tables

**28. What does incremental refresh avoid?** (a-083) [added]
- Using Power Query for transformations
- Needing credentials for the data source
- **Reloading entire tables on every refresh** (correct)
- Storing data in the model

Why: Incremental refresh avoids truncating and reloading entire tables on every refresh; only recent data is refreshed.
Source: https://learn.microsoft.com/en-us/power-bi/connect-data/service-dataset-modes-understand

**29. What does row-level security (RLS) do in Power BI?** (a-084) [added]
- Encrypts the model file on disk
- **Limits which rows of data users can retrieve** (correct)
- Hides report pages from users
- Limits how often a model can refresh

Why: RLS limits the data certain users can retrieve by restricting which rows they see in the model.
Source: https://learn.microsoft.com/en-us/power-bi/connect-data/service-datasets-understand

**30. How is a row-level security rule defined in a role?** (a-085) [added]
- **As a DAX expression that returns TRUE or FALSE per row** (correct)
- As a Power Query filter step
- As a gateway data source setting
- As a slicer on every page

Why: An RLS role filter is a DAX expression that returns TRUE or FALSE for each row; only rows returning TRUE are visible to the role members.
Source: https://learn.microsoft.com/en-us/power-bi/enterprise/service-admin-rls

## Power Apps (57)

**1. What is Power Apps mainly used for?** (b-001)
- Building interactive reports and dashboards
- Automating tasks between services with triggers
- **Building custom business apps with little or no code** (correct)
- Hosting team sites and document libraries

Why: Power Apps is a rapid development environment for custom business apps that lets people build feature-rich apps without writing code. Reports are Power BI, automation is Power Automate, sites are SharePoint.
Source: https://learn.microsoft.com/en-us/power-apps/powerapps-overview

**2. Why choose a canvas app instead of a model-driven app?** (b-002)
- **Full control of layout and data from many sources** (correct)
- The layout is generated from Dataverse tables
- It needs no formulas and no connectors at all
- It can only use SharePoint as its data source

Why: Canvas makers have total control over layout and can connect to Dataverse plus many other sources through connectors. In a model-driven app the layout comes from the components you add.
Source: https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/model-driven-app-overview

**3. A model-driven app is designed starting from which element?** (b-003)
- A blank screen with free-form controls
- A SharePoint site collection
- A Power Automate flow
- **The Dataverse data model** (correct)

Why: Model-driven apps are really data-model-driven: without a data model in Dataverse you cannot create one. A blank screen with free-form controls describes a canvas app.
Source: https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/model-driven-app-overview

**4. Which need points to Dataverse rather than a SharePoint list as the data source?** (b-004) [fixed]
- A simple one-table tracker for a small team
- **Relational tables with field-level security** (correct)
- Data that users already maintain in SharePoint
- Sharing a simple checklist with a few colleagues

Why: Dataverse offers relational data and robust security such as business units and field-level security, while Lists offers simpler list data and permission levels. Small or already-in-SharePoint needs fit Lists.
Source: https://learn.microsoft.com/en-us/power-apps/teams/compare-data-sources

**5. What is the purpose of a container control in a canvas app?** (b-005)
- Stores the records returned by a data source
- **Groups child controls and can arrange them automatically** (correct)
- Holds a flow that runs when the screen opens
- Defines a formula reused across the whole app

Why: A container control holds child components and positions them itself, so you never set X and Y for children. It does not store data, run flows or define formulas.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-vertical-container

**6. What is the Text input control used for?** (b-006) [replaced]
- Showing a chart of values from a data source
- Repeating a template once per record
- Running a formula on a timer
- **Letting users type text, numbers, and other data** (correct)

Why: The docs describe Text input as a box where the user types text, numbers and other data. Charts, galleries and timers are other control types with different jobs.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-text-input

**7. In Power Apps, what is a control?** (b-007)
- **A UI element on a screen, such as a button or label** (correct)
- A rule that decides who can open the app
- A connection to a data source
- A formula that runs when the app starts

Why: Docs call the UI elements you add to a canvas app controls (buttons, labels, galleries), and the aspects you configure on them properties.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/add-configure-controls

**8. Which property holds the formula that runs when a button is selected?** (b-008)
- OnClick
- OnChange
- **OnSelect** (correct)
- OnPress

Why: OnSelect holds the actions that run when the user taps or clicks a control. OnChange fires when a value changes; OnClick and OnPress do not exist.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/properties-core

**9. Which formula reads the text typed in a text input named TextInput1?** (b-009)
- TextInput1(Text)
- Text.TextInput1
- TextInput1->Text
- **TextInput1.Text** (correct)

Why: You read a control property as ControlName.Property, so TextInput1.Text gives the typed text. The docs use exactly FlowInApp.Run(TextInput1.Text) in a button.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/using-logic-flows

**10. Which Power Fx function sends an Edit form's values to its data source?** (b-010)
- OnSubmit
- **SubmitForm** (correct)
- PatchForm
- SaveForm

Why: SubmitForm saves the changes in a form to its data source after validating them. Edit and New modes decide whether it updates or creates. PatchForm and SaveForm are not Power Fx functions.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-form

**11. Which Edit form property runs when SubmitForm fails validation or saving?** (b-011)
- OnCancel
- OnReject
- **OnFailure** (correct)
- OnInvalid

Why: If validation fails or the save is unsuccessful, SubmitForm sets Error and ErrorKind and the form's OnFailure formula runs. OnCancel, OnReject and OnInvalid are not form properties.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-form-detail

**12. When does the OnSuccess formula of an Edit form run?** (b-012)
- **After SubmitForm saves the record successfully** (correct)
- When the user first opens the screen
- Before the form validates its fields
- When the user selects a Cancel button

Why: OnSuccess holds actions to perform after a data operation succeeds. When SubmitForm saves the record, Error is cleared and OnSuccess runs, often used to go Back().
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-form-detail

**13. Which function pairs with Defaults() to create a record without a Form control?** (b-013)
- SubmitForm
- NewForm
- **Patch** (correct)
- Refresh

Why: Patch(DataSource, Defaults(DataSource), {...}) creates a record with no form involved. Defaults supplies the blank base record and the change record sets its values.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-patch

**14. When is Patch a better choice than an Edit form?** (b-014)
- **For updates with no user input or spanning many screens** (correct)
- When you want automatic validation on every column
- When you want a ready-made layout for each column
- When the data source is read-only

Why: Patch suits complex cases like updates needing no user interaction or forms that span multiple screens. An Edit form gives layout and validation for simple changes.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-patch

**15. Which function changes specific fields on all records that match a condition?** (b-015)
- Update
- RemoveIf
- Collect
- **UpdateIf** (correct)

Why: UpdateIf changes one or more values in every record that matches a condition. Update replaces one whole record, RemoveIf deletes, Collect adds.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-update-updateif

**16. What does the Update function do with the record you pass it?** (b-016)
- Changes only the fields you list
- **Replaces the entire record; missing fields become blank** (correct)
- Adds a new record next to the old one
- Deletes it when no condition matches

Why: Update replaces the entire record; properties you leave out of the new record become blank. UpdateIf and Patch change only the fields you list.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-update-updateif

**17. How do you start an added flow named SendMail from a button?** (b-017)
- Launch(SendMail) in the button's OnSelect
- **SendMail.Run(parameters) in the button's OnSelect** (correct)
- Navigate(SendMail) in the button's OnSelect
- Set(SendMail, true) in App.OnStart

Why: Once a flow is added to the app, you call it like a function in a behavior formula, such as FlowInApp.Run(TextInput1.Text) in a button's OnSelect. Launch opens URLs and apps.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/using-logic-flows

**18. Which trigger lets a canvas app start a cloud flow?** (b-018)
- The Recurrence trigger
- When an item is created
- When a new email arrives (V3)
- **The Power Apps trigger** (correct)

Why: A flow meant to be called from a canvas app is an instant cloud flow whose trigger is Power Apps. Recurrence and connector triggers start flows without the app.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/using-logic-flows

**19. What are the .pa.yaml files of a canvas app?** (b-019)
- **Readable source code of the app's screens and controls** (correct)
- A compiled package that only runs in Studio
- A list of the users allowed to open the app
- A Dataverse table definition

Why: Studio generates *.pa.yaml source files (App.pa.yaml plus one per screen and component). They are human-readable Power Fx and YAML; the binary .msapp package is what contains them.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/power-apps-yaml

**20. Which Studio tool scans an app for formula, accessibility and performance issues?** (b-020)
- Test Studio
- Version history
- **App checker** (correct)
- Solution explorer

Why: App checker in the Studio toolbar lists formula issues and accessibility concerns with recommendations. Test Studio runs automated tests; Version history restores saves.
Source: https://learn.microsoft.com/en-us/power-apps/guidance/coding-guidelines/monitoring-testing

**21. Which Power Apps feature records and replays automated tests for a canvas app?** (b-021)
- App checker
- Preview with F5
- Solution checker
- **Test Studio** (correct)

Why: Test Studio has a recorder that generates test steps as you use the published app, and you can then add assertions. App checker only analyzes the app.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/working-with-test-studio

**22. Which key runs a canvas app in preview mode inside Studio?** (b-022)
- F1
- **F5** (correct)
- F9
- F12

Why: F5 opens Preview mode in Power Apps Studio. F1 opens documentation and F12 downloads the .msapp file.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/keyboard-shortcuts

**23. What does delegation mean in a canvas app?** (b-023)
- The app copies the whole table to the device first
- The maker hands app ownership to another person
- **The data source runs the query and returns only the results** (correct)
- A flow runs the formula instead of the app

Why: With delegation, Power Apps sends a query the data source understands, the source runs it, and only the results come back. Without it, the app must pull rows down and process them locally.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview

**24. What is the default Data row limit for non-delegable queries in canvas apps?** (b-024)
- **500 records** (correct)
- 100 records
- 1,000 records
- 5,000 records

Why: For nondelegable queries Power Apps processes only the first 500 records by default. You can raise the Data row limit in settings up to 2,000.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview

**25. Which of these functions cannot be delegated to a data source?** (b-025)
- Filter
- Sort
- **GroupBy** (correct)
- LookUp

Why: Filter, Sort and LookUp can be delegated, while GroupBy is listed among the nondelegable functions (with FirstN, Last, Concat, Collect and others).
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview

**26. What does a delegation warning in Power Apps Studio tell you?** (b-026)
- **Only the first 500-2,000 rows are processed locally** (correct)
- The data source rejected your sign-in
- The formula has a syntax error and cannot run
- The data source is read-only

Why: A delegation warning means part of the formula cannot be sent to the data source, so Power Apps processes only the first 500 records (up to 2,000) locally and may return incomplete results.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview

**27. Which function sets a context variable that lives on one screen?** (b-027)
- Set
- Collect
- ClearCollect
- **UpdateContext** (correct)

Why: UpdateContext sets context variables, which can be used on only one screen. Set creates global variables; Collect and ClearCollect build collections usable app-wide.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/working-with-variables

**28. What is a collection in a canvas app?** (b-028)
- A variable limited to a single screen
- **An in-memory table you can use anywhere in the app** (correct)
- A saved SharePoint view
- A group of controls on a screen

Why: A collection holds a table that you can reference anywhere in the app. A variable limited to one screen is a context variable.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/working-with-variables

**29. Which property returns the record a user picked in a gallery?** (b-029)
- Items
- **Selected** (correct)
- AllItems
- Default

Why: Selected returns the selected item of a gallery. Items is the data source, AllItems the loaded rows, and Default the initially selected item.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-gallery

**30. Inside a gallery template, what does ThisItem refer to?** (b-030) [fixed]
- The record the user selected last
- The first record of the data source
- The gallery control itself
- **The record shown in the current gallery item** (correct)

Why: ThisItem is the default name for the current record in a gallery (or form) template, which is replicated for each item. Use ThisItem.Field in the template.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/operators

**31. Inside a Filter formula, which keyword refers to the record being evaluated?** (b-031)
- **ThisRecord** (correct)
- ThisItem
- ThisRow
- CurrentRecord

Why: ThisRecord is the default name for the current record in Filter, ForAll, With and other record-scope functions. ThisItem belongs to galleries and forms.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/operators

**32. Which operator names the record being processed, as in Filter(Orders As O, ...)?** (b-032)
- In
- With
- **As** (correct)
- Of

Why: The As operator gives the current record a name, replacing the default ThisItem or ThisRecord, which helps in nested scenarios. "in" tests membership or substrings.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/operators

**33. Which function returns only the first record that meets a condition?** (b-033)
- Filter
- Search
- Sort
- **LookUp** (correct)

Why: LookUp finds the first record that satisfies a formula and returns just that record. Filter and Search return a table of all matching records.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-filter-lookup

**34. Which function matches a single text anywhere inside given columns?** (b-034)
- Filter
- **Search** (correct)
- LookUp
- StartsWith

Why: Search takes one string and returns records whose listed columns contain it anywhere ("rob" matches "Robert"). Filter needs a formula for each condition.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-filter-lookup

**35. Which gallery property holds the Filter, Sort or Search formula?** (b-035)
- Default
- Template
- **Items** (correct)
- OnSelect

Why: A gallery's Items property holds the formula that supplies its records, such as SortByColumns, Search or Filter. Default and OnSelect have other roles.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview

**36. Which Items formula can be delegated to a SharePoint list?** (b-036)
- **Filter(List, StartsWith(Title, SearchBox.Text))** (correct)
- Filter(List, Lower(Title) = Lower(SearchBox.Text))
- Filter(List, Len(Title) > 3)
- Filter(List, Left(Title, 3) = SearchBox.Text)

Why: StartsWith on a text column delegates to SharePoint. Lower, Len and Left are string-manipulation functions that cannot be delegated, so only the first 500-2,000 rows get checked.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections/connection-sharepoint-online

**37. Which App property is recommended instead of Navigate in App.OnStart?** (b-037)
- OnVisible
- OnHidden
- **StartScreen** (correct)
- ActiveScreen

Why: App.StartScreen declares the first screen without blocking, while Navigate in App.OnStart forces OnStart to finish before the first screen can show.
Source: https://learn.microsoft.com/en-us/power-apps/guidance/coding-guidelines/code-optimization

**38. What is recommended for static values currently set with Set() in OnStart?** (b-038)
- **Named formulas in App.Formulas** (correct)
- More Set() calls in OnVisible
- Context variables with UpdateContext
- A ClearCollect on every screen

Why: Named formulas in App.Formulas define static values and constants, are always up to date, and cut startup work compared with many Set() calls in OnStart.
Source: https://learn.microsoft.com/en-us/power-apps/guidance/coding-guidelines/code-optimization

**39. Which formula opens screen Details and sets context variable ID to 12?** (b-039)
- Navigate(Details, {ID: 12}, ScreenTransition.Fade)
- Navigate(Details, ID: 12)
- Go(Details, ScreenTransition.Fade, {ID: 12})
- **Navigate(Details, ScreenTransition.Fade, {ID: 12})** (correct)

Why: Navigate takes the screen, then the transition, then an optional record that sets context variables: Navigate(Details, ScreenTransition.Fade, {ID: 12}). Go() is not a function.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-navigate

**40. Which function returns to the previously displayed screen?** (b-040)
- Return
- **Back** (correct)
- Previous
- Exit

Why: Back returns to the screen that was most recently displayed, using the inverse transition by default. Return, Previous and Exit are not navigation functions.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-navigate

**41. Which function discards changes and returns an Edit form to its initial values?** (b-041)
- SubmitForm
- **ResetForm** (correct)
- ViewForm
- Clear

Why: ResetForm resets a form to the initial values from before the user edited, and a New-mode form returns to Edit mode. SubmitForm saves; ViewForm only switches to view mode.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-form

**42. Which function resets one input control to its Default value?** (b-042)
- Refresh
- Revert
- Clear
- **Reset** (correct)

Why: Reset(Control) returns a control to its Default value and discards user changes. Refresh reloads a data source and Revert reloads a record.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-reset

**43. Which formula shows a success message banner to the user?** (b-043) [fixed]
- **Notify("Saved", NotificationType.Success)** (correct)
- Notify("Saved", Success)
- Notify(NotificationType.Success)
- Notify("Saved", Color.Green)

Why: Notify shows a banner whose type comes from the second argument: NotificationType.Success, Error, Warning or Information (the default).
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-showerror

**44. Why use Concurrent() when loading data in App.OnStart?** (b-044)
- It runs formulas in random order for security
- It makes formulas wait for each other
- **It runs several data calls at the same time** (correct)
- It merges all collections into one table

Why: Concurrent evaluates its formulas at the same time, so data calls in OnStart wait only for the longest one instead of the sum of all. Chaining with ; runs them one after another.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-concurrent

**45. What is Power Fx?** (b-045)
- A SQL database service inside Dataverse
- A JavaScript framework for custom controls
- A visual designer for cloud flows
- **The low-code, Excel-like formula language of Power Platform** (correct)

Why: Power Fx is the low-code language used across Power Platform, edited in an Excel-like formula bar. It is declarative and functional, with imperative logic where needed.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/overview

**46. Which function tests whether a collection has no records?** (b-110) [added]
- **IsEmpty** (correct)
- IsBlank
- IsNull
- IsZero

Why: IsEmpty tests whether a table or collection has no records. IsBlank treats an existing empty collection as not blank, and IsNull and IsZero are not Power Fx functions.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-isblank-isempty

**47. What does Coalesce(A, B, C) return?** (b-111) [added]
- The largest of A, B and C
- All three joined into one text
- The count of non-blank arguments
- **The first argument that is not blank** (correct)

Why: Coalesce evaluates arguments in order and returns the first one that is not blank or an empty string. If all are blank it returns blank.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-isblank-isempty

**48. What does the With function do in Power Fx?** (b-112) [added]
- Opens another screen with a context variable
- **Names local values used only inside one formula** (correct)
- Stores a value for the whole app
- Repeats a formula for every record

Why: With evaluates a formula for a single record, giving named values that act as local variables inside that formula. ForAll repeats a formula per record; Set stores app-wide values.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-with

**49. Which function runs a formula for each record of a table?** (b-113) [added]
- With
- **ForAll** (correct)
- Filter
- Switch

Why: ForAll evaluates a formula for every record of a table. With handles one record, Filter returns a subset of records, and Switch picks one result.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-forall

**50. How does ForAll behave over a large data source?** (b-114) [added]
- It delegates fully to any data source
- It always loads the entire table
- It runs on the server side
- **Not delegable; works on the first 500-2,000 rows** (correct)

Why: ForAll cannot be delegated: only the first portion of the data source is fetched (500 records by default, up to 2,000) and then the formula runs on those rows.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-forall

**51. Which function empties a collection and then adds new records?** (b-115) [added]
- **ClearCollect** (correct)
- Collect
- Clear
- Patch

Why: ClearCollect deletes all records of a collection and then adds new ones in a single call. Collect only adds, Clear only empties, and Patch changes records.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-clear-collect-clearcollect

**52. Which function switches an Edit form to create a new record?** (b-116) [added]
- EditForm
- ViewForm
- **NewForm** (correct)
- ResetForm

Why: NewForm puts an Edit form into New mode so SubmitForm creates a record. EditForm modifies an existing record, ViewForm is read-only, and ResetForm discards changes.
Source: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-form

**53. Which Edit form property returns the last saved record, including its ID?** (b-117) [added]
- Updates
- Item
- Valid
- **LastSubmit** (correct)

Why: LastSubmit holds the last successfully submitted record, including server-generated fields such as ID. Item is the record loaded into the form and Updates holds values to write.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-form-detail

**54. Where do you define named formulas in a canvas app?** (b-118) [added]
- App.OnStart
- **App.Formulas** (correct)
- Screen.OnVisible
- App.StartScreen

Why: Named formulas are defined in App.Formulas and recalculate automatically. App.OnStart is imperative and used for Set calls, and App.StartScreen only chooses the first screen.
Source: https://learn.microsoft.com/en-us/power-apps/guidance/coding-guidelines/code-optimization

**55. What is the highest value you can set for Data row limit?** (b-119) [added]
- 500
- 5,000
- **2,000** (correct)
- 10,000

Why: Data row limit defaults to 500 and can be set from 1 to 2,000. Records beyond the limit are not scanned by non-delegable formulas.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview

**56. Which tool shows live events, data calls and errors while an app runs?** (b-120) [added]
- **Monitor** (correct)
- App checker
- Test Studio
- Solution checker

Why: Monitor streams events from an app session, showing operations, data calls, durations, results and errors. App checker finds formula and accessibility issues, not live runtime events.
Source: https://learn.microsoft.com/en-us/power-apps/guidance/coding-guidelines/monitoring-testing

**57. Which comparison on a SharePoint Text column can be delegated?** (b-121) [added]
- Greater than (>)
- Not equal to (<>)
- **Equal to (=)** (correct)
- Less than or equal (<=)

Why: In the SharePoint delegation table, Text columns delegate = but not <, <=, <>, > or >=. So only the equal-to comparison reaches SharePoint.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections/connection-sharepoint-online

## Power Automate (46)

**1. What is Power Automate mainly used for?** (b-046)
- Designing screens for mobile business apps
- **Automating workflows between apps and services** (correct)
- Building reports from data models
- Storing relational business data

Why: Power Automate automates workflows and repetitive tasks between apps and services. Screens are Power Apps, reports are Power BI, and relational data lives in Dataverse.
Source: https://learn.microsoft.com/en-us/power-automate/flow-types

**2. Which three types of cloud flow does Power Automate offer?** (b-047)
- Manual, desktop and attended
- Polling, push and hybrid
- **Automated, instant and scheduled** (correct)
- Basic, standard and premium

Why: Cloud flows are automated (after an event), instant/manual (started by a button) or scheduled (recurring). Desktop flows are a separate flow type.
Source: https://learn.microsoft.com/en-us/power-automate/triggers-introduction

**3. Which trigger runs a flow on a repeating timetable?** (b-048)
- **Recurrence** (correct)
- Manually trigger a flow
- When an item is created
- When a new email arrives (V3)

Why: The Recurrence trigger starts a scheduled cloud flow at a time and frequency you choose, such as daily at 10:00 AM.
Source: https://learn.microsoft.com/en-us/power-automate/triggers-introduction

**4. Which SharePoint trigger runs on new items and on later edits?** (b-049)
- When an item is created
- When an item is deleted
- **When an item is created or modified** (correct)
- For a selected item

Why: "When an item is created or modified" fires when an item is created and each time it is modified. "When an item is created" ignores later edits.
Source: https://learn.microsoft.com/en-us/sharepoint/dev/business-apps/power-automate/sharepoint-connector-actions-triggers

**5. Which Outlook trigger starts a flow when a message arrives in a mailbox?** (b-050)
- **When a new email arrives (V3)** (correct)
- When an item is created
- Manually trigger a flow
- Recurrence

Why: "When a new email arrives (V3)" from the Office 365 Outlook connector starts an automated flow when a message arrives. It is an event-based trigger.
Source: https://learn.microsoft.com/en-us/power-automate/triggers-introduction

**6. Which trigger lets a user start a flow by selecting a button?** (b-051)
- Recurrence
- When an item is created
- When a new email arrives (V3)
- **Manually trigger a flow** (correct)

Why: "Manually trigger a flow" starts an instant flow when the user selects a button in Power Automate or its mobile app.
Source: https://learn.microsoft.com/en-us/power-automate/triggers-introduction

**7. What is a child flow in Power Automate?** (b-052)
- A copy of a flow that only runs in test mode
- **A flow called by a parent flow to run reusable steps** (correct)
- A flow that starts when its parent flow fails
- A flow owned by a different environment

Why: A child flow holds smaller reusable tasks that a parent flow calls, so you avoid one huge flow and can reuse steps. Both live in the same solution.
Source: https://learn.microsoft.com/en-us/power-automate/create-child-flows

**8. Which trigger must a child flow start with?** (b-053) [fixed]
- Recurrence
- **Manually trigger a flow** (correct)
- When an item is created
- When a new email arrives (V3)

Why: The docs say child flows must have the "Manually trigger a flow" trigger so the parent flow can run them with the Run a Child Flow action.
Source: https://learn.microsoft.com/en-us/power-automate/create-child-flows

**9. Which Test pane option reuses a recent trigger event to run the flow again?** (b-055)
- **Automatically** (correct)
- Manually
- Offline
- Preview

Why: In the Test pane you can test manually (perform the trigger action) or automatically, which uses a recently used trigger or repeats a previous run.
Source: https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/test-cloud-flows

**10. Before using the Automatically test option, what must you have done?** (b-056)
- Published the flow to a solution
- Shared the flow with a co-owner
- **Saved the flow and tested it manually once** (correct)
- Turned off all trigger conditions

Why: You must save the flow, and test it manually at least once, before the automatic testing option becomes available.
Source: https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/test-cloud-flows

**11. On an instant flow, which connection setting makes each person use their own access?** (b-057)
- Use this connection
- Provided by flow owner
- Run as administrator
- **Provided by run-only user** (correct)

Why: For run-only users, "Provided by run-only user" makes each person supply their own connection, so the flow acts with their access. "Use this connection" uses the one embedded in the flow.
Source: https://learn.microsoft.com/en-us/power-automate/create-team-flows

**12. A flow uses run-only user connections and is started from an app. Whose permissions apply?** (b-058)
- The permissions of the flow owner
- **The permissions of the person using the app** (correct)
- The permissions of the app creator
- Global administrator permissions

Why: With "Provided by run-only user", the person who runs the flow supplies the connection, so the flow acts as them and uses what they can access. The flow fails if they lack permission.
Source: https://learn.microsoft.com/en-us/power-automate/create-team-flows

**13. Why make a service principal, not a person, the owner of a critical flow?** (b-059) [replaced]
- The flow can skip data loss prevention policies
- The flow runs faster than user-owned flows
- **The flow keeps running when an employee leaves** (correct)
- Human approval steps become simpler

Why: Docs recommend service principal ownership for critical flows: SPNs are not tied to individuals, so flows keep running when employees leave. User accounts suit flows needing human interaction.
Source: https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/understand-access-to-flows

**14. In a cloud flow, what does the trigger do?** (b-060)
- **Starts the flow when an event or request occurs** (correct)
- Runs the last step of the flow
- Stores values for later steps
- Handles errors from other steps

Why: A trigger is the event that starts a cloud flow, such as receiving an email. Actions are the steps that run afterwards.
Source: https://learn.microsoft.com/en-us/power-automate/triggers-introduction

**15. What is the benefit of adding a trigger condition to a flow?** (b-061)
- The flow runs faster once it has started
- Only the flow owner can see the trigger
- **The flow does not start when the condition is false** (correct)
- The flow can run on a schedule

Why: If the trigger condition is not met, the flow is not triggered and no run is logged. That saves runs and Power Platform requests.
Source: https://learn.microsoft.com/en-us/power-automate/customize-triggers

**16. What must every trigger condition expression start with?** (b-062)
- **The @ symbol** (correct)
- The = symbol
- The $ symbol
- The # symbol

Why: The docs state every trigger condition must start with the @ symbol, such as @or(test1, test2). Multiple conditions must all be true by default.
Source: https://learn.microsoft.com/en-us/power-automate/customize-triggers

**17. What does the Apply to each action do?** (b-063)
- Runs its inner actions for the first item only
- Removes items from an array that fail a test
- Joins all array items into one string
- **Runs its inner actions once for each item in an array** (correct)

Why: Apply to each takes an array and repeats its inner actions for every item in it, such as checking each of the last 10 emails. It does not filter or join.
Source: https://learn.microsoft.com/en-us/power-automate/apply-to-each

**18. Which fix does Microsoft give for a nested Apply to each over related Dataverse rows?** (b-064) [replaced]
- Add a Delay action inside the inner loop
- **Use OData query expansion with a single For each** (correct)
- Turn on Secure inputs on the loop
- Put the inner loop inside a Compose

Why: Nested loops multiply iterations (10 x 10 = 100). For related Dataverse rows, Microsoft suggests OData query expansion so a single For each replaces the nested loop.
Source: https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/avoid-anti-patterns

**19. What does concurrency control on Apply to each change?** (b-065)
- How many items the array may hold
- **How many iterations run in parallel** (correct)
- Which user the loop runs as
- How often the flow is triggered

Why: Apply to each runs sequentially by default; concurrency control sets the degree of parallelism, i.e. how many iterations run at the same time.
Source: https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/implement-parallel-execution

**20. What range can the Apply to each degree of parallelism be set to?** (b-066)
- 1 to 10
- 1 to 100
- 5 to 25
- **1 to 50** (correct)

Why: Apply to each concurrency defaults to 1 and can be set from 1 to 50 inclusively. The 1 to 100 range applies to concurrent runs at the trigger.
Source: https://learn.microsoft.com/en-us/power-automate/limits-and-config

**21. Which action stores a value for reuse without declaring a type?** (b-067)
- **Compose** (correct)
- Initialize variable
- Parse JSON
- Select

Why: Compose saves a value or expression result so you can reuse it without retyping it, and needs no declared type. Initialize variable requires a name and a data type.
Source: https://learn.microsoft.com/en-us/power-automate/data-operations

**22. What does the Parse JSON action do?** (b-068)
- Turns a table into a JSON text string
- Checks that a connection is still signed in
- **Turns JSON into structured fields usable as dynamic content** (correct)
- Sorts the items of an array by a property

Why: Parse JSON creates friendly tokens from JSON properties, which then appear in the dynamic content list. It needs a schema, which can be generated from a sample payload.
Source: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-perform-data-operations

**23. Which setting makes an action run even if the previous action failed?** (b-069)
- Concurrency control
- Trigger conditions
- Secure inputs
- **Configure run after** (correct)

Why: Configure run after lets an action run when the previous one failed, timed out or was skipped. That is how you build alternative error-handling paths.
Source: https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/error-handling

**24. In a try-catch-finally pattern, how are the try and catch blocks usually built?** (b-070)
- Switch actions with case labels
- **Scope actions with run-after settings** (correct)
- Child flows with response codes
- Apply to each loops with a limit

Why: Scopes group actions into blocks; with run-after settings an error-handling scope runs only if the main scope fails. That gives try/catch/finally patterns.
Source: https://learn.microsoft.com/en-us/power-automate/scopes

**25. Why is Filter array often better than a condition inside a loop?** (b-071)
- It reshapes every object in the array
- It sorts the array so the loop finishes sooner
- **It removes items first, so the loop handles fewer** (correct)
- It makes the loop run in parallel automatically

Why: Filter array removes non-matching items before later steps run, so a loop handles fewer items. It does not reshape items (that is Select) or make the loop parallel.
Source: https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/use-data-operations

**26. Which action returns values from a flow to the canvas app that called it?** (b-072)
- **Respond to a Power App or flow** (correct)
- Terminate
- Return to caller
- Set variable

Why: The Respond to a Power App or flow action (Power Apps connector) sends named outputs back to the caller. Terminate only ends the run.
Source: https://learn.microsoft.com/en-us/power-automate/create-child-flows

**27. How can an app read a text output named status from FlowName.Run?** (b-073)
- Param("status") after FlowName.Run
- FlowName.Output("status")
- **Set(r, FlowName.Run(...)) then use r.status** (correct)
- Get(FlowName, status)

Why: Store the result of FlowName.Run in a variable with Set, then read each output as a property such as r.status. Param() reads app launch parameters, not flow results.
Source: https://learn.microsoft.com/en-us/business-applications-release-notes/april18/microsoft-flow/return-data-powerapps

**28. What do environment variables let you do when moving a solution?** (b-074) [fixed]
- **Use different parameter values in each environment** (correct)
- Make a managed solution editable in Prod
- Skip solution checks during import
- Share one run history across environments

Why: Environment variables hold parameter values, such as a SharePoint site or list, that you set per environment on import, so apps and flows need no edits. They do not change managed-solution rules.
Source: https://learn.microsoft.com/en-us/power-apps/maker/data-platform/environmentvariables

**29. What does a connection reference do in a solution?** (b-075)
- Stores the connection password in the solution
- Replaces the data policy for a connector
- Lists everyone allowed to run the flow
- **Lets components use a connection chosen per environment** (correct)

Why: A connection reference is a solution component pointing to a connection. On import you pick a connection for the target environment, so flows are not tied to one person. It holds no password.
Source: https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-connection-reference

**30. Which Get items setting must be on to read more than 5,000 items from a list?** (b-076) [fixed]
- Concurrency control
- **Pagination** (correct)
- Trigger conditions
- Retry policy

Why: Get items returns 100 items by default and Top Count can only go up to 5,000. Turning on Pagination in the action settings lets it read past that, up to your plan paginated-items limit.
Source: https://learn.microsoft.com/en-us/sharepoint/dev/business-apps/power-automate/guidance/working-with-get-items-and-get-files

**31. What is the paginated items limit for flows outside the Low performance profile?** (b-077) [fixed]
- 10,000
- **100,000** (correct)
- 1,000
- 1,000,000

Why: The limits page lists paginated items as 5,000 for the Low performance profile and 100,000 for all others. Low covers free, Microsoft 365 and trial plans, so "most plans" was misleading.
Source: https://learn.microsoft.com/en-us/power-automate/limits-and-config

**32. Which SharePoint action returns one item when you know its ID?** (b-078)
- Get items
- Get attachments
- Get lists
- **Get item** (correct)

Why: Get item fetches a single item by its ID. Get items returns many; Get lists returns lists, and Get attachments returns files attached to an item.
Source: https://learn.microsoft.com/en-us/sharepoint/dev/business-apps/power-automate/sharepoint-connector-actions-triggers

**33. Which SharePoint action returns many items and accepts a Filter Query?** (b-079)
- **Get items** (correct)
- Get item
- Create item
- Update item

Why: Get items returns several items and has a Filter Query box in its advanced options. Get item takes one ID, and Create item or Update item write data.
Source: https://learn.microsoft.com/en-us/sharepoint/dev/business-apps/power-automate/guidance/working-with-get-items-and-get-files

**34. Which Filter Query in Get items returns rows where Status equals Approved?** (b-080)
- Status = 'Approved'
- Status == Approved
- **Status eq 'Approved'** (correct)
- WHERE Status = 'Approved'

Why: Filter Query uses OData: column name, operator eq, then the value in single quotes, e.g. Status eq 'Approved'. SQL style = or == and WHERE are not valid there.
Source: https://learn.microsoft.com/en-us/sharepoint/dev/business-apps/power-automate/guidance/working-with-get-items-and-get-files

**35. Where do you filter so the data source, not the flow, does the work?** (b-081)
- In a Condition after Get items
- In a Filter array after Get items
- In an Apply to each after Get items
- **In the Filter Query box of Get items** (correct)

Why: Filter Query makes SharePoint filter on the server so only matching items come back. Condition, Filter array and Apply to each all run after the full result is already fetched.
Source: https://learn.microsoft.com/en-us/sharepoint/dev/business-apps/power-automate/guidance/working-with-get-items-and-get-files

**36. In run history, how do you see what a failed action received?** (b-082)
- Check the environment's data policy list
- **Open the action and read its inputs and outputs** (correct)
- Open the app in Monitor
- Look at the list's version history

Why: Open the flow run from the 28-day run history, then select a step to see its inputs and outputs. Data policies, Monitor (for apps) and list version history do not show a step payload.
Source: https://learn.microsoft.com/en-us/power-automate/get-started-logic-flow

**37. Which cloud flow type starts when a user selects a button?** (b-083)
- Automated
- Scheduled
- **Instant** (correct)
- Desktop

Why: An instant (manual) cloud flow starts when you select a button, in Power Automate or the mobile app. Automated flows start on an event; scheduled flows start on a timer.
Source: https://learn.microsoft.com/en-us/power-automate/triggers-introduction

**38. Which cloud flow type starts when a new email arrives?** (b-084)
- **Automated** (correct)
- Instant
- Scheduled
- Attended

Why: An automated cloud flow starts on an event, such as When a new email arrives. Instant flows are started by hand and scheduled flows by the Recurrence trigger.
Source: https://learn.microsoft.com/en-us/power-automate/triggers-introduction

**39. Which approval type completes the request as soon as one approver approves?** (b-128) [added] [fixed]
- Approve/Reject - Everyone must approve
- Custom Responses - Wait for all responses
- **Approve/Reject - First to respond** (correct)
- Sequential approvals (one approver at a time)

Why: Approve/Reject - First to respond completes as soon as any one approver approves. Everyone must approve and Custom Responses - Wait for all both wait for every approver, and Sequential goes one at a time.
Source: https://learn.microsoft.com/en-us/power-automate/get-started-approvals

**40. Which action starts an approval and waits for the response in one step?** (b-129) [added]
- Create an approval
- Wait for an approval
- Send an approval email
- **Start and wait for an approval** (correct)

Why: Start and wait for an approval creates the request and pauses the flow until approvers respond. Create an approval only starts it, and Wait for an approval only waits.
Source: https://learn.microsoft.com/en-us/power-automate/get-started-approvals

**41. Which expression returns the current date and time in UTC?** (b-130) [added]
- now()
- **utcNow()** (correct)
- currentDate()
- today()

Why: utcNow() returns the current timestamp as a string in UTC. now(), today() and currentDate() are not functions in the workflow expression language.
Source: https://learn.microsoft.com/en-us/azure/logic-apps/expression-functions-reference

**42. Which expression returns the number of items in an array?** (b-131) [added]
- count(array)
- size(array)
- **length(array)** (correct)
- len(array)

Why: length() returns the number of items in an array (or string). count(), size() and len() are not functions in the workflow expression language.
Source: https://learn.microsoft.com/en-us/azure/logic-apps/expression-functions-reference

**43. What is the maximum run duration of a cloud flow?** (b-132) [added]
- **30 days** (correct)
- 24 hours
- 7 days
- 90 days

Why: A cloud flow run can last up to 30 days; pending steps such as approvals time out after that. The 90-day figure is a different limit, for flows with no trigger activity.
Source: https://learn.microsoft.com/en-us/power-automate/limits-and-config

**44. What is the default iteration limit of a Do until loop?** (b-133) [added]
- 10
- 100
- **60** (correct)
- 1,000

Why: A Do until loop defaults to 60 iterations (and a timeout), and the maximum you can set is 5,000.
Source: https://learn.microsoft.com/en-us/power-automate/limits-and-config

**45. With trigger concurrency turned on, what range of concurrent runs can you set?** (b-134) [added]
- **1 to 100** (correct)
- 1 to 10
- 1 to 25
- 1 to 500

Why: With Concurrency Control on, the trigger can allow 1 to 100 concurrent runs (default 25). With it off, concurrent runs are unlimited.
Source: https://learn.microsoft.com/en-us/power-automate/limits-and-config

**46. Which two values must an Initialize variable action define?** (b-135) [added]
- Name and owner
- Type and trigger
- Scope and owner
- **Name and type** (correct)

Why: Initialize variable requires a Name and a Type; the initial Value is optional but recommended. There is no scope or owner setting.
Source: https://learn.microsoft.com/en-us/power-automate/create-variable-store-values

## SharePoint (23)

**1. What is a SharePoint list?** (b-085) [fixed]
- A library for storing documents and folders
- A page for publishing news posts
- **A shareable collection of data organized in columns** (correct)
- A chat channel for a team

Why: A SharePoint list is a collection of data you can share, with columns for different types of data. A library is for files; news posts are pages.
Source: https://support.microsoft.com/en-us/sharepoint/lists/data-and-lists/what-is-a-list-in-microsoft-365

**2. Which data source supports business units and field-level security?** (b-086) [fixed]
- **Dataverse** (correct)
- A SharePoint list
- An Excel workbook
- A collection

Why: Dataverse offers business units, role-based and field-level security. A SharePoint list is secured by site roles and custom permissions, while Excel and collections have no such model.
Source: https://learn.microsoft.com/en-us/power-apps/teams/compare-data-sources

**3. Which Microsoft 365 app can create a list from blank, a template or Excel?** (b-087)
- Power BI
- Microsoft Planner
- OneNote
- **Microsoft Lists** (correct)

Why: The Microsoft Lists app can start a list from blank, a template, an existing list, Excel or CSV. Power BI, Planner and OneNote do not create SharePoint lists.
Source: https://support.microsoft.com/en-us/sharepoint/lists/data-and-lists/create-a-list

**4. What does a Person or Group column store?** (b-088)
- Only free text typed by users
- **A user or group from the directory** (correct)
- A link to an item in another list
- A file stored in a library

Why: A Person or Group column gives a searchable list of people and groups to pick from. Free text is Single line of text; a link to another list is a Lookup.
Source: https://support.microsoft.com/en-us/sharepoint/lists/data-and-lists/list-and-library-column-types-and-options

**5. What does a Lookup column do?** (b-089)
- Searches the whole tenant for matching text
- **Shows values stored in another list on the same site** (correct)
- Calculates a value from other columns
- Offers a fixed list of typed-in options

Why: A Lookup column lets people pick values already stored in another list or library on the same site. Calculated columns use formulas; Choice columns have typed-in options.
Source: https://support.microsoft.com/en-us/sharepoint/lists/data-and-lists/list-and-library-column-types-and-options

**6. To limit a column to values already stored in the site, which type do you use?** (b-090)
- Choice
- Single line of text
- Calculated
- **Lookup** (correct)

Why: Lookup lets people choose values based on information already stored in the site. Choice offers options you type in yourself, so it does not reuse stored site data.
Source: https://support.microsoft.com/en-us/sharepoint/lists/data-and-lists/list-and-library-column-types-and-options

**7. What is a calculated column?** (b-091)
- **A column whose value comes from a formula on other columns** (correct)
- A column that sums every item in the list
- A column that copies values from another list
- A column users fill by choosing from options

Why: A calculated column displays a value computed from a formula, typically using other columns of the same item. It does not total the whole list or copy from another list.
Source: https://support.microsoft.com/en-us/sharepoint/lists/data-and-lists/list-and-library-column-types-and-options

**8. When does a SharePoint calculated column recalculate?** (b-092)
- Every night at midnight
- Every time the list view opens
- **When the item is created or edited** (correct)
- Whenever the current date changes

Why: A calculated column is evaluated when an item is created or edited. A [Today] result is a snapshot that goes stale until the item is saved again; it does not refresh nightly or on view open.
Source: https://learn.microsoft.com/en-us/answers/questions/5381956/use-today()-function-in-sharepoint-list

**9. TODAY in a calculated column is a snapshot. What keeps date logic current?** (b-093) [fixed]
- Turning on versioning for the list
- Setting the column as indexed
- Using [Today] inside the column formula
- **A daily flow that writes today's date to a column** (correct)

Why: TODAY in a calculated column is only a snapshot taken when the item is saved. Microsoft suggests a daily flow that writes today's date to a normal Date column and basing comparisons on that.
Source: https://learn.microsoft.com/en-us/answers/questions/5381956/use-today()-function-in-sharepoint-list

**10. Where can you find a column's internal name?** (b-094)
- In the list's Title column
- **In the Field= part of the column settings page URL** (correct)
- In the column's description box
- In the site's audit log

Why: Open the column settings and read the Field= parameter at the end of the URL; it shows the internal name, with spaces encoded as _x0020_.
Source: https://pnp.github.io/community-docs/articles/sharepoint-naming-guidelines.html

**11. What happens to a column's internal name when you rename the column?** (b-095)
- It changes to match the new display name
- It updates the next time the list is indexed
- **It stays as it was when the column was created** (correct)
- It is deleted until you set it again

Why: The internal name is set once when the column is created and cannot change. Renaming only changes the display name, which is why filters should use the original internal name.
Source: https://pnp.github.io/community-docs/articles/sharepoint-naming-guidelines.html

**12. By default, where does a SharePoint list get its permissions?** (b-096)
- **It inherits them from its parent site** (correct)
- From the app that uses the list
- From the user who created the first item
- From the tenant global admin only

Why: By default lists and libraries inherit permissions from the site above them. Apps using the list and the first item author do not set its permissions.
Source: https://support.microsoft.com/en-us/office/edit-permissions-for-a-list-library-or-individual-item-02d770f3-59eb-4910-a608-5f84cc297782

**13. What must you do before giving a list its own unique permissions?** (b-097)
- Convert the list to a library
- Enable item-level versioning
- **Stop inheriting permissions for the list** (correct)
- Reset the site collection

Why: You must break (stop) permission inheritance before assigning unique permissions to a list or library. Versioning or converting it to a library is not needed.
Source: https://support.microsoft.com/en-us/office/edit-permissions-for-a-list-library-or-individual-item-02d770f3-59eb-4910-a608-5f84cc297782

**14. Which statement about the Title column of a SharePoint list is correct?** (b-098) [fixed]
- **It is built in and cannot be deleted** (correct)
- It can be deleted once an app uses the list
- It is added only when a Person column exists
- It is created only for lists built from Excel

Why: Lists contain required columns that cannot be deleted, such as Title. It exists in every list; it is not created only for Excel imports or Person columns.
Source: https://support.microsoft.com/en-us/office/delete-a-column-in-a-list-or-library-72cfd78d-dcca-4fa6-b499-c89214917604

**15. What happens when SubmitForm runs and a required field is blank?** (b-099)
- The record saves with a blank value
- The form fills in the value with zero
- The app closes with a runtime error
- **Validation fails and the form's OnFailure runs** (correct)

Why: SubmitForm validates first. A blank required field sets the error properties, nothing is saved and the form OnFailure formula runs. It does not save blank, default to zero or crash the app.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-form-detail

**16. A list column is required and has no default. What must Create item supply?** (b-100)
- Nothing, SharePoint fills it in
- **A value for that column** (correct)
- An approval for the new item
- A second Update item action

Why: When a flow inserts or updates an item it must provide data for all required columns; the action marks them with an asterisk. SharePoint does not fill them in for you.
Source: https://learn.microsoft.com/en-us/power-automate/odata-filters

**17. When a flow inserts or updates an item, which columns must it provide data for?** (b-101) [replaced]
- Every column in the list
- **All required columns** (correct)
- Only the first three columns
- Only columns changed since the last run

Why: The docs say you must provide data for all required columns when you insert or update an item. A required column therefore forces every app and flow that writes to the list to supply it.
Source: https://learn.microsoft.com/en-us/power-automate/odata-filters

**18. Which Person column sub-fields can be delegated to SharePoint?** (b-122) [added]
- **Email and DisplayName** (correct)
- Department and JobTitle
- Picture and Manager
- All sub-fields

Why: For Person columns only Email and DisplayName are delegable. Other sub-fields are filtered locally, within the data row limit.
Source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections/connection-sharepoint-online

**19. What is the SharePoint list view threshold for a single query?** (b-123) [added]
- 500 items
- 2,000 items
- 30 million items
- **5,000 items** (correct)

Why: The list view threshold is 5,000 items for a single query or view operation. A list can hold up to 30 million items, but queries must stay within the threshold.
Source: https://support.microsoft.com/en-us/sharepoint/lists/data-and-lists/list-view-threshold-for-large-lists-and-libraries

**20. How can you keep views on a large list working under the threshold?** (b-124) [added]
- Turn on versioning for the list
- **Index the filtered columns and filter views** (correct)
- Add more Person columns
- Rename the list

Why: Use indexed columns with filtered views so each query returns fewer than 5,000 items. Versioning, extra Person columns or renaming do nothing for the threshold.
Source: https://support.microsoft.com/en-us/sharepoint/lists/data-and-lists/list-view-threshold-for-large-lists-and-libraries

**21. How many lookup columns can Get items return before the flow fails?** (b-125) [added]
- 5
- **12** (correct)
- 20
- 50

Why: Get items and Get files return items with at most 12 lookup columns. If the list has more, the flow fails.
Source: https://learn.microsoft.com/en-us/sharepoint/dev/business-apps/power-automate/sharepoint-connector-actions-triggers

**22. Which SharePoint feature lets you view and restore earlier item values?** (b-126) [added]
- Recycle bin
- Alerts
- Content types
- **Version history** (correct)

Why: Version history lets you view earlier versions of an item and restore one as the current version. The recycle bin only recovers deleted items.
Source: https://support.microsoft.com/en-us/sharepoint/lists/documents-and-library/how-versioning-works-in-lists-and-libraries

**23. Which column type offers a fixed set of options defined in column settings?** (b-127) [added]
- **Choice** (correct)
- Lookup
- Person or Group
- Calculated

Why: Choice lets people pick from a list of options that you provide in the column settings. Lookup pulls values already stored in the site instead.
Source: https://support.microsoft.com/en-us/sharepoint/lists/data-and-lists/list-and-library-column-types-and-options

## Power Platform (13)

**1. What is an unmanaged solution in Power Platform?** (b-054)
- A locked solution that cannot be edited
- A solution with no components
- A solution only valid in the default environment
- **An editable solution used while developing** (correct)

Why: Unmanaged solutions are the editable, development form used in development environments. Managed solutions are the locked ones deployed to test and production.
Source: https://learn.microsoft.com/en-us/power-platform/alm/solution-concepts-alm

**2. How can a canvas app send a collection to a flow?** (b-102)
- Pass the collection name as the parameter
- Use Patch to write to the flow
- Set the collection as the flow trigger
- **Convert it with JSON() and pass the text** (correct)

Why: A table cannot be passed to a flow directly. Microsoft sample builds text with JSON(collection), passes it to Flow.Run, and the flow decodes it with Parse JSON.
Source: https://learn.microsoft.com/en-us/power-platform/sap/templates/sap-procurement/administer/extend-cloud-flows

**3. Which flow action turns the JSON text sent by the app back into fields?** (b-103)
- **Parse JSON** (correct)
- Compose
- Select
- Join

Why: Parse JSON turns a JSON string into structured fields you can use as dynamic content. Compose stores a value, Select reshapes arrays, and Join glues values into text.
Source: https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/use-data-operations

**4. How do you limit an instant flow to chosen people?** (b-104)
- Give the flow a hard-to-guess name
- Hide the flow inside the Default solution
- **Share it only with those people as run-only users** (correct)
- Turn off the flow's run history

Why: Instant flows can be shared with chosen users or groups as run-only users, who can trigger but not edit them. Obscure names, hidden solutions or no run history give no access control.
Source: https://learn.microsoft.com/en-us/power-automate/create-team-flows

**5. What can a run-only user do with a shared flow?** (b-105)
- Edit and delete it
- Change its owner
- Add co-owners
- **Run it but not edit it** (correct)

Why: Run-only users can only trigger the flow. Owners, not run-only users, can edit, delete and add other owners.
Source: https://learn.microsoft.com/en-us/power-automate/create-team-flows

**6. Which solution type should be imported into test and production environments?** (b-106)
- Unmanaged
- **Managed** (correct)
- The Default solution
- Any type, there is no difference

Why: Unmanaged solutions are for development. Managed solutions are deployed to any environment that is not the dev environment, including test, UAT and production.
Source: https://learn.microsoft.com/en-us/power-platform/alm/solution-concepts-alm

**7. What happens when you delete (uninstall) a managed solution?** (b-107)
- Its components move to the Default solution
- Only the solution container is deleted
- **Its components are removed from the environment** (correct)
- Its components stay but become locked

Why: Deleting (uninstalling) a managed solution removes all customizations and components it contains. Deleting an unmanaged solution only removes the container, which is the tempting wrong answer.
Source: https://learn.microsoft.com/en-us/power-platform/alm/solution-concepts-alm

**8. What is the standard way to move an app and its flow from Dev to Prod?** (b-108)
- **Export a solution from Dev and import it into Prod** (correct)
- Email the app file to the Prod users
- Re-create the app by hand in Prod
- Share the Dev app with the Prod environment

Why: Solutions transport apps, flows and other components from one environment to another: export from Dev, import into Prod. Emailing app files or re-creating by hand is unmanaged and error-prone.
Source: https://learn.microsoft.com/en-us/power-apps/maker/data-platform/solutions-overview

**9. Which Power Platform feature deploys solutions to test and Prod from Dev?** (b-109)
- Solution checker
- App checker
- **Pipelines in Power Platform** (correct)
- Monitor

Why: Pipelines in Power Platform deploy solutions to test and production environments from the maker's dev environment. Solution checker and App checker only analyze quality; Monitor debugs apps.
Source: https://learn.microsoft.com/en-us/power-apps/maker/data-platform/solutions-overview

**10. Which admin feature groups connectors as Business, Non-business or Blocked?** (b-136) [added]
- Connection references
- **Data policies (DLP)** (correct)
- Environment variables
- Security roles

Why: Data policies (formerly DLP) sort connectors into Business, Non-business and Blocked groups. Connection references and environment variables are solution components.
Source: https://learn.microsoft.com/en-us/power-platform/admin/prevent-data-loss

**11. What does a data policy prevent within one app or flow?** (b-137) [added]
- Using more than one connector of any kind
- **Mixing Business and Non-business connectors** (correct)
- Sharing the app with external guests
- Exceeding a daily run quota

Why: Connectors in the Business group cannot share data with Non-business or Blocked connectors, so one app or flow cannot mix them. Policies do not limit run quotas or sharing.
Source: https://learn.microsoft.com/en-us/power-platform/admin/prevent-data-loss

**12. What is an environment in Power Platform?** (b-138) [added]
- A single screen in a canvas app
- A license assigned to one user
- A table in Dataverse
- **A container that separates apps, flows and data** (correct)

Why: An environment is a space to store, manage and share apps, flows and data, and a container that separates them by role, security or audience, for example Dev, Test and Prod.
Source: https://learn.microsoft.com/en-us/power-platform/admin/environments-overview

**13. What is Microsoft Dataverse?** (b-139) [added]
- **A data platform with tables, relationships and security** (correct)
- A cloud file share for team documents
- A reporting service for dashboards
- A designer for cloud flows

Why: Dataverse stores data in tables of rows and columns with relationships and a security model of roles, business units and row or column security. Files and flows live elsewhere.
Source: https://learn.microsoft.com/en-us/power-apps/maker/data-platform/data-platform-intro
