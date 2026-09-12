Budget Optimizer

A personal budget optimization tool built with Google Sheets and Google Apps Script.

Overview

Most people track their expenses. Very few optimize them. This project is a small decision-support tool that takes a monthly income, a list of expense categories and a priority level for each category, and returns an optimized allocation that maximizes net savings while respecting realistic constraints.

It runs entirely inside Google Sheets. No installation, no server, no external service. The user fills the dashboard, assigns priorities, presses one button, and reads the recommended reductions.

Problem

A budget is not a list of numbers. It is a set of tradeoffs. When income is fixed and expenses exceed what is reasonable to spend, something has to give. The question is what, and by how much, without breaking essential categories.

Doing this by hand is slow and subjective. Doing it with a spreadsheet formula is limited, because the problem involves multiple interacting constraints. Doing it with a small optimization script is precise, transparent and repeatable.

This is the gap the project fills.

Mathematical formulation

The problem is formulated as a linear optimization under constraints.

Let I be the total monthly income. Let c_i be the current expense for category i, and x_i the optimized expense for the same category. The number of categories is n.

Objective. Maximize net savings:

    E = I - sum(x_i)

Since I is constant for a given month, maximizing E is equivalent to minimizing the total sum of expenses:

    minimize sum(x_i) for i = 1 to n

Constraints.

Non-negativity: every optimized expense must be positive.

    x_i >= 0

Minimum reduction floor: no category can be cut below 40 percent of its original amount. This protects essential spending from being wiped out.

    x_i >= 0.4 * c_i

Coherence cap: no category can be increased above its original amount. The tool only reduces.

    x_i <= c_i

Global budget cap: total optimized expenses cannot exceed 50 percent of monthly income.

    sum(x_i) <= 0.5 * I

Integration of priorities

Each category receives a priority p_i between 1 and 10, where 10 means essential and 1 means very cuttable. The priority is converted into a weight:

    w_i = 11 - p_i

A high priority gives a low weight, so the category is protected. A low priority gives a high weight, so the category is cut first. This converts a subjective human judgment into an objective mathematical criterion.

Algorithm

The optimizer uses a greedy approach, which is exact for this formulation because the constraints are linear and the objective is monotone.

1. Compute the excess: total current expenses minus the allowed cap of 50 percent of income.
2. Sort the categories by decreasing weight, meaning lowest priority first.
3. For each category in order, reduce it as much as possible without going below its 40 percent floor.
4. Stop when the excess is fully absorbed.
5. Verify constraints and write the results.

Because each category has a fixed reduction capacity and reductions are independent, the greedy order produces the maximum possible total reduction at each step. This is why the algorithm is simple and still correct.

How to use the tool

1. Open the Google Sheet.
2. In the DASHBOARD sheet, select a year and a month.
3. Click the Optimize button. A table of expense categories for the selected month appears.
4. Assign a priority between 1 and 10 to each category.
5. Click Submit Optimization.
6. The script computes the optimized allocation, updates the KPIs, writes the recommendation table on the DASHBOARD sheet, and stores the full comparison on the MODEL sheet.

The recommendation table shows, for each reduced category, the current amount, the optimized amount, the amount saved and the reduction percentage.

Why not the built-in Solver

Google Sheets includes a Solver add-on, but it was not used for three reasons.

It is not fully automatable from Apps Script, so the user would need to trigger it manually every time. Its configuration is complex for non-expert users. It does not adapt to the pedagogical goal of the project, which is to show the reasoning inside the computation.

Google Apps Script gives full control, full transparency and full automation.

Repository contents

The src folder contains Code.gs, the complete Google Apps Script implementation.

The report folder contains the project report as a PDF.

How to deploy

1. Create a new Google Sheet.
2. Open Extensions, then Apps Script.
3. Paste the content of src/Code.gs into the editor.
4. Save the project.
5. Return to the spreadsheet and refresh. The custom menu and buttons become available.

The script expects the spreadsheet to contain three sheets named DASHBOARD, BUDGET and MODEL, and a set of named ranges including year_select, month_select, total_income, optimization_status and the KPI cells. These are part of the workbook structure, not of the script itself.

Limitations

The tool assumes that the user enters accurate numbers. The optimization is deterministic, so the same inputs always produce the same output. The reduction floor of 40 percent is a fixed constant, not user-tunable. The objective is single: minimize total expenses. A multi-objective version could balance savings against quality of life, but that is out of scope.

What I learned

Linear optimization does not require a heavy solver. When the structure of a problem is simple and monotone, a greedy algorithm is exact and transparent.

Translating a subjective judgment (priority) into a mathematical weight makes the result reproducible and explainable.

A small tool built inside a familiar environment (a spreadsheet) has more chance of being used than a technically superior tool the user has to learn.

Author

Oumaima Yaakoubi
Instrumentation and Intelligent Systems, INSAT, Tunisia
LinkedIn: linkedin.com/in/oumaima-yaakoubi
GitHub: github.com/o-Yaakoubi

License

MIT License. See the LICENSE file for details.