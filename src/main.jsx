import React, { useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  Gauge,
  Target,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import overview from "../outputs/resource_governance/overview.json";
import resources from "../outputs/resource_governance/resource_summary.json";
import monthly from "../outputs/resource_governance/monthly_summary.json";
import gapList from "../outputs/resource_governance/gap_list.json";
import "./styles.css";

const md = (value, digits = 1) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const risk = (value) => {
  if (value === "High") return "high";
  if (value === "Medium") return "medium";
  return "low";
};

function getResourceStatus(row) {
  const q1Gap = Math.abs(Number(row["Q1 Actual - Plan MD"] || 0));
  const q2Gap = Math.abs(Number(row["Q2 Actual - Plan MD"] || 0));
  if (q1Gap >= 20 || q2Gap >= 20) return "High";
  if (q1Gap >= 10 || q2Gap >= 10) return "Medium";
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
  const chartData = [
    {
      quarter: "Q1",
      actual: overview.total_q1_actual_md,
      planned: overview.total_q1_planned_md,
      variance: overview.total_q1_gap_md,
    },
    {
      quarter: "Q2",
      actual: overview.total_q2_actual_md,
      planned: overview.total_q2_planned_md,
      variance: overview.total_q2_gap_md,
    },
    {
      quarter: "Q3",
      actual: 0,
      planned: overview.total_q3_adjusted_planned_md,
      variance: null,
    },
  ];

  const allResourceRows = useMemo(
    () =>
      resources
        .map((row) => ({ ...row, status: getResourceStatus(row) }))
        .sort((a, b) => Number(b["Q2 Actual MD"] || 0) - Number(a["Q2 Actual MD"] || 0)),
    [],
  );

  const dedicatedQaRows = useMemo(
    () =>
      allResourceRows
        .filter((row) => row.Dedicated === "Dedicated QA")
        .sort((a, b) => Number(b["Q2 Actual MD"] || 0) - Number(a["Q2 Actual MD"] || 0)),
    [allResourceRows],
  );

  const resourceRows = useMemo(() => {
    const topOperation = allResourceRows
      .filter((row) => row.Dedicated !== "Dedicated QA")
      .slice(0, 8);
    return [...dedicatedQaRows, ...topOperation].sort(
      (a, b) => Number(b["Q2 Actual MD"] || 0) - Number(a["Q2 Actual MD"] || 0),
    );
  }, [allResourceRows, dedicatedQaRows]);

  const dedicatedQaTotals = dedicatedQaRows.reduce(
    (acc, row) => ({
      q1Actual: acc.q1Actual + Number(row["Q1 Actual MD"] || 0),
      q1Plan: acc.q1Plan + Number(row["Q1 Planned MD"] || 0),
      q2Actual: acc.q2Actual + Number(row["Q2 Actual MD"] || 0),
      q2Plan: acc.q2Plan + Number(row["Q2 Planned MD"] || 0),
      q3Plan: acc.q3Plan + Number(row["Q3 Adjusted Planned MD"] || 0),
    }),
    { q1Actual: 0, q1Plan: 0, q2Actual: 0, q2Plan: 0, q3Plan: 0 },
  );

  const topWarnings = gapList.slice(0, 4);
  const q1Accuracy = overview.total_q1_planned_md / overview.total_q1_actual_md;
  const q2Accuracy = overview.total_q2_planned_md / overview.total_q2_actual_md;

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Lululemon Portfolio Resource Planning</p>
          <h1>Actual vs Planned, Then Q3 Forecast</h1>
          <p className="subtitle">
            Boss view: Q1 and Q2 actual effort should be measured against their planned MD; Q3 is a forecast readiness view because actuals have not started yet.
          </p>
        </div>
        <a className="download" href={`${import.meta.env.BASE_URL}downloads/Resource_Governance_Boss_Ready.xlsx`}>
          <Download size={17} />
          Excel detail
        </a>
      </header>

      <section className="kpis">
        <Kpi icon={Users} label="Resource Scope" value={`${overview.cohort_size} people`} note="Operation + dedicated QA + confirmed Q3 resource" />
        <Kpi icon={BarChart3} label="Q1 Actual vs Planned" value={`${md(overview.total_q1_actual_md)} / ${md(overview.total_q1_planned_md)} MD`} note={`Actual was ${md(overview.total_q1_gap_md)} MD above plan`} tone="blue" />
        <Kpi icon={Target} label="Q2 Actual vs Planned" value={`${md(overview.total_q2_actual_md)} / ${md(overview.total_q2_planned_md)} MD`} note={`Actual was ${md(overview.total_q2_gap_md)} MD above plan`} tone="amber" />
        <Kpi icon={Gauge} label="Q3 Forecast / Planned" value={`${md(overview.total_q3_adjusted_planned_md)} MD`} note="Forecast plus confirmed Q3 project effort; no Q3 actual yet" tone="green" />
      </section>

      <section className="summary-grid">
        <article className="panel narrative">
          <div className="panel-title">
            <h2>Takeaway</h2>
            <StatusBadge value="High" />
          </div>
          <ul>
            <li>
              <strong>Q1 and Q2 both show actual effort above plan.</strong>
              <span>Q1 actual was {md(overview.total_q1_gap_md)} MD above planned MD; Q2 actual was {md(overview.total_q2_gap_md)} MD above planned MD.</span>
            </li>
            <li>
              <strong>This is a planning accuracy issue, not only a resource capacity question.</strong>
              <span>Q1 plan covered {(q1Accuracy * 100).toFixed(0)}% of actual effort; Q2 plan covered {(q2Accuracy * 100).toFixed(0)}% of actual effort.</span>
            </li>
            <li>
              <strong>Q3 should be read as forecast readiness.</strong>
              <span>Q3 planned is {md(overview.total_q3_adjusted_planned_md)} MD after confirmed project effort is included; actual comparison starts once Q3 timesheet data exists.</span>
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
              <strong>Historical insight.</strong>
              <span>The resource plan underestimated actual delivery in both Q1 and Q2, so the governance mechanism should review plan quality, not just resource availability.</span>
            </li>
            <li>
              <strong>Forward-looking insight.</strong>
              <span>For Q3, the useful question is whether all known demand has been forecasted and assigned before execution begins.</span>
            </li>
            <li>
              <strong>Early warning trigger.</strong>
              <span>Once Q3 actuals arrive, compare Q3 actual vs Q3 planned weekly and flag variance above 20% or unplanned actual effort.</span>
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
              <strong>Q1 actual vs planned.</strong>
              <span>{md(overview.total_q1_actual_md)} MD actual against {md(overview.total_q1_planned_md)} MD planned.</span>
            </li>
            <li>
              <strong>Q2 actual vs planned.</strong>
              <span>{md(overview.total_q2_actual_md)} MD actual against {md(overview.total_q2_planned_md)} MD planned.</span>
            </li>
            <li>
              <strong>Q3 forecast.</strong>
              <span>{md(overview.total_q3_adjusted_planned_md)} MD forecast/planned. This includes confirmed Q3 project effort provided after the system export.</span>
            </li>
          </ul>
        </article>

        <article className="panel chart-panel">
          <div className="panel-title">
            <h2>Quarter View</h2>
            <span className="unit">MD</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
              <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `${md(value)} MD`} />
              <Legend />
              <Bar dataKey="planned" name="Planned / Forecast" fill="#0F766E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="#2563EB" radius={[4, 4, 0, 0]} />
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

      <section className="panel dedicated-panel">
        <div className="panel-title">
          <h2>Dedicated QA Reality</h2>
          <span className="unit">Jade · Daisy · Harry · Mengyi</span>
        </div>
        <div className="dedicated-summary">
          <div>
            <span>Q1 Actual / Planned</span>
            <strong>{md(dedicatedQaTotals.q1Actual)} / {md(dedicatedQaTotals.q1Plan)} MD</strong>
          </div>
          <div>
            <span>Q2 Actual / Planned</span>
            <strong>{md(dedicatedQaTotals.q2Actual)} / {md(dedicatedQaTotals.q2Plan)} MD</strong>
          </div>
          <div>
            <span>Q3 Forecast / Planned</span>
            <strong>{md(dedicatedQaTotals.q3Plan)} MD</strong>
          </div>
          <p>
            Dedicated QA actual effort was significant in Q1/Q2, but Q3 forecast is still very light. This should be called out as a forecast completeness risk for dedicated QA coverage.
          </p>
        </div>
        <div className="table-wrap compact-table">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Dedicated QA</th>
                <th>Q1 Actual / Planned</th>
                <th>Q2 Actual / Planned</th>
                <th>Q3 Forecast</th>
                <th>Current Read</th>
              </tr>
            </thead>
            <tbody>
              {dedicatedQaRows.map((row) => (
                <tr key={row.Resource}>
                  <td><StatusBadge value={row.status} /></td>
                  <td><strong>{row.Resource}</strong><small>{row.Space}</small></td>
                  <td>{md(row["Q1 Actual MD"])} / {md(row["Q1 Planned MD"])} MD</td>
                  <td>{md(row["Q2 Actual MD"])} / {md(row["Q2 Planned MD"])} MD</td>
                  <td>{md(row["Q3 Adjusted Planned MD"])} MD</td>
                  <td>
                    {Number(row["Q3 Adjusted Planned MD"] || 0) < Number(row["Q2 Actual MD"] || 0) * 0.5
                      ? "Q3 forecast needs confirmation"
                      : "Forecast baseline exists"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  <th>Q1 A/P</th>
                  <th>Q2 Actual</th>
                  <th>Q2 Plan</th>
                  <th>Q3 Planned</th>
                </tr>
              </thead>
              <tbody>
                {resourceRows.map((row) => (
                  <tr key={row.Resource}>
                    <td><StatusBadge value={row.status} /></td>
                    <td><strong>{row.Resource}</strong><small>{row.Dedicated}</small></td>
                    <td>{md(row["Q1 Actual MD"])} / {md(row["Q1 Planned MD"])}</td>
                    <td>{md(row["Q2 Actual MD"])} MD</td>
                    <td>{md(row["Q2 Planned MD"])} MD</td>
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
        Q1/Q2 are actual-vs-planned validation periods. Q3 is forecast/planned only until Aug-Oct actual timesheet data becomes available.
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
