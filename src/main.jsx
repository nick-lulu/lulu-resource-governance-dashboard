import React, { useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  Gauge,
  Lightbulb,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import overview from "../outputs/resource_governance/overview.json";
import resources from "../outputs/resource_governance/resource_summary.json";
import projects from "../outputs/resource_governance/project_summary.json";
import monthly from "../outputs/resource_governance/monthly_summary.json";
import gapList from "../outputs/resource_governance/gap_list.json";
import "./styles.css";

const md = (value, digits = 1) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const pct = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(0)}%`;
};

const risk = (value) => {
  if (value === "High") return "high";
  if (value === "Medium") return "medium";
  return "low";
};

function getResourceStatus(row) {
  const q2Gap = Math.abs(Number(row["Q2 Actual - Plan MD"] || 0));
  const q3Delta = Number(row["Q3 Adjusted - Q2 Actual MD"] || 0);
  if (q2Gap >= 20 || q3Delta <= -35) return "High";
  if (q2Gap >= 10 || q3Delta <= -15) return "Medium";
  return "Low";
}

function getProjectStatus(row) {
  const q2Actual = Number(row["Q2 Actual MD"] || 0);
  const q2Plan = Number(row["Q2 Planned MD"] || 0);
  const q3Plan = Number(row["Q3 Adjusted Planned MD"] || 0);
  if ((q2Actual >= 10 && q2Plan === 0) || (q2Actual >= 25 && q3Plan < q2Actual * 0.5)) return "High";
  if ((q2Actual > 0 && q2Plan === 0) || Math.abs(q2Actual - q2Plan) >= 8) return "Medium";
  return "Low";
}

function Kpi({ icon: Icon, label, value, note, tone }) {
  return (
    <section className={`kpi ${tone || ""}`}>
      <Icon size={20} />
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </section>
  );
}

function StatusBadge({ value }) {
  return <span className={`status ${risk(value)}`}>{value}</span>;
}

function App() {
  const chartData = useMemo(
    () =>
      monthly.map((row) => ({
        month: row.Month,
        actual: Number(row["Actual MD"] || 0),
        q3Plan: Number(row["Adjusted Plan/Forecast MD"] || row["Plan/Forecast MD"] || 0),
      })),
    [],
  );

  const resourceRows = useMemo(
    () =>
      resources
        .map((row) => ({ ...row, status: getResourceStatus(row) }))
        .sort((a, b) => Number(b["Q2 Actual MD"] || 0) - Number(a["Q2 Actual MD"] || 0))
        .slice(0, 9),
    [],
  );

  const projectRows = useMemo(
    () =>
      projects
        .filter((row) => Number(row["Q2 Actual MD"] || 0) > 0 || Number(row["Q3 Adjusted Planned MD"] || 0) > 0)
        .map((row) => ({ ...row, status: getProjectStatus(row) }))
        .sort((a, b) => {
          const score = (item) =>
            (item.status === "High" ? 1000 : item.status === "Medium" ? 500 : 0) +
            Number(item["Q2 Actual MD"] || 0) +
            Number(item["Q3 Adjusted Planned MD"] || 0);
          return score(b) - score(a);
        })
        .slice(0, 10),
    [],
  );

  const topWarnings = gapList.slice(0, 4);
  const coverageRate = overview.total_q3_adjusted_planned_md / overview.total_q2_actual_md;
  const q3ActualMd = 0;

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Lululemon Portfolio Resource Planning</p>
          <h1>Q3 Forecast Readiness</h1>
          <p className="subtitle">
            Current status view for Charley: Q2 actual baseline, Q3 planned workload, and what this says about forecast completeness before Q3 starts.
          </p>
        </div>
        <a className="download" href={`${import.meta.env.BASE_URL}downloads/Resource_Governance_Boss_Ready.xlsx`}>
          <Download size={17} />
          Excel detail
        </a>
      </header>

      <section className="kpis">
        <Kpi icon={Users} label="Resource Scope" value={`${overview.cohort_size} people`} note="Operation + dedicated QA + confirmed Q3 resource" />
        <Kpi icon={BarChart3} label="Q2 Actual Effort" value={`${md(overview.total_q2_actual_md)} MD`} note="Timesheet actual baseline" tone="blue" />
        <Kpi icon={Gauge} label="Q3 Planned MD" value={`${md(overview.total_q3_adjusted_planned_md)} MD`} note="Forecast plus confirmed Q3 project effort" tone="green" />
        <Kpi icon={Lightbulb} label="Forecast Coverage Check" value={`${(coverageRate * 100).toFixed(0)}%`} note="Q3 planned compared with Q2 actual run-rate, not an actual gap" tone="amber" />
      </section>

      <section className="summary-grid">
        <article className="panel narrative">
          <div className="panel-title">
            <h2>Takeaway</h2>
            <StatusBadge value="High" />
          </div>
          <ul>
            <li>
              <strong>We cannot calculate Q3 actual gap yet.</strong>
              <span>Source actual data is through 2026-07-31, while lulu Q3 starts on 2026-08-01. Current Q3 actual is {md(q3ActualMd)} MD in this dataset.</span>
            </li>
            <li>
              <strong>Q3 planned MD is a forecast readiness number.</strong>
              <span>Q3 planned is {md(overview.total_q3_adjusted_planned_md)} MD after folding confirmed project effort into the plan.</span>
            </li>
            <li>
              <strong>Insight: the Q3 forecast still looks light versus recent delivery run-rate.</strong>
              <span>Q2 actual was {md(overview.total_q2_actual_md)} MD, so Q3 planned currently covers {(coverageRate * 100).toFixed(0)}% of Q2 run-rate. This suggests the forecast may still be incomplete, not that we have a Q3 execution gap.</span>
            </li>
          </ul>
        </article>

        <article className="panel narrative">
          <div className="panel-title">
            <h2>Insight</h2>
            <span className="unit">How to read this</span>
          </div>
          <ul>
            <li>
              <strong>Actual comparison logic changes after Q3 starts.</strong>
              <span>Once Aug-Oct timesheet actuals are available, the dashboard should switch to Q3 Actual vs Q3 Planned by resource and project.</span>
            </li>
            <li>
              <strong>Current management action is forecast cleanup.</strong>
              <span>Before Q3 execution, the useful question is whether all known Q3 demand has been planned and assigned to named resources.</span>
            </li>
            <li>
              <strong>Q2 actual is only a benchmark.</strong>
              <span>It helps detect whether the Q3 forecast is unusually low compared with the recent actual workload, especially for recurring Operation work.</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="summary-grid">
        <article className="panel narrative">
          <div className="panel-title">
            <h2>Current Status</h2>
            <span className="unit">As of 2026-07-31</span>
          </div>
          <ul>
            <li>
              <strong>Q2 actual was materially higher than plan.</strong>
              <span>Actual effort reached {md(overview.total_q2_actual_md)} MD, which is {md(overview.total_q2_gap_md)} MD above Q2 planned baseline.</span>
            </li>
            <li>
              <strong>Q3 plan has been adjusted with confirmed project effort.</strong>
              <span>After adding confirmed Q3 project effort into planned MD, Q3 planned is {md(overview.total_q3_adjusted_planned_md)} MD.</span>
            </li>
            <li>
              <strong>The remaining concern is forecast completeness.</strong>
              <span>The next step is to confirm whether recurring Operation work and project pipeline have all been represented in Q3 planned MD.</span>
            </li>
          </ul>
        </article>

        <article className="panel chart-panel">
          <div className="panel-title">
            <h2>Actual Baseline vs Q3 Planned</h2>
            <span className="unit">MD</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `${md(value)} MD`} />
              <Legend />
              <Bar dataKey="q3Plan" name="Q3 Planned / Forecast" fill="#0F766E" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke="#2563EB" strokeWidth={3} dot={{ r: 3 }} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className="panel warning-panel">
        <div className="panel-title">
          <h2>Gaps To Discuss Today</h2>
          <span className="unit">Owner + action needed</span>
        </div>
        <div className="warning-list">
          {topWarnings.map((item, index) => (
            <div key={`${item.Object}-${index}`}>
              <AlertTriangle size={17} />
              <strong>{item.Object}</strong>
              <p>{item.Finding}</p>
              <span>{item.Owner} · {item.ETA}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="tables">
        <article className="panel">
          <div className="panel-title">
            <h2>Resource Reality</h2>
            <span className="unit">Top actual contributors</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Resource</th>
                  <th>Q2 Actual</th>
                  <th>Q3 Planned</th>
                  <th>Gap vs Q2</th>
                  <th>Q3 Util.</th>
                </tr>
              </thead>
              <tbody>
                {resourceRows.map((row) => (
                  <tr key={row.Resource}>
                    <td><StatusBadge value={row.status} /></td>
                    <td><strong>{row.Resource}</strong><small>{row.Dedicated}</small></td>
                    <td>{md(row["Q2 Actual MD"])} MD</td>
                    <td>{md(row["Q3 Adjusted Planned MD"])} MD</td>
                    <td className={Number(row["Q3 Adjusted - Q2 Actual MD"]) < 0 ? "negative" : "positive"}>
                      {md(row["Q3 Adjusted - Q2 Actual MD"])} MD
                    </td>
                    <td>{pct(row["Q3 Adjusted Utilization"])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Project Reality</h2>
            <span className="unit">Key plan gaps</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Project</th>
                  <th>Q2 Actual</th>
                  <th>Q3 Planned</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row) => (
                  <tr key={row.Project}>
                    <td><StatusBadge value={row.status} /></td>
                    <td><strong>{row.Project}</strong></td>
                    <td>{md(row["Q2 Actual MD"])} MD</td>
                    <td>{md(row["Q3 Adjusted Planned MD"])} MD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <footer>
        <CheckCircle2 size={16} />
        Q3 Planned MD includes confirmed Q3 project effort provided after the original system export. The page focuses on the management view, while Excel keeps the detailed audit trail.
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
