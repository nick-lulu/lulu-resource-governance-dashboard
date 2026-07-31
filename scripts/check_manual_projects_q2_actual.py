from pathlib import Path
import json
import re

import pandas as pd


ACTUAL = Path(r"D:/pm/resource/1/填报工时原始数据_STK.xlsx")
OUTDIR = Path("outputs/resource_governance")
MANUAL = OUTDIR / "manual_q3_additions.json"


ALIASES = {
    "cve-2026-4-973 fix": [
        "cve-2026-4-973",
        "cve",
        "973",
    ],
    "Legacy to new pipeline migration": [
        "legacy to new pipeline",
        "legacy pipeline",
        "pipeline migration",
    ],
    "IP Protection - Baison Omni": [
        "ip protection",
        "baison",
        "omni",
    ],
    "IP Protection - Samplehub-WMS": [
        "ip protection",
        "samplehub",
        "wms",
    ],
    "Helios embedded XXL JOB update": [
        "helios",
        "xxl",
        "job update",
    ],
}

CURATED_PROJECT_NAME_MAP = {
    "cve-2026-4-973 fix": [],
    "Legacy to new pipeline migration": [
        "Legacy to New Pipeline Migration",
        "IP Protection Phase 2 - Pipeline Migration",
    ],
    "IP Protection - Baison Omni": [
        "IP Protection - Baison Omni",
    ],
    "IP Protection - Samplehub-WMS": [
        "IP Protection - Samplehub-WMS",
    ],
    "Helios embedded XXL JOB update": [
        "Helios embedded XXL JOB update",
    ],
}


def norm(v):
    if pd.isna(v):
        return ""
    return str(v).strip()


def contains_any(text, terms):
    low = text.lower()
    return any(term.lower() in low for term in terms)


manual = pd.DataFrame(json.loads(MANUAL.read_text(encoding="utf-8")))
manual_projects = sorted(manual["Project"].unique())
manual_resources = sorted(manual["Resource"].unique())

actual = pd.read_excel(ACTUAL, sheet_name="填报工时原始数据")
for col in ["姓名", "所属Space", "项目名称", "阶段名称", "任务包名称", "任务", "工时备注"]:
    if col in actual.columns:
        actual[col] = actual[col].map(norm)
actual["填写日期"] = pd.to_datetime(actual["填写日期"], errors="coerce")
actual["填报工时"] = pd.to_numeric(actual["填报工时"], errors="coerce").fillna(0)
actual["search_text"] = (
    actual["项目名称"] + " | " + actual["阶段名称"] + " | " + actual["任务包名称"] + " | " + actual["任务"] + " | " + actual["工时备注"]
)

q2 = actual[(actual["填写日期"] >= "2026-05-01") & (actual["填写日期"] <= "2026-07-31")].copy()

rows = []
detail_rows = []
for project in manual_projects:
    terms = ALIASES[project]
    mask = q2["search_text"].map(lambda x: contains_any(x, terms))
    matched = q2[mask].copy()
    matched_manual_people = matched[matched["姓名"].isin(manual_resources)].copy()
    manual_md = manual.loc[manual["Project"].eq(project), "MD"].sum()
    rows.append({
        "Manual Q3 Project": project,
        "Manual Q3 Planned MD": round(manual_md, 2),
        "Q2 Actual Matched MD - all people": round(matched["填报工时"].sum() / 8, 2),
        "Q2 Actual Matched MD - manual resources": round(matched_manual_people["填报工时"].sum() / 8, 2),
        "Matched Rows": int(len(matched)),
        "Matched Project Names": "; ".join(sorted(matched["项目名称"].dropna().unique())[:8]),
        "Matched People": "; ".join(sorted(matched["姓名"].dropna().unique())[:12]),
    })
    detail = matched.groupby(["项目名称", "姓名"], dropna=False)["填报工时"].sum().reset_index()
    for _, r in detail.iterrows():
        detail_rows.append({
            "Manual Q3 Project": project,
            "Actual Project Name": r["项目名称"],
            "Person": r["姓名"],
            "Q2 Actual MD": round(r["填报工时"] / 8, 2),
        })

summary = pd.DataFrame(rows).sort_values("Manual Q3 Planned MD", ascending=False)
details = pd.DataFrame(detail_rows).sort_values(["Manual Q3 Project", "Q2 Actual MD"], ascending=[True, False])

summary.to_csv(OUTDIR / "manual_projects_q2_actual_match.csv", index=False, encoding="utf-8-sig")
details.to_csv(OUTDIR / "manual_projects_q2_actual_match_detail.csv", index=False, encoding="utf-8-sig")

curated_rows = []
for project, actual_project_names in CURATED_PROJECT_NAME_MAP.items():
    matched = q2[q2["项目名称"].isin(actual_project_names)].copy()
    manual_md = manual.loc[manual["Project"].eq(project), "MD"].sum()
    people = matched.groupby("姓名", dropna=False)["填报工时"].sum().reset_index()
    people = people[people["填报工时"] > 0].copy()
    people["MD"] = people["填报工时"] / 8
    top_people = "; ".join(
        f"{r['姓名']} {r['MD']:.1f}MD"
        for _, r in people.sort_values("MD", ascending=False).head(4).iterrows()
    )
    curated_rows.append({
        "Project": project,
        "Q2 Actual Trace MD": round(matched["填报工时"].sum() / 8, 2),
        "Q3 Planned MD": round(manual_md, 2),
        "Evidence": "Q2 actual exists in timesheet project name" if len(matched) else "No exact Q2 project-name actual found",
        "Matched Q2 Project Names": "; ".join(actual_project_names) if actual_project_names else "",
        "Top Q2 Contributors": top_people,
    })

curated = pd.DataFrame(curated_rows)
curated.to_csv(OUTDIR / "manual_projects_q2_actual_curated.csv", index=False, encoding="utf-8-sig")
(OUTDIR / "manual_projects_q2_actual_curated.json").write_text(
    curated.to_json(orient="records", force_ascii=False, indent=2),
    encoding="utf-8",
)

print(summary.to_string(index=False))
print("\nDETAIL TOP")
print(details.head(60).to_string(index=False))
print("\nCURATED")
print(curated.to_string(index=False))
