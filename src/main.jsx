import React, { useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  Gauge,
  TrendingDown,
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

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Lululemon Portfolio Resource Planning</p>
          <h1>Actual Effort vs Q3 Forecast</h1>
          <p className="subtitle">
            Current status view for Charley: Q2 actual effort, Q3 planned workload, and the gaps that need management attention.
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
        <Kpi icon={TrendingDown} label="Forecast Coverage Gap" value={`${md(Math.abs(overview.q3_adjusted_vs_q2_actual_md))} MD`} note={`Q3 covers only ${(coverageRate * 100).toFixed(0)}% of Q2 run-rate`} tone="red" />
      </section>

      <section className="summary-grid">
        <article className="panel narrative">
          <div className="panel-title">
            <h2>Current Readout</h2>
            <StatusBadge value="High" />
          </div>
          <ul>
            <li>
              <strong>Q2 actual is materially higher than plan.</strong>
              <span>Actual effort reached {md(overview.total_q2_actual_md)} MD, which is {md(overview.total_q2_gap_md)} MD above Q2 planned baseline.</span>
            </li>
            <li>
              <strong>Q3 planned effort is still not enough against run-rate.</strong>
              <span>After adding confirmed Q3 project effort into planned MD, Q3 planned is {md(overview.total_q3_adjusted_planned_md)} MD.</span>
            </li>
            <li>
              <strong>The real management gap is forecast completeness.</strong>
              <span>Remaining gap vs Q2 actual is {md(Math.abs(overview.q3_adjusted_vs_q2_actual_md))} MD, so this should not be read as spare capacity yet.</span>
            </li>
          </ul>
        </article>

        <article className="panel chart-panel">
          <div className="panel-title">
            <h2>Actual vs Q3 Planned Trend</h2>
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
