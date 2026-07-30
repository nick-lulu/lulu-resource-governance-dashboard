import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  Download,
  Filter,
  Layers3,
  ListChecks,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
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
import manualAdds from "../outputs/resource_governance/manual_q3_additions.json";
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

const riskColor = (risk) => {
  if (risk === "High") return "risk-high";
  if (risk === "Medium") return "risk-medium";
  return "risk-low";
};

const normalize = (text) => String(text || "").toLowerCase();

function classifyResource(row) {
  const util = Number(row["Q3 Adjusted Utilization"] || 0);
  const q2Gap = Math.abs(Number(row["Q2 Actual - Plan MD"] || 0));
  const remaining = Number(row["Q3 Adjusted - Q2 Actual MD"] || 0);
  if (util > 0.9 || q2Gap >= 20 || remaining < -35) return "High";
  if (util > 0.7 || q2Gap >= 10 || remaining < -15) return "Medium";
  return "Low";
}

function classifyProject(row) {
  const actual = Number(row["Q2 Actual MD"] || 0);
  const planned = Number(row["Q2 Planned MD"] || 0);
  const adjusted = Number(row["Q3 Adjusted Planned MD"] || 0);
  const manual = Number(row["Manual Q3 Planned Add MD"] || 0);
  if ((actual >= 10 && planned === 0) || manual >= 15 || (actual >= 20 && adjusted < actual * 0.4)) return "High";
  if ((actual > 0 && planned === 0) || manual > 0 || Math.abs(actual - planned) >= 8) return "Medium";
  return "Low";
}

const manualByProject = manualAdds.reduce((acc, item) => {
  acc[item.Project] = (acc[item.Project] || 0) + Number(item.MD || 0);
  return acc;
}, {});

const manualByResource = manualAdds.reduce((acc, item) => {
  acc[item.Resource] = (acc[item.Resource] || 0) + Number(item.MD || 0);
  return acc;
}, {});

const flow = [
  ["Project", "Step 01"],
  ["Resource", "Step 01"],
  ["Capacity", "Step 02"],
  ["Timesheet", "Step 02"],
  ["Forecast", "Step 03"],
  ["Early Warning", "Step 03"],
];

function KpiCard({ title, value, detail, tone, icon: Icon, delta }) {
  return (
    <section className={`kpi ${tone || ""}`}>
      <div className="kpi-icon">
        <Icon size={19} />
      </div>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
      {delta && <em>{delta}</em>}
    </section>
  );
}

function App() {
  const [view, setView] = useState("resources");
  const [risk, setRisk] = useState("All");
  const [query, setQuery] = useState("");

  const resourceRows = useMemo(
    () =>
      resources
        .map((row) => ({ ...row, risk: classifyResource(row) }))
        .sort((a, b) => Number(b["Q3 Adjusted Planned MD"] || 0) - Number(a["Q3 Adjusted Planned MD"] || 0)),
    [],
  );

  const projectRows = useMemo(
    () =>
      projects
        .filter((row) => Number(row["Q2 Actual MD"] || 0) > 0 || Number(row["Q3 Adjusted Planned MD"] || 0) > 0)
        .map((row) => ({ ...row, risk: classifyProject(row) }))
        .sort((a, b) => Number(b["Q3 Adjusted Planned MD"] || 0) - Number(a["Q3 Adjusted Planned MD"] || 0)),
    [],
  );

  const activeRows = view === "resources" ? resourceRows : view === "projects" ? projectRows : gapList;

  const filteredRows = activeRows.filter((row) => {
    const text = normalize(Object.values(row).join(" "));
    const rowRisk = row.risk || row.Priority || "Medium";
    return (risk === "All" || rowRisk === risk) && text.includes(normalize(query));
  });

  const topResourceData = resourceRows.slice(0, 10).map((row) => ({
    name: row.Resource.replace(" Zhong", "").replace(" Yang", "").replace(" Zhang", ""),
    actual: Number(row["Q2 Actual MD"] || 0),
    system: Number(row["Q3 Forecast MD"] || 0),
    manual: Number(row["Manual Q3 Planned Add MD"] || 0),
    adjusted: Number(row["Q3 Adjusted Planned MD"] || 0),
    risk: row.risk,
  }));

  const monthlyData = monthly.map((row) => ({
    month: row.Month,
    actual: Number(row["Actual MD"] || 0),
    system: Number(row["Plan/Forecast MD"] || 0),
    adjusted: Number(row["Adjusted Plan/Forecast MD"] || row["Plan/Forecast MD"] || 0),
  }));

  const highRiskCount = resourceRows.filter((r) => r.risk === "High").length + projectRows.filter((r) => r.risk === "High").length;

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Portfolio Resource Governance</p>
          <h1>Validation to Early Warning Dashboard</h1>
        </div>
        <a className="download" href={`${import.meta.env.BASE_URL}downloads/Resource_Governance_Boss_Ready.xlsx`}>
          <Download size={17} />
          Boss-ready Excel
        </a>
      </header>

      <section className="maturity">
        {flow.map(([label, step], index) => (
          <div className={`flow-node ${index >= 4 ? "active" : ""}`} key={label}>
            <span>{step}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </section>

      <section className="kpi-grid">
        <KpiCard icon={Users} title="Governance Scope" value={`${overview.cohort_size} resources`} detail="Operation + dedicated QA + manual addition" />
        <KpiCard icon={BarChart3} title="Q2 Actual" value={`${md(overview.total_q2_actual_md)} MD`} detail={`${md(overview.total_q2_gap_md)} MD above Q2 plan`} tone="warn" delta="+27%" />
        <KpiCard icon={Layers3} title="Q3 Adjusted Plan" value={`${md(overview.total_q3_adjusted_planned_md)} MD`} detail={`${md(overview.manual_q3_planned_add_md)} MD manually added`} tone="info" />
        <KpiCard icon={ShieldAlert} title="Remaining Coverage Gap" value={`${md(Math.abs(overview.q3_adjusted_vs_q2_actual_md))} MD`} detail="Adjusted Q3 still below Q2 actual run-rate" tone="critical" />
        <KpiCard icon={CircleGauge} title="Warning Items" value={`${highRiskCount}`} detail="High risk resource/project signals" tone="critical" />
      </section>

      <section className="analysis-grid">
        <div className="panel wide">
          <div className="panel-heading">
            <div>
              <h2>Actual vs Plan / Forecast</h2>
              <p>Q3 adjusted plan includes known project efforts not yet reflected in the system export.</p>
            </div>
            <span className="badge">MD</span>
          </div>
          <ResponsiveContainer width="100%" height={290}>
            <ComposedChart data={monthlyData} margin={{ top: 15, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `${md(value)} MD`} />
              <Legend />
              <Bar dataKey="system" name="System Plan / Forecast" fill="#9CA3AF" radius={[3, 3, 0, 0]} />
              <Bar dataKey="adjusted" name="Adjusted Plan" fill="#0F766E" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke="#2563EB" strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-heading compact">
            <h2>Early Warning Logic</h2>
            <span className="badge danger">Pilot</span>
          </div>
          <div className="rules">
            <div>
              <AlertTriangle size={18} />
              <strong>Forecast coverage</strong>
              <span>Adjusted Q3 planned far below Q2 actual run-rate.</span>
            </div>
            <div>
              <ArrowUpRight size={18} />
              <strong>Plan vs actual</strong>
              <span>Actual-plan variance greater than 20% or 10 MD.</span>
            </div>
            <div>
              <CircleGauge size={18} />
              <strong>Capacity pressure</strong>
              <span>Adjusted utilization above 90% becomes overload watch.</span>
            </div>
          </div>
        </div>

        <div className="panel wide">
          <div className="panel-heading">
            <div>
              <h2>Resource Load After Manual Q3 Additions</h2>
              <p>Top resources by adjusted Q3 planned MD.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topResourceData} layout="vertical" margin={{ top: 8, right: 18, bottom: 0, left: 20 }}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" width={88} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `${md(value)} MD`} />
              <Legend />
              <Bar dataKey="system" stackId="a" name="System Q3" fill="#94A3B8" radius={[0, 0, 0, 0]} />
              <Bar dataKey="manual" stackId="a" name="Manual Add" radius={[0, 4, 4, 0]}>
                {topResourceData.map((entry) => (
                  <Cell key={entry.name} fill={entry.risk === "High" ? "#DC2626" : entry.risk === "Medium" ? "#D97706" : "#0F766E"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-heading compact">
            <h2>Manual Q3 Additions</h2>
            <span className="badge">{md(overview.manual_q3_planned_add_md)} MD</span>
          </div>
          <div className="mini-list">
            {Object.entries(manualByProject)
              .sort((a, b) => b[1] - a[1])
              .map(([project, value]) => (
                <div key={project}>
                  <span>{project}</span>
                  <strong>{md(value)} MD</strong>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="toolbar">
          <div className="tabs">
            <button className={view === "resources" ? "selected" : ""} onClick={() => setView("resources")}>
              <Users size={16} /> Resources
            </button>
            <button className={view === "projects" ? "selected" : ""} onClick={() => setView("projects")}>
              <BriefcaseBusiness size={16} /> Projects
            </button>
            <button className={view === "gaps" ? "selected" : ""} onClick={() => setView("gaps")}>
              <ListChecks size={16} /> Gap List
            </button>
          </div>
          <div className="filters">
            <label>
              <Search size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search resource, project, finding" />
            </label>
            <label>
              <Filter size={15} />
              <select value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="Risk filter">
                <option>All</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <ChevronDown size={15} className="select-icon" />
            </label>
          </div>
        </div>

        {view === "resources" && <ResourceTable rows={filteredRows} />}
        {view === "projects" && <ProjectTable rows={filteredRows} />}
        {view === "gaps" && <GapTable rows={filteredRows} />}
      </section>
    </main>
  );
}

function RiskPill({ value }) {
  return (
    <span className={`risk-pill ${riskColor(value)}`}>
      {value === "High" ? <AlertTriangle size={13} /> : value === "Medium" ? <ArrowDownRight size={13} /> : <CheckCircle2 size={13} />}
      {value}
    </span>
  );
}

function ResourceTable({ rows }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Risk</th>
            <th>Resource</th>
            <th>Group</th>
            <th>Q2 Actual</th>
            <th>Q2 Plan Gap</th>
            <th>System Q3</th>
            <th>Manual Add</th>
            <th>Adjusted Q3</th>
            <th>Utilization</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.Resource}>
              <td><RiskPill value={row.risk} /></td>
              <td><strong>{row.Resource}</strong><small>{row.Space || "Manual scope"}</small></td>
              <td>{row.Dedicated}</td>
              <td>{md(row["Q2 Actual MD"])} MD</td>
              <td className={Number(row["Q2 Actual - Plan MD"]) >= 0 ? "pos" : "neg"}>{md(row["Q2 Actual - Plan MD"])} MD</td>
              <td>{md(row["Q3 Forecast MD"])} MD</td>
              <td>{md(row["Manual Q3 Planned Add MD"])} MD</td>
              <td><strong>{md(row["Q3 Adjusted Planned MD"])} MD</strong></td>
              <td>{pct(row["Q3 Adjusted Utilization"])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectTable({ rows }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Risk</th>
            <th>Project</th>
            <th>Q2 Actual</th>
            <th>Q2 Plan</th>
            <th>System Q3</th>
            <th>Manual Add</th>
            <th>Adjusted Q3</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.Project}>
              <td><RiskPill value={row.risk} /></td>
              <td><strong>{row.Project}</strong></td>
              <td>{md(row["Q2 Actual MD"])} MD</td>
              <td>{md(row["Q2 Planned MD"])} MD</td>
              <td>{md(row["Q3 Forecast MD"])} MD</td>
              <td>{md(row["Manual Q3 Planned Add MD"])} MD</td>
              <td><strong>{md(row["Q3 Adjusted Planned MD"])} MD</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GapTable({ rows }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Priority</th>
            <th>Gap Type</th>
            <th>Object</th>
            <th>Finding</th>
            <th>Owner</th>
            <th>ETA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.Object}-${index}`}>
              <td><RiskPill value={row.Priority || "Medium"} /></td>
              <td>{row["Gap Type"]}</td>
              <td><strong>{row.Object}</strong></td>
              <td>{row.Finding}</td>
              <td>{row.Owner}</td>
              <td>{row.ETA}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
