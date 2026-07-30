import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outDir = path.resolve("outputs/resource_governance");
const workbookPath = path.join(outDir, "Resource_Governance_Boss_Ready.xlsx");
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));

const check = await workbook.inspect({
  kind: "sheet,table",
  tableMaxRows: 4,
  tableMaxCols: 6,
  maxChars: 7000,
});
console.log(check.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  maxChars: 2000,
});
console.log(errors.ndjson);

for (const sheetName of ["Executive Summary", "Resource Plan", "Project Plan Gap", "Q3 Manual Additions", "Actions"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(outDir, `boss_ready_${sheetName.replaceAll(" ", "_")}.png`), new Uint8Array(await preview.arrayBuffer()));
}

console.log("boss-ready verified");
