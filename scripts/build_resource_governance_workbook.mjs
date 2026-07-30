import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outDir = path.resolve("outputs/resource_governance");
const outputPath = path.join(outDir, "Resource_Governance_Gap_Analysis.xlsx");

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(outDir, name), "utf8"));
}

const overview = await readJson("overview.json");
const resources = await readJson("resource_summary.json");
const projects = await readJson("project_summary.json");
const monthly = await readJson("monthly_summary.json");
const gaps = await readJson("gap_list.json");
const dedicated = await readJson("dedicated_projects.json");

const workbook = Workbook.create();

const colors = {
  navy: "#17324D",
  teal: "#0F766E",
  blue: "#2563EB",
  amber: "#B45309",
  red: "#B91C1C",
  green: "#15803D",
  grayText: "#64748B",
  lightBlue: "#EAF3FF",
  lightTeal: "#E6F5F2",
  lightAmber: "#FFF7E6",
  lightRed: "#FEECEC",
  line: "#CBD5E1",
  header: "#E2E8F0",
};

function addSheet(name) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  return sheet;
}

function styleTitle(range) {
  range.format = {
    font: { bold: true, size: 18, color: colors.navy },
  };
}

function styleSection(range) {
  range.format = {
    fill: colors.navy,
    font: { bold: true, color: "#FFFFFF" },
  };
}

function styleHeader(range) {
  range.format = {
    fill: colors.header,
    font: { bold: true, color: colors.navy },
    borders: { preset: "all", style: "thin", color: colors.line },
  };
}

function styleBody(range) {
  range.format = {
    borders: {
      insideHorizontal: { style: "thin", color: "#E5E7EB" },
      bottom: { style: "thin", color: colors.line },
    },
  };
}

function writeTable(sheet, startRow, startCol, rows, columns, tableName) {
  const matrix = [columns, ...rows.map((r) => columns.map((c) => r[c] ?? ""))];
  const range = sheet.getRangeByIndexes(startRow, startCol, matrix.length, columns.length);
  range.values = matrix;
  styleHeader(sheet.getRangeByIndexes(startRow, startCol, 1, columns.length));
  if (matrix.length > 1) {
    styleBody(sheet.getRangeByIndexes(startRow + 1, startCol, matrix.length - 1, columns.length));
  }
  try {
    const table = sheet.tables.add(range.address, true, tableName);
    table.style = "TableStyleMedium2";
  } catch {}
  return range;
}

function applyNumberFormats(sheet, startRow, startCol, rowCount, columns, percentCols = []) {
  columns.forEach((c, i) => {
    const colRange = sheet.getRangeByIndexes(startRow + 1, startCol + i, Math.max(rowCount - 1, 1), 1);
    if (percentCols.includes(c)) {
      colRange.format.numberFormat = "0.0%";
    } else if (/MD|Hours/.test(c)) {
      colRange.format.numberFormat = "#,##0.0";
    }
  });
}

const dashboard = addSheet("Dashboard");
dashboard.getRange("A1:H1").merge();
dashboard.getRange("A1").values = [["Resource Governance - Step 2 Validation"]];
styleTitle(dashboard.getRange("A1"));
dashboard.getRange("A2:H2").merge();
dashboard.getRange("A2").values = [[
  "Scope: Space Operation resources plus dedicated QA for lululemon Charley team. MD = hours / 8. Q1=Feb-Apr, Q2=May-Jul, Q3=Aug-Oct.",
]];
dashboard.getRange("A2").format = { font: { color: colors.grayText }, wrapText: true };

const kpis = [
  ["Selected resources", overview.cohort_size, "10 Operation + 4 dedicated QA"],
  ["Q1 Actual", overview.total_q1_actual_md, "MD from timesheet"],
  ["Q2 Actual", overview.total_q2_actual_md, "MD from timesheet"],
  ["Q2 Plan", overview.total_q2_planned_md, "MD from resource plan"],
  ["Q2 Actual - Plan", overview.total_q2_gap_md, "Validation gap"],
  ["Q3 Forecast", overview.total_q3_forecast_md, "MD currently in plan"],
  ["Q3 vs Q2 Actual", overview.q3_vs_q2_actual_md, "Forecast completeness warning"],
];
dashboard.getRange("A4:C4").values = [["Metric", "Value", "Interpretation"]];
styleHeader(dashboard.getRange("A4:C4"));
dashboard.getRangeByIndexes(4, 0, kpis.length, 3).values = kpis;
styleBody(dashboard.getRangeByIndexes(4, 0, kpis.length, 3));
dashboard.getRange("B5:B11").format.numberFormat = "#,##0.0";

dashboard.getRange("E4:H4").merge();
dashboard.getRange("E4").values = [["Executive conclusion"]];
styleSection(dashboard.getRange("E4:H4"));
const conclusions = [
  ["1", "Charley is asking for resource governance, not just a static resource table. The target mechanism should connect Project -> Resource -> Capacity -> Timesheet -> Forecast -> Early Warning."],
  ["2", `Q2 actual exceeded Q2 plan by ${overview.total_q2_gap_md.toFixed(1)} MD. This is a material validation gap and should be reviewed by PM + resource owners before Q3 lock.`],
  ["3", `Q3 forecast is only ${overview.total_q3_forecast_md.toFixed(1)} MD versus Q2 actual ${overview.total_q2_actual_md.toFixed(1)} MD. Treat this as a forecast completeness risk, not as demand reduction, until project owners confirm.`],
  ["4", "Dedicated QA for lululemon team: Jade Zhang, Daisy Tang, Harry Shi, Mengyi Zhou. Their Q3 forecast is nearly empty, despite meaningful Q2 actual usage."],
];
dashboard.getRange("E5:F8").values = conclusions;
dashboard.getRange("E5:E8").format = { font: { bold: true, color: colors.navy } };
dashboard.getRange("F5:H8").merge(true);
dashboard.getRange("F5:H8").format = { wrapText: true, borders: { preset: "all", style: "thin", color: colors.line } };

dashboard.getRange("A14:D14").values = [["Month", "Actual MD", "Plan/Forecast MD", "Gap MD"]];
styleHeader(dashboard.getRange("A14:D14"));
const monthRows = monthly.map((r) => [r.Month, r["Actual MD"] ?? 0, r["Plan/Forecast MD"] ?? 0, (r["Actual MD"] ?? 0) - (r["Plan/Forecast MD"] ?? 0)]);
dashboard.getRangeByIndexes(14, 0, monthRows.length, 4).values = monthRows;
styleBody(dashboard.getRangeByIndexes(14, 0, monthRows.length, 4));
dashboard.getRangeByIndexes(14, 1, monthRows.length, 3).format.numberFormat = "#,##0.0";
const chart = dashboard.charts.add("line", dashboard.getRangeByIndexes(13, 0, monthRows.length + 1, 3));
chart.title = "Actual vs Plan / Forecast MD";
chart.hasLegend = true;
chart.xAxis = { axisType: "textAxis" };
chart.yAxis = { numberFormatCode: "#,##0" };
chart.setPosition("F14", "M30");

dashboard.getRange("A30:H30").merge();
dashboard.getRange("A30").values = [["Recommended governance actions"]];
styleSection(dashboard.getRange("A30:H30"));
dashboard.getRange("A31:H35").values = [
  ["Action", "Owner", "ETA", "Success check", "", "", "", ""],
  ["Freeze the resource cohort: Operation pool + four dedicated QA; confirm whether Yola Liang should be part of the official roster.", "PMO / Charley", "This week", "One approved roster used in plan, timesheet and dashboard.", "", "", "", ""],
  ["Backfill Q2 projects with actual but no plan, especially RFID inbound and Weather alert.", "Project PM", "This week", "No material actual-without-plan projects above 5 MD.", "", "", "", ""],
  ["Rebuild Q3 forecast from project demand and named resources.", "Project PM + Resource owner", "Before Q3 forecast lock", "Q3 forecast coverage is explainable against Q2 run-rate and project pipeline.", "", "", "", ""],
  ["Start weekly early-warning review for >90% utilization and >20% actual-plan variance.", "PMO", "Weekly", "Gap List has owner and ETA, reviewed in governance meeting.", "", "", "", ""],
];
styleHeader(dashboard.getRange("A31:D31"));
dashboard.getRange("A32:D35").format = { wrapText: true, borders: { preset: "all", style: "thin", color: colors.line } };

dashboard.getRange("A:A").format.columnWidth = 24;
dashboard.getRange("B:B").format.columnWidth = 16;
dashboard.getRange("C:C").format.columnWidth = 34;
dashboard.getRange("D:D").format.columnWidth = 44;
dashboard.getRange("E:E").format.columnWidth = 6;
dashboard.getRange("F:H").format.columnWidth = 31;
dashboard.getRange("A32:A35").format.columnWidth = 38;
dashboard.getRange("B32:B35").format.columnWidth = 22;
dashboard.getRange("C32:C35").format.columnWidth = 30;

const resourceSheet = addSheet("Resource Summary");
resourceSheet.getRange("A1").values = [["Resource-level actual, plan and Q3 forecast"]];
styleTitle(resourceSheet.getRange("A1"));
const resourceCols = ["Resource", "Space", "Dedicated", "Q1 Actual MD", "Q2 Actual MD", "Q2 Planned MD", "Q2 Actual - Plan MD", "Q2 Gap %", "Q3 Forecast MD", "Q3 Forecast - Q2 Actual MD", "Q3 vs Q2 %", "Q1 Utilization", "Q2 Utilization", "Q3 Forecast Utilization"];
writeTable(resourceSheet, 2, 0, resources, resourceCols, "ResourceSummary");
applyNumberFormats(resourceSheet, 2, 0, resources.length + 1, resourceCols, ["Q2 Gap %", "Q3 vs Q2 %", "Q1 Utilization", "Q2 Utilization", "Q3 Forecast Utilization"]);
resourceSheet.freezePanes.freezeRows(3);
resourceSheet.getRange("A:N").format.autofitColumns();

const projectSheet = addSheet("Project Gap");
projectSheet.getRange("A1").values = [["Project-level validation gap"]];
styleTitle(projectSheet.getRange("A1"));
const projectCols = ["Project", "Q1 Actual MD", "Q2 Actual MD", "Q2 Planned MD", "Q2 Actual - Plan MD", "Q2 Gap %", "Q3 Forecast MD", "Q3 Forecast - Q2 Actual MD", "Q3 vs Q2 %"];
writeTable(projectSheet, 2, 0, projects, projectCols, "ProjectGap");
applyNumberFormats(projectSheet, 2, 0, projects.length + 1, projectCols, ["Q2 Gap %", "Q3 vs Q2 %"]);
projectSheet.freezePanes.freezeRows(3);
projectSheet.getRange("A:I").format.autofitColumns();
projectSheet.getRange("A:A").format.columnWidth = 58;

const gapSheet = addSheet("Gap List");
gapSheet.getRange("A1").values = [["Gap List + Owner + ETA"]];
styleTitle(gapSheet.getRange("A1"));
const gapCols = ["Gap Type", "Object", "Finding", "Owner", "ETA", "Priority"];
writeTable(gapSheet, 2, 0, gaps, gapCols, "GapList");
gapSheet.freezePanes.freezeRows(3);
gapSheet.getRange("A:F").format.autofitColumns();
gapSheet.getRange("B:B").format.columnWidth = 48;
gapSheet.getRange("C:C").format.columnWidth = 72;
gapSheet.getRange("C:C").format.wrapText = true;

const dedicatedSheet = addSheet("Dedicated QA Detail");
dedicatedSheet.getRange("A1").values = [["Dedicated QA project allocation detail"]];
styleTitle(dedicatedSheet.getRange("A1"));
const dedicatedCols = ["Source", "姓名", "项目名称", "Quarter", "小时", "MD"];
writeTable(dedicatedSheet, 2, 0, dedicated, dedicatedCols, "DedicatedQA");
applyNumberFormats(dedicatedSheet, 2, 0, dedicated.length + 1, dedicatedCols);
dedicatedSheet.freezePanes.freezeRows(3);
dedicatedSheet.getRange("A:F").format.autofitColumns();
dedicatedSheet.getRange("C:C").format.columnWidth = 58;

const methods = addSheet("Method & Assumptions");
methods.getRange("A1").values = [["Method and assumptions"]];
styleTitle(methods.getRange("A1"));
methods.getRange("A3:B14").values = [
  ["Source - plan", "D:/pm/resource/1/计划工时按工作-STK.xlsx, Sheet3 only"],
  ["Source - actual", "D:/pm/resource/1/填报工时原始数据_STK.xlsx, by人员统计表 used as the stated selection reference; raw timesheet sheet used for exact date/project allocation."],
  ["Cohort", "Rows where 所属Space = Operation, plus dedicated QA names: Jade Zhang, Daisy Tang, Harry Shi, Mengyi Zhou."],
  ["MD conversion", "MD = hours / 8."],
  ["Q1", "2026-02-01 to 2026-04-30"],
  ["Q2", "2026-05-01 to 2026-07-31"],
  ["Q3", "2026-08-01 to 2026-10-31"],
  ["Capacity proxy", "Weekdays in the quarter, excluding no local holiday calendar adjustment: Q1 64 MD/person, Q2 66 MD/person, Q3 65 MD/person."],
  ["Actual date", "Actual is assigned to quarter by 填写日期."],
  ["Plan/Forecast date", "Plan/Forecast is assigned to quarter by 统计日期."],
  ["Planning gap rule", "Actual exists in Q2 but plan is zero, or actual-plan variance is material."],
  ["Early warning rule", "Utilization >90%, or absolute actual-plan deviation >20% where denominator is available."],
];
styleHeader(methods.getRange("A3:B3"));
methods.getRange("A4:B14").format = { wrapText: true, borders: { preset: "all", style: "thin", color: colors.line } };
methods.getRange("A:A").format.columnWidth = 22;
methods.getRange("B:B").format.columnWidth = 105;

for (const sheet of [dashboard, resourceSheet, projectSheet, gapSheet, dedicatedSheet, methods]) {
  try {
    sheet.getUsedRange().format.autofitRows();
  } catch {}
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  maxChars: 2000,
});
console.log(errors.ndjson);

const preview = await workbook.render({ sheetName: "Dashboard", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(path.join(outDir, "dashboard_preview.png"), new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(outputPath);
