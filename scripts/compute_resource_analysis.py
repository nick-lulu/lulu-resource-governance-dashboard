from pathlib import Path
import json
import math

import pandas as pd


PLAN = Path(r"D:/pm/resource/1/计划工时按工作-STK.xlsx")
ACTUAL = Path(r"D:/pm/resource/1/填报工时原始数据_STK.xlsx")
OUTDIR = Path("outputs/resource_governance")
OUTDIR.mkdir(parents=True, exist_ok=True)

DEDICATED_QA = ["Jade Zhang", "Daisy Tang", "Harry Shi", "Mengyi Zhou"]
HOURS_PER_MD = 8
MANUAL_Q3_ADDITIONS = [
    {"Project": "cve-2026-4-973 fix", "Resource": "Nick Han", "MD": 3.0},
    {"Project": "cve-2026-4-973 fix", "Resource": "Jacky Zhong", "MD": 1.0},
    {"Project": "cve-2026-4-973 fix", "Resource": "Jiarui Yang", "MD": 0.5},
    {"Project": "cve-2026-4-973 fix", "Resource": "Leah Li", "MD": 1.0},
    {"Project": "cve-2026-4-973 fix", "Resource": "Daisy Tang", "MD": 2.0},
    {"Project": "Legacy to new pipeline migration", "Resource": "Nick Han", "MD": 6.5},
    {"Project": "Legacy to new pipeline migration", "Resource": "Jacky Zhong", "MD": 3.5},
    {"Project": "Legacy to new pipeline migration", "Resource": "Jiarui Yang", "MD": 4.0},
    {"Project": "Legacy to new pipeline migration", "Resource": "Leah Li", "MD": 2.0},
    {"Project": "IP Protection - Baison Omni", "Resource": "Nick Han", "MD": 9.0},
    {"Project": "IP Protection - Baison Omni", "Resource": "Jacky Zhong", "MD": 3.0},
    {"Project": "IP Protection - Baison Omni", "Resource": "Jiarui Yang", "MD": 5.5},
    {"Project": "IP Protection - Baison Omni", "Resource": "Leah Li", "MD": 2.0},
    {"Project": "IP Protection - Baison Omni", "Resource": "Harry Shi", "MD": 16.0},
    {"Project": "IP Protection - Samplehub-WMS", "Resource": "Nick Han", "MD": 7.0},
    {"Project": "IP Protection - Samplehub-WMS", "Resource": "Jacky Zhong", "MD": 3.0},
    {"Project": "IP Protection - Samplehub-WMS", "Resource": "Jacky Zhong", "MD": 3.0},
    {"Project": "IP Protection - Samplehub-WMS", "Resource": "Leah Li", "MD": 2.0},
    {"Project": "Helios embedded XXL JOB update", "Resource": "Ryan Xu", "MD": 0.75},
    {"Project": "Helios embedded XXL JOB update", "Resource": "Nick Han", "MD": 3.625},
    {"Project": "Helios embedded XXL JOB update", "Resource": "Jacky Zhong", "MD": 2.5},
    {"Project": "Helios embedded XXL JOB update", "Resource": "Harry Shi", "MD": 2.0},
]
PERIODS = {
    "Q1 Actual": ("2026-02-01", "2026-04-30"),
    "Q2 Actual": ("2026-05-01", "2026-07-31"),
    "Q3 Forecast": ("2026-08-01", "2026-10-31"),
}


def clean_text(v):
    if pd.isna(v):
        return ""
    return str(v).strip()


def quarter_for_date(dt):
    if pd.isna(dt):
        return None
    for label, (start, end) in PERIODS.items():
        if pd.Timestamp(start) <= dt <= pd.Timestamp(end):
            return label
    return None


def fiscal_month(dt):
    if pd.isna(dt):
        return ""
    return pd.Timestamp(dt).strftime("%Y-%m")


def md(hours):
    return hours / HOURS_PER_MD


def pct(numer, denom):
    if denom == 0 or pd.isna(denom):
        return None
    return numer / denom


def capacity_md(start, end):
    return len(pd.bdate_range(start, end))


def normalize(df):
    for col in ["姓名", "所属Space", "项目名称", "阶段名称", "任务包名称", "任务", "任务状态"]:
        if col in df.columns:
            df[col] = df[col].map(clean_text)
    return df


def target_filter(df):
    return (df["所属Space"].eq("Operation")) | (df["姓名"].isin(DEDICATED_QA))


plan = normalize(pd.read_excel(PLAN, sheet_name="Sheet3"))
actual = normalize(pd.read_excel(ACTUAL, sheet_name="填报工时原始数据"))
actual_pivot = pd.read_excel(ACTUAL, sheet_name="by人员统计表", header=5)
actual_pivot["所属Space"] = actual_pivot["所属Space"].ffill().map(clean_text)
actual_pivot["姓名"] = actual_pivot["姓名"].map(clean_text)

plan["统计日期"] = pd.to_datetime(plan["统计日期"], errors="coerce")
actual["填写日期"] = pd.to_datetime(actual["填写日期"], errors="coerce")
plan["小时"] = pd.to_numeric(plan["每日计划工时"], errors="coerce").fillna(pd.to_numeric(plan["计划工时"], errors="coerce")).fillna(0)
actual["小时"] = pd.to_numeric(actual["填报工时"], errors="coerce").fillna(0)

plan_t = plan[target_filter(plan)].copy()
actual_t = actual[target_filter(actual)].copy()
plan_t["Quarter"] = plan_t["统计日期"].map(quarter_for_date)
actual_t["Quarter"] = actual_t["填写日期"].map(quarter_for_date)
plan_t["Month"] = plan_t["统计日期"].map(fiscal_month)
actual_t["Month"] = actual_t["填写日期"].map(fiscal_month)

plan_q = plan_t[plan_t["Quarter"].isin(["Q1 Actual", "Q2 Actual", "Q3 Forecast"])].copy()
actual_q = actual_t[actual_t["Quarter"].isin(["Q1 Actual", "Q2 Actual"])].copy()

manual_q3 = pd.DataFrame(MANUAL_Q3_ADDITIONS)
manual_q3["Source"] = "Manual Q3 planned addition"
manual_q3["Quarter"] = "Q3 Forecast"
manual_q3["小时"] = manual_q3["MD"] * HOURS_PER_MD
manual_q3["所属Space"] = "Operation"
manual_q3["姓名"] = manual_q3["Resource"]
manual_q3["项目名称"] = manual_q3["Project"]

cohort_names = sorted(set(plan_t["姓名"].dropna()) | set(actual_t["姓名"].dropna()) | set(manual_q3["姓名"].dropna()))
capacity = {
    label: capacity_md(start, end)
    for label, (start, end) in PERIODS.items()
}

def grouped(df, dims):
    out = df.groupby(dims, dropna=False)["小时"].sum().reset_index()
    out["MD"] = out["小时"].map(md)
    return out


resource_actual = grouped(actual_q, ["姓名", "所属Space", "Quarter"])
resource_plan = grouped(plan_q, ["姓名", "所属Space", "Quarter"])

resource_rows = []
for name in cohort_names:
    space = ""
    for source in [actual_t, plan_t]:
        vals = source.loc[source["姓名"].eq(name), "所属Space"].dropna().unique().tolist()
        vals = [v for v in vals if v]
        if vals:
            space = vals[0]
            break
    q1 = resource_actual.query("姓名 == @name and Quarter == 'Q1 Actual'")["MD"].sum()
    q1p = resource_plan.query("姓名 == @name and Quarter == 'Q1 Actual'")["MD"].sum()
    q2a = resource_actual.query("姓名 == @name and Quarter == 'Q2 Actual'")["MD"].sum()
    q2p = resource_plan.query("姓名 == @name and Quarter == 'Q2 Actual'")["MD"].sum()
    q3 = resource_plan.query("姓名 == @name and Quarter == 'Q3 Forecast'")["MD"].sum()
    q3_manual = manual_q3.loc[manual_q3["姓名"].eq(name), "MD"].sum()
    q3_adjusted = q3 + q3_manual
    q2_gap = q2a - q2p
    q3_vs_q2 = q3_adjusted - q2a
    resource_rows.append({
        "Resource": name,
        "Space": space,
        "Dedicated": "Dedicated QA" if name in DEDICATED_QA else ("Manual addition" if name not in set(plan_t["姓名"]) and name not in set(actual_t["姓名"]) else "Operation pool"),
        "Q1 Actual MD": round(q1, 2),
        "Q1 Planned MD": round(q1p, 2),
        "Q1 Actual - Plan MD": round(q1 - q1p, 2),
        "Q1 Gap %": pct(q1 - q1p, q1p),
        "Q2 Actual MD": round(q2a, 2),
        "Q2 Planned MD": round(q2p, 2),
        "Q2 Actual - Plan MD": round(q2_gap, 2),
        "Q2 Gap %": pct(q2_gap, q2p),
        "Q3 Forecast MD": round(q3, 2),
        "Manual Q3 Planned Add MD": round(q3_manual, 2),
        "Q3 Adjusted Planned MD": round(q3_adjusted, 2),
        "Q3 Adjusted - Q2 Actual MD": round(q3_vs_q2, 2),
        "Q3 Adjusted vs Q2 %": pct(q3_vs_q2, q2a),
        "Q1 Utilization": pct(q1, capacity["Q1 Actual"]),
        "Q2 Utilization": pct(q2a, capacity["Q2 Actual"]),
        "Q3 Forecast Utilization": pct(q3, capacity["Q3 Forecast"]),
        "Q3 Adjusted Utilization": pct(q3_adjusted, capacity["Q3 Forecast"]),
    })
resource_summary = pd.DataFrame(resource_rows).sort_values(["Dedicated", "Resource"])

project_actual = grouped(actual_q, ["项目名称", "Quarter"])
project_plan = grouped(plan_q, ["项目名称", "Quarter"])
projects = sorted(set(project_actual["项目名称"]) | set(project_plan["项目名称"]))
project_rows = []
for project in projects:
    q1 = project_actual.query("项目名称 == @project and Quarter == 'Q1 Actual'")["MD"].sum()
    q1p = project_plan.query("项目名称 == @project and Quarter == 'Q1 Actual'")["MD"].sum()
    q2a = project_actual.query("项目名称 == @project and Quarter == 'Q2 Actual'")["MD"].sum()
    q2p = project_plan.query("项目名称 == @project and Quarter == 'Q2 Actual'")["MD"].sum()
    q3 = project_plan.query("项目名称 == @project and Quarter == 'Q3 Forecast'")["MD"].sum()
    q3_manual = manual_q3.loc[manual_q3["项目名称"].eq(project), "MD"].sum()
    q3_adjusted = q3 + q3_manual
    project_rows.append({
        "Project": project or "(blank)",
        "Q1 Actual MD": round(q1, 2),
        "Q1 Planned MD": round(q1p, 2),
        "Q1 Actual - Plan MD": round(q1 - q1p, 2),
        "Q1 Gap %": pct(q1 - q1p, q1p),
        "Q2 Actual MD": round(q2a, 2),
        "Q2 Planned MD": round(q2p, 2),
        "Q2 Actual - Plan MD": round(q2a - q2p, 2),
        "Q2 Gap %": pct(q2a - q2p, q2p),
        "Q3 Forecast MD": round(q3, 2),
        "Manual Q3 Planned Add MD": round(q3_manual, 2),
        "Q3 Adjusted Planned MD": round(q3_adjusted, 2),
        "Q3 Adjusted - Q2 Actual MD": round(q3_adjusted - q2a, 2),
        "Q3 Adjusted vs Q2 %": pct(q3_adjusted - q2a, q2a),
    })
manual_projects = sorted(set(manual_q3["项目名称"]) - set(projects))
for project in manual_projects:
    q3_manual = manual_q3.loc[manual_q3["项目名称"].eq(project), "MD"].sum()
    project_rows.append({
        "Project": project,
        "Q1 Actual MD": 0,
        "Q1 Planned MD": 0,
        "Q1 Actual - Plan MD": 0,
        "Q1 Gap %": None,
        "Q2 Actual MD": 0,
        "Q2 Planned MD": 0,
        "Q2 Actual - Plan MD": 0,
        "Q2 Gap %": None,
        "Q3 Forecast MD": 0,
        "Manual Q3 Planned Add MD": round(q3_manual, 2),
        "Q3 Adjusted Planned MD": round(q3_manual, 2),
        "Q3 Adjusted - Q2 Actual MD": round(q3_manual, 2),
        "Q3 Adjusted vs Q2 %": None,
    })
project_summary = pd.DataFrame(project_rows).sort_values("Q3 Adjusted Planned MD", ascending=False)

monthly_actual = grouped(actual_q, ["Month"])
monthly_plan = grouped(plan_q, ["Month"])
monthly = pd.merge(
    monthly_actual.rename(columns={"MD": "Actual MD", "小时": "Actual Hours"}),
    monthly_plan.rename(columns={"MD": "Plan/Forecast MD", "小时": "Plan/Forecast Hours"}),
    on="Month", how="outer"
).fillna(0).sort_values("Month")
manual_monthly = pd.DataFrame([
    {"Month": "2026-08", "Manual Q3 Planned Add MD": round(manual_q3["MD"].sum() / 3, 3)},
    {"Month": "2026-09", "Manual Q3 Planned Add MD": round(manual_q3["MD"].sum() / 3, 3)},
    {"Month": "2026-10", "Manual Q3 Planned Add MD": round(manual_q3["MD"].sum() / 3, 3)},
])
monthly = monthly.merge(manual_monthly, on="Month", how="left").fillna({"Manual Q3 Planned Add MD": 0})
monthly["Adjusted Plan/Forecast MD"] = monthly["Plan/Forecast MD"] + monthly["Manual Q3 Planned Add MD"]

dedicated_projects = grouped(
    pd.concat([
        actual_q[actual_q["姓名"].isin(DEDICATED_QA)].assign(Source="Actual"),
        plan_q[plan_q["姓名"].isin(DEDICATED_QA)].assign(Source="Plan/Forecast"),
    ]),
    ["Source", "姓名", "项目名称", "Quarter"],
)

gap_rows = []
for _, r in resource_summary.iterrows():
    if r["Q3 Adjusted Utilization"] is not None and r["Q3 Adjusted Utilization"] > 1:
        gap_rows.append({
            "Gap Type": "Capacity Gap",
            "Object": r["Resource"],
            "Finding": f"Q3 adjusted planned utilization {r['Q3 Adjusted Utilization']:.0%}, above available capacity.",
            "Owner": "Resource owner / PMO",
            "ETA": "Before Q3 weekly planning lock",
            "Priority": "High",
        })
    elif r["Q3 Adjusted Utilization"] is not None and r["Q3 Adjusted Utilization"] > 0.9:
        gap_rows.append({
            "Gap Type": "Early Warning",
            "Object": r["Resource"],
            "Finding": f"Q3 adjusted planned utilization {r['Q3 Adjusted Utilization']:.0%}, close to overload threshold.",
            "Owner": "Resource owner / PM",
            "ETA": "Next weekly governance review",
            "Priority": "Medium",
        })
    if abs(r["Q2 Actual - Plan MD"]) >= 10:
        direction = "over" if r["Q2 Actual - Plan MD"] > 0 else "under"
        gap_rows.append({
            "Gap Type": "Utilization Gap",
            "Object": r["Resource"],
            "Finding": f"Q2 actual is {abs(r['Q2 Actual - Plan MD']):.1f} MD {direction} plan.",
            "Owner": "PM + resource owner",
            "ETA": "Validate timesheet/project mapping this week",
            "Priority": "High" if abs(r["Q2 Actual - Plan MD"]) >= 20 else "Medium",
        })
for _, r in project_summary.iterrows():
    if r["Q2 Actual MD"] > 0 and r["Q2 Planned MD"] == 0:
        gap_rows.append({
            "Gap Type": "Planning Gap",
            "Object": r["Project"],
            "Finding": f"Q2 actual has {r['Q2 Actual MD']:.1f} MD but no Q2 plan.",
            "Owner": "Project PM",
            "ETA": "Backfill Resource Plan / WBS mapping",
            "Priority": "High" if r["Q2 Actual MD"] >= 10 else "Medium",
        })
    if r["Q3 Adjusted Planned MD"] > 0 and r["Q2 Actual MD"] == 0 and r["Q1 Actual MD"] == 0:
        gap_rows.append({
            "Gap Type": "Forecast Validation",
            "Object": r["Project"],
            "Finding": f"Q3 adjusted plan has {r['Q3 Adjusted Planned MD']:.1f} MD but no Q1/Q2 actual baseline in selected cohort.",
            "Owner": "Project PM",
            "ETA": "Confirm before Q3 forecast freeze",
            "Priority": "Medium",
        })

gap_list = pd.DataFrame(gap_rows)
if not gap_list.empty:
    priority_order = {"High": 0, "Medium": 1, "Low": 2}
    gap_list["_order"] = gap_list["Priority"].map(priority_order).fillna(9)
    gap_list = gap_list.sort_values(["_order", "Gap Type", "Object"]).drop(columns=["_order"])

overview = {
    "cohort_size": len(cohort_names),
    "operation_pool_count": int((resource_summary["Dedicated"] == "Operation pool").sum()),
    "dedicated_qa": DEDICATED_QA,
    "capacity_md": capacity,
    "total_q1_actual_md": round(resource_summary["Q1 Actual MD"].sum(), 2),
    "total_q1_planned_md": round(resource_summary["Q1 Planned MD"].sum(), 2),
    "total_q1_gap_md": round(resource_summary["Q1 Actual - Plan MD"].sum(), 2),
    "total_q2_actual_md": round(resource_summary["Q2 Actual MD"].sum(), 2),
    "total_q2_planned_md": round(resource_summary["Q2 Planned MD"].sum(), 2),
    "total_q2_gap_md": round(resource_summary["Q2 Actual - Plan MD"].sum(), 2),
    "total_q3_forecast_md": round(resource_summary["Q3 Forecast MD"].sum(), 2),
    "manual_q3_planned_add_md": round(manual_q3["MD"].sum(), 2),
    "total_q3_adjusted_planned_md": round(resource_summary["Q3 Adjusted Planned MD"].sum(), 2),
    "q3_adjusted_vs_q2_actual_md": round(resource_summary["Q3 Adjusted - Q2 Actual MD"].sum(), 2),
}

for name, df in [
    ("resource_summary", resource_summary),
    ("project_summary", project_summary),
    ("monthly_summary", monthly),
    ("dedicated_projects", dedicated_projects),
    ("manual_q3_additions", manual_q3),
    ("gap_list", gap_list),
]:
    df.to_csv(OUTDIR / f"{name}.csv", index=False, encoding="utf-8-sig")
    (OUTDIR / f"{name}.json").write_text(df.to_json(orient="records", force_ascii=False, indent=2), encoding="utf-8")

(OUTDIR / "overview.json").write_text(json.dumps(overview, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(overview, ensure_ascii=False, indent=2))
print("Top resources")
print(resource_summary.sort_values("Q3 Forecast MD", ascending=False).head(20).to_string(index=False))
print("Top gaps")
print(gap_list.head(30).to_string(index=False) if not gap_list.empty else "No gaps")
