import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outDir = path.resolve("outputs/resource_governance");
const outputPath = path.join(outDir, "Resource_Governance_Boss_Ready.xlsx");

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(outDir, name), "utf8"));
}

const overview = await readJson("overview.json");
const resources = await readJson("resource_summary.json");
const projects = await readJson("project_summary.json");
const manual = await readJson("manual_q3_additions.json");
const gaps = await readJson("gap_list.json");

const workbook = Workbook.create();
const colors = {
  navy: "#17324D",
  teal: "#0F766E",
  blue: "#2563EB",
  amber: "#B45309",
  red: "#B91C1C",
  green: "#15803D",
  gray: "#64748B",
  line: "#CBD5E1",
  header: "#E2E8F0",
  paleBlue: "#EAF3FF",
  paleAmber: "#FFF7E6",
  paleRed: "#FEECEC",
};

function sheet(name) {
  const ws = workbook.worksheets.add(name);
  ws.showGridLines = false;
  return ws;
}

function title(r) {
  r.format = { font: { bold: true, size: 18, color: colors.navy } };
}

function header(r) {
  r.format = {
    fill: colors.header,
    font: { bold: true, color: colors.navy },
    borders: { preset: "all", style: "thin", color: colors.line },
  };
}

function section(r, fill = colors.navy) {
  r.format = { fill, font: { bold: true, color: "#FFFFFF" } };
}

function body(r) {
  r.format = { borders: { preset: "all", style: "thin", color: colors.line }, wrapText: true };
}

function writeTable(ws, row, col, rows, cols, name) {
  const matrix = [cols, ...rows.map((x) => cols.map((c) => x[c] ?? ""))];
  const range = ws.getRangeByIndexes(row, col, matrix.length, cols.length);
  range.values = matrix;
  header(ws.getRangeByIndexes(row, col, 1, cols.length));
  if (matrix.length > 1) body(ws.getRangeByIndexes(row + 1, col, matrix.length - 1, cols.length));
  try {
    const tbl = ws.tables.add(range.address, true, name);
    tbl.style = "TableStyleMedium2";
  } catch {}
  return range;
}

function fmtNumbers(ws, row, col, rowCount, cols, pctCols = []) {
  cols.forEach((c, i) => {
    const rg = ws.getRangeByIndexes(row + 1, col + i, Math.max(rowCount - 1, 1), 1);
    if (pctCols.includes(c)) rg.format.numberFormat = "0.0%";
    else if (/MD/.test(c)) rg.format.numberFormat = "#,##0.0";
  });
}

const exec = sheet("Executive Summary");
exec.getRange("A1:H1").merge();
exec.getRange("A1").values = [["Portfolio Resource Planning - Validation & Q3 Planned Adjustment"]];
title(exec.getRange("A1"));
exec.getRange("A2:H2").merge();
exec.getRange("A2").values = [["Scope: Operation resources + 4 dedicated QA. Q1=Feb-Apr, Q2=May-Jul, Q3=Aug-Oct. MD = hours / 8."]];
exec.getRange("A2").format = { font: { color: colors.gray }, wrapText: true };

exec.getRange("A4:H4").merge();
exec.getRange("A4").values = [["What Charley is really asking for"]];
section(exec.getRange("A4:H4"));
exec.getRange("A5:H7").merge(true);
exec.getRange("A5:H7").values = [
  ["This is not only a Resource table. It should become a Resource Governance mechanism: Project -> Resource -> Capacity -> Timesheet -> Forecast -> Early Warning."],
  ["Current work is Step 2 Validation: compare actual timesheet, resource plan and Q3 forecast, then expose planning gaps with owner and ETA."],
  ["The immediate risk is Q3 forecast completeness: known project efforts were not yet in the system, so adjusted planned MD is required for governance discussion."],
];
body(exec.getRange("A5:H7"));

const kpis = [
  ["Q1 Actual", overview.total_q1_actual_md, "Baseline actual effort"],
  ["Q2 Actual", overview.total_q2_actual_md, "Current run-rate baseline"],
  ["Q2 Planned", overview.total_q2_planned_md, "Resource plan baseline"],
  ["Q2 Actual - Plan", overview.total_q2_gap_md, "Validation gap to explain"],
  ["System Q3 Forecast", overview.total_q3_forecast_md, "Already in exported plan"],
  ["Manual Q3 Planned Add", overview.manual_q3_planned_add_md, "Known projects not yet reflected in system"],
  ["Adjusted Q3 Planned", overview.total_q3_adjusted_planned_md, "System forecast + manual additions"],
  ["Adjusted Q3 vs Q2 Actual", overview.q3_adjusted_vs_q2_actual_md, "Remaining forecast gap vs run-rate"],
];
exec.getRange("A10:C10").values = [["Metric", "MD", "Meaning"]];
header(exec.getRange("A10:C10"));
exec.getRangeByIndexes(10, 0, kpis.length, 3).values = kpis;
body(exec.getRangeByIndexes(10, 0, kpis.length, 3));
exec.getRange("B11:B18").format.numberFormat = "#,##0.0";

exec.getRange("E10:H10").merge();
exec.getRange("E10").values = [["Boss-ready conclusion"]];
section(exec.getRange("E10:H10"));
exec.getRange("E11:H17").merge(true);
exec.getRange("E11:H17").values = [
  [`1. Q2 actual effort is ${overview.total_q2_actual_md.toFixed(1)} MD, ${overview.total_q2_gap_md.toFixed(1)} MD higher than Q2 plan. This means plan-vs-actual governance is already needed.`],
  [`2. System Q3 forecast was only ${overview.total_q3_forecast_md.toFixed(1)} MD. After adding the 5 known projects, Q3 adjusted planned becomes ${overview.total_q3_adjusted_planned_md.toFixed(1)} MD.`],
  [`3. Even after adjustment, Q3 planned is still ${Math.abs(overview.q3_adjusted_vs_q2_actual_md).toFixed(1)} MD below Q2 actual. This should be treated as remaining forecast coverage gap, not capacity release.`],
  ["4. Dedicated QA: Jade Zhang, Daisy Tang, Harry Shi, Mengyi Zhou. Harry has a major Q3 manual planned add from IP Protection - Baison Omni."],
  ["5. Next step: lock the resource roster, confirm Q3 project pipeline, and run a weekly early-warning review using utilization and plan-vs-actual variance."],
  ["",],
  ["",],
];
body(exec.getRange("E11:H17"));

exec.getRange("A21:H21").merge();
exec.getRange("A21").values = [["Recommended talking track"]];
section(exec.getRange("A21:H21"), colors.teal);
exec.getRange("A22:H25").merge(true);
exec.getRange("A22:H25").values = [
  ["We built visibility across selected resources and compared actual vs plan. The data shows Q2 actual already exceeded plan materially."],
  ["The Q3 forecast exported from the system is incomplete because several known Q3 efforts are not yet reflected. I added them as manual planned additions, separately from system forecast."],
  ["The adjusted view is a more realistic governance baseline, but still not enough to explain Q3 demand versus Q2 run-rate."],
  ["Ask from Charley: confirm if this is the right cohort and ask PMs to complete Q3 forecast by project/resource before weekly governance starts."],
];
body(exec.getRange("A22:H25"));

exec.getRange("A:A").format.columnWidth = 28;
exec.getRange("B:B").format.columnWidth = 15;
exec.getRange("C:D").format.columnWidth = 30;
exec.getRange("E:H").format.columnWidth = 32;

const res = sheet("Resource Plan");
res.getRange("A1").values = [["Resource view - actual, system forecast and adjusted Q3 plan"]];
title(res.getRange("A1"));
const resCols = ["Resource", "Space", "Dedicated", "Q2 Actual MD", "Q2 Planned MD", "Q2 Actual - Plan MD", "Q3 Forecast MD", "Manual Q3 Planned Add MD", "Q3 Adjusted Planned MD", "Q3 Adjusted Utilization"];
const sortedRes = [...resources].sort((a, b) => (b["Q3 Adjusted Planned MD"] ?? 0) - (a["Q3 Adjusted Planned MD"] ?? 0));
writeTable(res, 2, 0, sortedRes, resCols, "BossResourcePlan");
fmtNumbers(res, 2, 0, sortedRes.length + 1, resCols, ["Q3 Adjusted Utilization"]);
res.freezePanes.freezeRows(3);
res.getRange("A:J").format.autofitColumns();

const proj = sheet("Project Plan Gap");
proj.getRange("A1").values = [["Project view - Q3 planned adjustment and validation gap"]];
title(proj.getRange("A1"));
const projCols = ["Project", "Q2 Actual MD", "Q2 Planned MD", "Q2 Actual - Plan MD", "Q3 Forecast MD", "Manual Q3 Planned Add MD", "Q3 Adjusted Planned MD"];
const topProjects = [...projects]
  .filter((p) => (p["Q2 Actual MD"] ?? 0) > 0 || (p["Q3 Adjusted Planned MD"] ?? 0) > 0)
  .sort((a, b) => (b["Q3 Adjusted Planned MD"] ?? 0) - (a["Q3 Adjusted Planned MD"] ?? 0));
writeTable(proj, 2, 0, topProjects, projCols, "BossProjectPlanGap");
fmtNumbers(proj, 2, 0, topProjects.length + 1, projCols);
proj.freezePanes.freezeRows(3);
proj.getRange("A:G").format.autofitColumns();
proj.getRange("A:A").format.columnWidth = 62;

const add = sheet("Q3 Manual Additions");
add.getRange("A1").values = [["Q3 manual planned additions - known projects not yet reflected in system forecast"]];
title(add.getRange("A1"));
const manualCols = ["Project", "Resource", "MD"];
writeTable(add, 2, 0, manual, manualCols, "Q3ManualAdditions");
fmtNumbers(add, 2, 0, manual.length + 1, manualCols);
add.freezePanes.freezeRows(3);
add.getRange("A:C").format.autofitColumns();
add.getRange("A:A").format.columnWidth = 42;

add.getRange("E3:H3").merge();
add.getRange("E3").values = [["Important note"]];
section(add.getRange("E3:H3"), colors.amber);
add.getRange("E4:H6").merge(true);
add.getRange("E4:H6").values = [
  ["These MD values are manual Q3 planned additions provided by Lulu team. They are separated from system Q3 forecast for auditability."],
  ["IP Protection - Samplehub-WMS includes Jacky twice in the input. This version keeps both entries and sums Jacky to 6 MD."],
  ["Leah Li is included as manual Operation planned MD per input, although she was not part of the original Operation + dedicated QA cohort."],
];
body(add.getRange("E4:H6"));
add.getRange("E:H").format.columnWidth = 28;

const actions = sheet("Actions");
actions.getRange("A1").values = [["Gap List + Owner + ETA"]];
title(actions.getRange("A1"));
const actionRows = [
  {
    Priority: "High",
    "Gap / Decision": "Q3 forecast still below Q2 actual run-rate after manual additions",
    Owner: "Charley / PMO",
    ETA: "Before Q3 forecast lock",
    "Expected Output": "Confirmed project pipeline and adjusted Q3 resource plan",
  },
  {
    Priority: "High",
    "Gap / Decision": "Q2 actual exceeded Q2 plan by 114.8 MD",
    Owner: "PM + Resource Owner",
    ETA: "This week",
    "Expected Output": "Explain major resource variances and update governance baseline",
  },
  {
    Priority: "High",
    "Gap / Decision": "System forecast missing known Q3 planned work",
    Owner: "Project PM",
    ETA: "This week",
    "Expected Output": "Backfill 5 manual Q3 projects into Resource Plan / Timesheet planning process",
  },
  {
    Priority: "Medium",
    "Gap / Decision": "Resource cohort needs official lock",
    Owner: "PMO / Charley",
    ETA: "This week",
    "Expected Output": "Confirm Operation pool + dedicated QA + whether Leah/Yola belong in governance scope",
  },
  {
    Priority: "Medium",
    "Gap / Decision": "Start weekly early-warning mechanism",
    Owner: "PMO",
    ETA: "Weekly",
    "Expected Output": "Track utilization >90%, actual-plan gap >20%, and actual-without-plan projects",
  },
];
const actionCols = ["Priority", "Gap / Decision", "Owner", "ETA", "Expected Output"];
writeTable(actions, 2, 0, actionRows, actionCols, "BossActions");
actions.freezePanes.freezeRows(3);
actions.getRange("A:E").format.autofitColumns();
actions.getRange("B:B").format.columnWidth = 58;
actions.getRange("E:E").format.columnWidth = 55;

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  maxChars: 2000,
});
console.log(errors.ndjson);

const preview = await workbook.render({ sheetName: "Executive Summary", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(path.join(outDir, "boss_ready_executive_summary.png"), new Uint8Array(await preview.arrayBuffer()));
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(outputPath);
