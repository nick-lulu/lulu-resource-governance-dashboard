import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outDir = path.resolve("outputs/resource_governance");
const workbookPath = path.join(outDir, "Resource_Governance_Gap_Analysis.xlsx");
const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheetCheck = await workbook.inspect({
  kind: "sheet,table",
  tableMaxRows: 3,
  tableMaxCols: 6,
  maxChars: 6000,
});
console.log(sheetCheck.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  maxChars: 2000,
});
console.log(errors.ndjson);

for (const sheetName of ["Dashboard", "Resource Summary", "Project Gap", "Gap List", "Dedicated QA Detail", "Method & Assumptions"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(outDir, `${sheetName.replaceAll(" ", "_").replaceAll("&", "and")}.png`), new Uint8Array(await preview.arrayBuffer()));
}

console.log("verified");
