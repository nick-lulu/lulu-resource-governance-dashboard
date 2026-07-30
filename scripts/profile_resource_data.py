from pathlib import Path
import json
import pandas as pd

PLAN = Path(r"D:/pm/resource/1/计划工时按工作-STK.xlsx")
ACTUAL = Path(r"D:/pm/resource/1/填报工时原始数据_STK.xlsx")
DEDICATED_FIRST_NAMES = ["Jade", "Daisy", "Harry", "Mengyi"]


def normalize_name(v):
    return "" if pd.isna(v) else str(v).strip()


plan = pd.read_excel(PLAN, sheet_name="Sheet3")
actual_pivot = pd.read_excel(ACTUAL, sheet_name="by人员统计表", header=5)
actual_raw = pd.read_excel(ACTUAL, sheet_name="填报工时原始数据")

for df in (plan, actual_pivot, actual_raw):
    if "所属Space" in df.columns:
        df["所属Space"] = df["所属Space"].ffill()
    if "姓名" in df.columns:
        df["姓名"] = df["姓名"].map(normalize_name)

summary = {}
for label, df in [("plan", plan), ("actual_pivot", actual_pivot), ("actual_raw", actual_raw)]:
    names = sorted([n for n in df.get("姓名", pd.Series(dtype=str)).dropna().unique() if str(n).strip()])
    spaces = sorted([s for s in df.get("所属Space", pd.Series(dtype=str)).dropna().astype(str).unique() if s.strip()])
    dedicated_matches = [n for n in names if any(k.lower() in n.lower() for k in DEDICATED_FIRST_NAMES)]
    summary[label] = {
        "shape": df.shape,
        "columns": [str(c) for c in df.columns],
        "spaces": spaces,
        "dedicated_name_matches": dedicated_matches,
        "operation_names_sample": sorted(df.loc[df.get("所属Space", "") == "Operation", "姓名"].dropna().unique().tolist())[:80]
            if "所属Space" in df.columns and "姓名" in df.columns else [],
    }

for date_col in ["统计日期", "填写日期", "周起始日期"]:
    for label, df in [("plan", plan), ("actual_raw", actual_raw)]:
        if date_col in df.columns:
            dates = pd.to_datetime(df[date_col], errors="coerce")
            summary[f"{label}_{date_col}_range"] = [str(dates.min()), str(dates.max())]

print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
