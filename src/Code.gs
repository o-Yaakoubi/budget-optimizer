/*********************************
 * CONSTANTS
 *********************************/
const MIN_RATIO = 0.4;
const EPSILON = 0.01;

/*********************************
 * 💲 CURRENCY HELPER
 *********************************/
function setCurrency_(range, value) {
  range.setValue(value);
  range.setNumberFormat('$#,##0.00');
}

/*********************************
 * KPI RESET
 *********************************/
function resetKPIs_() {
  const ss = SpreadsheetApp.getActive();
  [
    "total_current_expenses",
    "total_optimized_expenses",
    "total_savings",
    "net_savings",
    "optimized_net_savings",
    "extra_savings"
  ].forEach(name => ss.getRangeByName(name).setValue("-"));
}

/*********************************
 * CLEAR RECOMMENDATIONS
 *********************************/
function clearRecommendations_() {
  const dash = SpreadsheetApp.getActive().getSheetByName("DASHBOARD");
  dash.getRange(40,1,200,6).clearContent();
}

/*********************************
 * TOTAL INCOME (DO NOT TOUCH)
 *********************************/
function updateTotalIncome() {
  const ss = SpreadsheetApp.getActive();
  const budget = ss.getSheetByName("BUDGET");

  const year = ss.getRangeByName("year_select").getValue();
  const month = ss.getRangeByName("month_select").getValue();
  const totalIncomeCell = ss.getRangeByName("total_income");

  const key = month + String(year).slice(-2);

  const headers = budget.getRange(3,1,1,budget.getLastColumn()).getValues()[0];
  const col = headers.indexOf(key) + 1;
  if (!col) throw new Error("Income month not found");

  const labels = budget.getRange(5,2,budget.getLastRow()).getValues().flat();
  const idx = labels.indexOf("TOTAL");
  if (idx === -1) throw new Error("TOTAL income row not found");

  setCurrency_(totalIncomeCell, budget.getRange(5 + idx, col).getValue());
}

/*********************************
 * OPTIMIZE BUTTON
 *********************************/
function optimize() {
  const ss = SpreadsheetApp.getActive();
  const dash = ss.getSheetByName("DASHBOARD");
  const budget = ss.getSheetByName("BUDGET");

  clearRecommendations_();
  resetKPIs_();

  ss.getRangeByName("optimization_status").clearContent();
  dash.getRange("scroll_hint").clearContent();

  const month = dash.getRange("month_select").getValue();
  const year  = dash.getRange("year_select").getValue();
  if (!month || !year) throw new Error("Select month & year");

  const key = month + String(year).slice(-2);
  const headers = budget.getRange(11,1,1,budget.getLastColumn()).getValues()[0];
  const col = headers.indexOf(key) + 1;
  if (!col) throw new Error("Month not found");

  let r = 13;
  const rows = [];
  while (true) {
    const cat = budget.getRange(r,2).getValue();
    if (!cat || cat === "TOTAL") break;
    rows.push([cat, 5]);
    r++;
  }

  dash.getRange("A11:B1000").clearContent().clearDataValidations();
  dash.getRange("A11:B11").setValues([["Category","Priority"]]);

  if (rows.length) {
    dash.getRange(12,1,rows.length,2).setValues(rows);
    applyPriorityDropdown(dash.getRange(12,2,rows.length,1));
  }
}

/*********************************
 * PRIORITY DROPDOWN
 *********************************/
function applyPriorityDropdown(range) {
  range.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(
        ["1","2","3","4","5","6","7","8","9","10"], true
      )
      .build()
  );
}

/*********************************
 * SUBMIT OPTIMIZATION
 *********************************/
function submitOptimization() {
  const ss = SpreadsheetApp.getActive();
  const dash = ss.getSheetByName("DASHBOARD");
  const budget = ss.getSheetByName("BUDGET");
  const model = ss.getSheetByName("MODEL");
  const status = ss.getRangeByName("optimization_status");

  clearRecommendations_();
  status.clearContent();

  // ===== INCOME =====
  updateTotalIncome();
  const totalIncome =
    Number(ss.getRangeByName("total_income").getValue()) || 0;
  if (totalIncome <= 0) throw new Error("Total income is 0");

  // ===== MONTH / YEAR =====
  const month = ss.getRangeByName("month_select").getValue();
  const year  = ss.getRangeByName("year_select").getValue();
  const key = month + String(year).slice(-2);

  const headers = budget.getRange(11,1,1,budget.getLastColumn()).getValues()[0];
  const col = headers.indexOf(key) + 1;
  if (!col) throw new Error("Month not found");

  // ===== SAVINGS =====
  const totalSavings = readTotalFromTable_(
    budget,
    findSavingsStartRow_(budget),
    col
  );

  // ===== EXPENSES =====
  let r = 13;
  const categories = [];
  const current = [];

  while (true) {
    const cat = budget.getRange(r,2).getValue();
    if (!cat || cat === "TOTAL") break;
    categories.push(cat);
    current.push(Number(budget.getRange(r,col).getValue()) || 0);
    r++;
  }

  const currentExpenses = current.reduce((a,b)=>a+b,0);

  // ===== WRITE BASE KPIs =====
  setCurrency_(
    ss.getRangeByName("total_current_expenses"),
    currentExpenses
  );
  setCurrency_(
    ss.getRangeByName("total_savings"),
    totalSavings
  );
  setCurrency_(
    ss.getRangeByName("net_savings"),
    totalIncome - currentExpenses
  );

  // ===== PRIORITIES =====
  const priorities = dash
    .getRange(12,2,categories.length,1)
    .getValues()
    .map(v => Number(v[0]) || 5);

  const allowedExpenses = totalIncome * 0.5;

  // ===== OPTIMIZATION CORE =====
  let optimized = [...current];
  let excess = currentExpenses - allowedExpenses;
  let optimizationAttempted = false;

  if (excess > EPSILON) {
    optimizationAttempted = true;

    const min = current.map(v => v * MIN_RATIO);

    const items = current.map((v,i)=>({
      i,
      remaining: v - min[i],
      weight: 11 - priorities[i]
    })).sort((a,b)=>b.weight - a.weight);

    for (const it of items) {
      if (excess <= EPSILON) break;
      if (it.remaining <= 0) continue;

      const cut = Math.min(it.remaining, excess);
      optimized[it.i] -= cut;
      excess -= cut;
    }
  }

  const optimizedExpenses = optimized.reduce((a,b)=>a+b,0);
  const extraSavings = currentExpenses - optimizedExpenses;

  // ===== WRITE OPTIMIZED KPIs =====
  setCurrency_(
    ss.getRangeByName("total_optimized_expenses"),
    optimizedExpenses
  );
  setCurrency_(
    ss.getRangeByName("optimized_net_savings"),
    totalIncome - optimizedExpenses
  );
  setCurrency_(
    ss.getRangeByName("extra_savings"),
    extraSavings
  );

  // ===== MODEL OUTPUT =====
  model.clear();
  model.getRange(1,1,1,6).setValues([[
    "Category","Current","Optimized","Priority","Min","Max"
  ]]);

  categories.forEach((c,i)=>{
    model.getRange(i+2,1,1,6).setValues([[
      c,
      current[i],
      optimized[i],
      priorities[i],
      current[i] * MIN_RATIO,
      current[i]
    ]]);
  });

  // ===== STATUS =====
  status.setValue(
    optimizationAttempted
      ? "Optimization completed successfully."
      : "No optimization needed."
  ).setFontSize(22).setWrap(true);

  if (optimizationAttempted) {
    dash.getRange("scroll_hint")
      .setValue("⬇ Scroll down to see recommendations");
  }

  updateRecommendations(extraSavings);
}

/*********************************
 * RECOMMENDATIONS
 *********************************/
function updateRecommendations(extraSavings) {
  if (extraSavings <= EPSILON) return;

  const dash = SpreadsheetApp.getActive().getSheetByName("DASHBOARD");
  const model = SpreadsheetApp.getActive().getSheetByName("MODEL");

  const startRow = 40;
  dash.getRange(startRow,1,1,6).setValues([[
    "Category","Current","Optimized","You Save","Reduction %","Recommendation"
  ]]);

  const data = model.getRange(2,1,model.getLastRow()-1,3).getValues();

  const rows = data
    .filter(r => r[2] < r[1] - EPSILON)
    .map(r => {
      const saved = r[1] - r[2];
      const pct = Math.round(saved / r[1] * 100);
      return [
        r[0], r[1], r[2], saved, pct + "%",
        `Reduce ${r[0]} spending`
      ];
    });

  if (rows.length) {
    dash.getRange(startRow+1,1,rows.length,6).setValues(rows);
    dash.getRange(startRow+1,2,rows.length,3)
      .setNumberFormat('$#,##0.00');
  }
}

/*********************************
 * HELPERS
 *********************************/
function readTotalFromTable_(sheet, startRow, col) {
  for (let r=startRow; r<startRow+300; r++) {
    if (
      String(sheet.getRange(r,2).getValue())
        .toUpperCase() === "TOTAL"
    ) {
      return Number(sheet.getRange(r,col).getValue()) || 0;
    }
  }
  throw new Error("TOTAL row not found");
}

function findSavingsStartRow_(sheet) {
  const colB = sheet.getRange(1,2,sheet.getLastRow()).getValues();
  for (let i=0;i<colB.length;i++) {
    if (
      String(colB[i][0]).toUpperCase() === "SAVINGS"
    ) return i+2;
  }
  throw new Error("Savings table not found");
}
