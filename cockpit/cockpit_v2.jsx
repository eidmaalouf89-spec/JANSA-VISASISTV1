import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, Legend, CartesianGrid, LabelList
} from "recharts";
import {
  LayoutDashboard, List, FileText, Building2, Users, Archive, Shield, Search,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Filter, Download,
  AlertTriangle, Clock, CheckCircle, XCircle, Eye, ArrowUpDown, RotateCcw,
  Menu, TrendingUp, Activity, Target, Zap, BarChart3, FileSpreadsheet
} from "lucide-react";
import * as XLSX from "sheetjs";

// ─── FRENCH LABELS ───────────────────────────────────────────────
const CAT_LABELS = { EASY_WIN:"Facile", CONFLICT:"Conflit", BLOCKED:"Bloqué", WAITING:"En attente", FAST_REJECT:"Rejet rapide", NOT_STARTED:"Non démarré" };
const ACTION_LABELS = { ISSUE_VISA:"Émettre VISA", ARBITRATE:"Arbitrer", ESCALATE:"Escalader", CHASE:"Relancer", HOLD:"Surveiller", DONE:"Terminé" };
const PHASE_LABELS = { primary:"Primaire", secondary:"Secondaire", moex_relance_secondary:"Relance MOEX", moex:"MOEX" };
const CONSENSUS_LABELS = { ALL_APPROVE:"Unanime OK", ALL_REJECT:"Unanime REF", MIXED:"Avis partagés", NOT_STARTED:"Aucun retour", INCOMPLETE:"Incomplet" };
const STATE_LABELS = { in_progress:"En cours", fully_responded:"Tous répondu", all_hors_mission:"Hors mission" };
const CONFLICT_LABELS = { hard:"Dur", soft:"Léger", none:"Aucun" };
const DECISION_LABELS = { approved:"Approuvé", approved_with_reservations:"Approuvé avec réserves", rejected:"Refusé", pending:"En attente", neutral_only:"Neutre" };
const TAG_LABELS = { VSO:"Visa Sans Observation", VAO:"Visa Avec Observation", REF:"Refusé", DEF:"Défavorable", FAV:"Favorable", SUSP:"Suspendu", HM:"Hors Mission", EN_ATTENTE:"En attente", GEMO_NJ:"Hors Mission BdC", NONE:"—", SS:"Sans Suite" };
const CLOSE_LABELS = { clean_close:"Clôture propre", forced_close:"Clôture forcée" };
const SL_LABELS = { CONFLICT:"Conflit", CHRONIC:"Chronique", WAITING:"En attente", MISSING:"Manquant", EASY_WIN:"Facile", FAST_REJECT:"Rejet rapide", NOT_STARTED:"Non démarré", BLOCKED:"Bloqué" };

// ─── COLORS ──────────────────────────────────────────────────────
const CAT_COLORS = { EASY_WIN:"#22c55e", CONFLICT:"#ef4444", BLOCKED:"#f97316", WAITING:"#3b82f6", FAST_REJECT:"#dc2626", NOT_STARTED:"#94a3b8" };
const PHASE_COLORS = { primary:"#3b82f6", secondary:"#14b8a6", moex_relance_secondary:"#f59e0b", moex:"#ef4444" };
const SEV_COLORS = { blocking:"#ef4444", caution:"#f59e0b", favorable:"#22c55e", neutral:"#94a3b8", non_response:"#3b82f6" };
const TAG_COLORS = { VSO:"#22c55e", VAO:"#86efac", REF:"#ef4444", DEF:"#dc2626", FAV:"#22c55e", SUSP:"#f59e0b", HM:"#94a3b8", EN_ATTENTE:"#3b82f6", GEMO_NJ:"#f97316", NONE:"#cbd5e1", SS:"#94a3b8" };
const DECISION_TAG_COLORS = { VSO:"#22c55e", REF:"#ef4444", HM:"#94a3b8", VAO:"#86efac" };
const PIE_COLORS = ["#3b82f6","#f97316","#22c55e","#ef4444","#8b5cf6","#14b8a6","#f59e0b","#6366f1"];

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────
const fmt = (n) => n == null ? "—" : typeof n === "number" ? (Number.isInteger(n) ? n.toLocaleString("fr-FR") : n.toFixed(1)) : String(n);
const pct = (n) => n == null ? "—" : `${(n * 100).toFixed(0)}%`;
const healthColor = (h) => h >= 70 ? "#22c55e" : h >= 50 ? "#f59e0b" : "#ef4444";
const scoreColor = (s) => s >= 80 ? "#ef4444" : s >= 60 ? "#f97316" : s >= 40 ? "#f59e0b" : s >= 20 ? "#3b82f6" : "#22c55e";

// ─── BADGE COMPONENT ─────────────────────────────────────────────
const Badge = ({ label, color, small }) => (
  <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${small ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs"}`}
    style={{ backgroundColor: color + "20", color, border: `1px solid ${color}40` }}>
    {label}
  </span>
);

// ─── SCORE BAR ───────────────────────────────────────────────────
const ScoreBar = ({ value }) => (
  <div className="flex items-center gap-1.5">
    <div className="w-12 h-2 rounded-full bg-slate-200 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: scoreColor(value) }} />
    </div>
    <span className="text-xs font-mono font-semibold" style={{ color: scoreColor(value) }}>{value}</span>
  </div>
);

// ─── COMPLETION BAR ──────────────────────────────────────────────
const CompletionBar = ({ ratio }) => (
  <div className="flex items-center gap-1.5">
    <div className="w-14 h-2 rounded-full bg-slate-200 overflow-hidden">
      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(ratio * 100)}%` }} />
    </div>
    <span className="text-xs text-slate-500">{pct(ratio)}</span>
  </div>
);

// ─── HEALTH BAR ──────────────────────────────────────────────────
const HealthBar = ({ value }) => (
  <div className="flex items-center gap-1.5">
    <div className="w-16 h-2.5 rounded-full bg-slate-200 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: healthColor(value) }} />
    </div>
    <span className="text-xs font-semibold" style={{ color: healthColor(value) }}>{value}</span>
  </div>
);

// ─── MULTI-SELECT DROPDOWN ───────────────────────────────────────
const MultiSelect = ({ label, options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const toggle = (v) => {
    const next = new Set(selected);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next);
  };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-all ${selected.size > 0 ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"}`}>
        {label}{selected.size > 0 && <span className="ml-1 bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">{selected.size}</span>}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-200 max-h-64 overflow-hidden" style={{ left: 0 }}>
          {options.length > 8 && (
            <div className="p-2 border-b border-slate-100">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
                className="w-full px-2 py-1 text-xs border border-slate-200 rounded" />
            </div>
          )}
          <div className="overflow-y-auto max-h-48">
            {filtered.map(o => (
              <label key={o} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs">
                <input type="checkbox" checked={selected.has(o)} onChange={() => toggle(o)} className="rounded border-slate-300" />
                <span className="truncate">{o}</span>
              </label>
            ))}
          </div>
          {selected.size > 0 && (
            <div className="border-t border-slate-100 p-1.5">
              <button onClick={() => onChange(new Set())} className="text-xs text-red-500 hover:text-red-700 w-full text-center">Effacer</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── CHIP TOGGLES ────────────────────────────────────────────────
const ChipToggle = ({ items, selected, onChange, colorMap, labelMap }) => (
  <div className="flex flex-wrap gap-1">
    {items.map(item => {
      const active = selected.has(item);
      const color = colorMap?.[item] || "#64748b";
      const label = labelMap?.[item] || item;
      return (
        <button key={item} onClick={() => { const next = new Set(selected); next.has(item) ? next.delete(item) : next.add(item); onChange(next); }}
          className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${active ? "text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          style={active ? { backgroundColor: color } : {}}>
          {label}
        </button>
      );
    })}
  </div>
);

// ─── KPI CARD ────────────────────────────────────────────────────
const KPICard = ({ label, value, color, icon: Icon, suffix, onClick }) => (
  <button onClick={onClick}
    className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1 hover:shadow-md transition-all hover:border-slate-300 text-left flex-1 min-w-0">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-500 truncate">{label}</span>
      {Icon && <Icon size={14} className="text-slate-400 flex-shrink-0" />}
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-bold" style={{ color }}>{fmt(value)}</span>
      {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
    </div>
  </button>
);

// ─── SORTABLE TABLE HEADER ───────────────────────────────────────
const SortHeader = ({ label, field, sort, onSort, className = "" }) => (
  <th className={`px-3 py-2.5 text-left text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap ${className}`}
    onClick={() => onSort(field)}>
    <div className="flex items-center gap-1">
      {label}
      {sort.field === field ? (sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="text-slate-300" />}
    </div>
  </th>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN APPLICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchText, setSearchText] = useState("");
  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filters
  const [filterLot, setFilterLot] = useState(new Set());
  const [filterEmetteur, setFilterEmetteur] = useState(new Set());
  const [filterCat, setFilterCat] = useState(new Set());
  const [filterAction, setFilterAction] = useState(new Set());
  const [filterPhase, setFilterPhase] = useState(new Set());
  const [filterConsensus, setFilterConsensus] = useState(new Set());
  const [filterConflict, setFilterConflict] = useState(new Set());
  const [filterSL, setFilterSL] = useState(new Set());
  const [filterOverdue, setFilterOverdue] = useState("all");
  const [filterMoexHolder, setFilterMoexHolder] = useState(false);
  const [filterArbitration, setFilterArbitration] = useState(false);
  const [sort, setSort] = useState({ field: "score", dir: "desc" });
  const [selectedRows, setSelectedRows] = useState(new Set());
  const queueScrollRef = useRef(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(searchTimer.current);
  }, [searchText]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const resp = await fetch("/uploads/cockpit_data.json");
        if (!resp.ok) throw new Error("Failed to load");
        const json = await resp.json();
        setData(json);
      } catch {
        // Fallback: try relative path
        try {
          const resp2 = await fetch("./cockpit_data.json");
          const json2 = await resp2.json();
          setData(json2);
        } catch {
          console.error("Could not load cockpit_data.json");
        }
      }
      setLoading(false);
    };
    loadData();
  }, []);

  // ─── Derived unique values ─────────────────────────────────────
  const uniqueLots = useMemo(() => data ? [...new Set(data.queue.map(q => q.lot))].sort() : [], [data]);
  const uniqueEmetteurs = useMemo(() => data ? [...new Set(data.queue.map(q => q.emetteur))].sort() : [], [data]);

  // ─── Filter count ──────────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterLot.size) c++; if (filterEmetteur.size) c++; if (filterCat.size) c++;
    if (filterAction.size) c++; if (filterPhase.size) c++; if (filterConsensus.size) c++;
    if (filterConflict.size) c++; if (filterSL.size) c++; if (filterOverdue !== "all") c++;
    if (filterMoexHolder) c++; if (filterArbitration) c++; if (debouncedSearch) c++;
    return c;
  }, [filterLot, filterEmetteur, filterCat, filterAction, filterPhase, filterConsensus, filterConflict, filterSL, filterOverdue, filterMoexHolder, filterArbitration, debouncedSearch]);

  const resetFilters = useCallback(() => {
    setFilterLot(new Set()); setFilterEmetteur(new Set()); setFilterCat(new Set());
    setFilterAction(new Set()); setFilterPhase(new Set()); setFilterConsensus(new Set());
    setFilterConflict(new Set()); setFilterSL(new Set()); setFilterOverdue("all");
    setFilterMoexHolder(false); setFilterArbitration(false); setSearchText(""); setDebouncedSearch("");
  }, []);

  // ─── Filtered + sorted queue ───────────────────────────────────
  const filteredQueue = useMemo(() => {
    if (!data) return [];
    let q = data.queue;
    if (filterLot.size) q = q.filter(i => filterLot.has(i.lot));
    if (filterEmetteur.size) q = q.filter(i => filterEmetteur.has(i.emetteur));
    if (filterCat.size) q = q.filter(i => filterCat.has(i.cat));
    if (filterAction.size) q = q.filter(i => filterAction.has(i.action));
    if (filterPhase.size) q = q.filter(i => filterPhase.has(i.responsibility_phase));
    if (filterConsensus.size) q = q.filter(i => filterConsensus.has(i.consensus));
    if (filterConflict.size) q = q.filter(i => filterConflict.has(i.conflict_severity));
    if (filterSL.size) q = q.filter(i => i.sl && i.sl.some(s => filterSL.has(s)));
    if (filterOverdue === "late") q = q.filter(i => i.overdue > 0);
    else if (filterOverdue === "30") q = q.filter(i => i.overdue > 30);
    else if (filterOverdue === "60") q = q.filter(i => i.overdue > 60);
    if (filterMoexHolder) q = q.filter(i => i.is_moex_holder);
    if (filterArbitration) q = q.filter(i => i.is_arbitration_required);
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      q = q.filter(i => (i.titre || "").toLowerCase().includes(s) || (i.doc || "").toLowerCase().includes(s) || (i.lot || "").toLowerCase().includes(s) || (i.emetteur || "").toLowerCase().includes(s) || (i.submittal_key || "").toLowerCase().includes(s));
    }
    // Sort
    const { field, dir } = sort;
    const mult = dir === "asc" ? 1 : -1;
    q = [...q].sort((a, b) => {
      let va = a[field], vb = b[field];
      if (va == null && vb == null) return 0;
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === "string") return mult * va.localeCompare(vb, "fr");
      return mult * (va - vb);
    });
    return q;
  }, [data, filterLot, filterEmetteur, filterCat, filterAction, filterPhase, filterConsensus, filterConflict, filterSL, filterOverdue, filterMoexHolder, filterArbitration, debouncedSearch, sort]);

  const handleSort = useCallback((field) => {
    setSort(prev => prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" });
  }, []);

  // ─── Virtual scroll ────────────────────────────────────────────
  const ROW_HEIGHT = 44;
  const handleQueueScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop;
    const viewHeight = e.target.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
    const end = Math.min(filteredQueue.length, Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + 5);
    setVisibleRange({ start, end });
  }, [filteredQueue.length]);

  // ─── Excel Export ──────────────────────────────────────────────
  const exportExcel = useCallback((items, filename = "MOEX_Export") => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    // Sheet 1: Queue
    const queueData = items.map(q => ({
      "Score": q.score, "Document": q.doc, "Indice": q.indice, "Titre": q.titre,
      "Lot": q.lot, "Émetteur": q.emetteur, "Catégorie": CAT_LABELS[q.cat] || q.cat,
      "Consensus": CONSENSUS_LABELS[q.consensus] || q.consensus, "Retard (j)": q.overdue,
      "Complétion": pct(q.completion_ratio), "Holders": q.holder_count,
      "Phase": PHASE_LABELS[q.responsibility_phase] || q.responsibility_phase,
      "Action": q.action_needed || ACTION_LABELS[q.action] || q.action,
      "Résumé blocage": q.blocking_summary, "Holders détail": (q.current_holders || []).join(", "),
      "Retardataires": (q.late_actors || []).join(", "), "Ancienneté (j)": q.aging_days,
      "MOEX holder": q.is_moex_holder ? "Oui" : "Non", "Arbitrage": q.is_arbitration_required ? "Oui" : "Non"
    }));
    const ws1 = XLSX.utils.json_to_sheet(queueData);
    ws1["!cols"] = Object.keys(queueData[0] || {}).map((k) => ({ wch: Math.max(k.length, 12) }));
    XLSX.utils.book_append_sheet(wb, ws1, "File d'attente");
    // Sheet 2: KPIs
    const kpiRows = [
      { "Indicateur": "Dossiers ouverts", "Valeur": data.kpis.total_open },
      { "Indicateur": "En retard", "Valeur": data.kpis.late },
      { "Indicateur": "Bloqués", "Valeur": data.kpis.blocked },
      { "Indicateur": "Arbitrage requis", "Valeur": data.kpis.arbitration },
      { "Indicateur": "MOEX en retard", "Valeur": data.kpis.moex_late },
      { "Indicateur": "Retard moyen (j)", "Valeur": data.kpis.avg_delay_days },
      { "Indicateur": "Pire émetteur", "Valeur": data.kpis.worst_emetteur },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiRows), "KPIs");
    // Sheet 3: Lots
    const lotRows = data.lots.map(l => ({
      "Lot": l.code, "Santé": l.health, "Total": l.total, "En attente": l.pending,
      "Retard": l.overdue, "Refusé": l.ref, "Chronique": l.chronic,
      "Complet": l.fully_responded, "Conflit dur": l.hard_conflict, "Backlog": l.backlog, "Complétion moy.": l.avg_completion
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lotRows), "Lots");
    XLSX.writeFile(wb, `${filename}_${data.generated_at}.xlsx`);
  }, [data]);

  // ─── Navigate to queue with filter ─────────────────────────────
  const goQueue = useCallback((filterType, value) => {
    resetFilters();
    if (filterType === "cat") setFilterCat(new Set([value]));
    else if (filterType === "phase") setFilterPhase(new Set([value]));
    else if (filterType === "lot") setFilterLot(new Set([value]));
    else if (filterType === "sl") setFilterSL(new Set([value]));
    else if (filterType === "moex_holder") setFilterMoexHolder(true);
    else if (filterType === "arbitration") setFilterArbitration(true);
    else if (filterType === "late") setFilterOverdue("late");
    else if (filterType === "mission") {
      // Filter by mission in current_holders or missing
      setSearchText("");
      setDebouncedSearch("");
    }
    setView("queue");
  }, [resetFilters]);

  // ─── Loading state ─────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Chargement du cockpit MOEX...</p>
      </div>
    </div>
  );
  if (!data) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-red-500">Erreur: impossible de charger cockpit_data.json</p>
    </div>
  );

  const { kpis, categories, lots, queue, mission_stats, closed_summary, trend_30j, socotec_registry } = data;

  // ─── SIDEBAR ───────────────────────────────────────────────────
  const navItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
    { id: "queue", icon: List, label: "File d'attente" },
    { id: "lots", icon: Building2, label: "Santé des lots" },
    { id: "missions", icon: Users, label: "Missions" },
    { id: "closed", icon: Archive, label: "Dossiers clôturés" },
    { id: "socotec", icon: Shield, label: "Registre SOCOTEC" },
  ];

  // ━━━ RENDER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ─── SIDEBAR ──────────────────────────────────── */}
      <aside className={`bg-slate-900 text-white flex flex-col transition-all duration-200 ${sidebarOpen ? "w-56" : "w-14"} flex-shrink-0`}>
        <div className="p-3 flex items-center gap-2 border-b border-slate-700">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-slate-700">
            <Menu size={18} />
          </button>
          {sidebarOpen && <span className="text-sm font-bold truncate">JANSA VISASIST</span>}
        </div>
        <nav className="flex-1 py-2">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => { setView(id); setSelectedItem(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all ${view === id ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
              <Icon size={18} className="flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </button>
          ))}
        </nav>
        {sidebarOpen && (
          <div className="p-3 border-t border-slate-700 text-xs text-slate-500">
            v{data.version} — {data.generated_at}
          </div>
        )}
      </aside>

      {/* ─── MAIN AREA ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ─── TOP BAR ──────────────────────────────── */}
        <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-800 truncate">P17&CO Tranche 2 — MOEX Cockpit</h1>
            <p className="text-xs text-slate-400">{data.generated_at}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-medium">{fmt(kpis.total_open)} ouverts</span>
              <span className="px-2 py-1 rounded bg-red-50 text-red-600 font-medium">{fmt(kpis.late)} retard</span>
              <span className="px-2 py-1 rounded bg-orange-50 text-orange-600 font-medium">{fmt(kpis.blocked)} bloqués</span>
              <span className="px-2 py-1 rounded bg-amber-50 text-amber-600 font-medium">{fmt(kpis.arbitration)} arbitrage</span>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                placeholder="Rechercher..." className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-48 focus:outline-none focus:border-blue-400" />
              {searchText && <button onClick={() => { setSearchText(""); setDebouncedSearch(""); }} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={12} className="text-slate-400" /></button>}
            </div>
          </div>
        </header>

        {/* ─── CONTENT ──────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4">

          {/* ═══════════════════════════════════════════ */}
          {/* DASHBOARD VIEW                              */}
          {/* ═══════════════════════════════════════════ */}
          {view === "dashboard" && (
            <div className="space-y-5 max-w-7xl mx-auto">
              {/* KPI Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <KPICard label="Dossiers ouverts" value={kpis.total_open} color="#1e293b" icon={FileText} onClick={() => goQueue(null)} />
                <KPICard label="En retard" value={kpis.late} color={kpis.late > kpis.total_open * 0.2 ? "#ef4444" : "#f59e0b"} icon={Clock} onClick={() => goQueue("late")} />
                <KPICard label="Bloqués (REF/DEF)" value={kpis.blocked} color="#ef4444" icon={XCircle} onClick={() => goQueue("cat", "BLOCKED")} />
                <KPICard label="Arbitrage requis" value={kpis.arbitration} color="#f97316" icon={AlertTriangle} onClick={() => goQueue("arbitration")} />
                <KPICard label="MOEX en retard" value={kpis.moex_late} color="#ef4444" icon={Activity} onClick={() => goQueue("moex_holder")} />
                <KPICard label="Easy Wins" value={categories.find(c => c.key === "EASY_WIN")?.count || 0} color="#22c55e" icon={Zap} onClick={() => goQueue("cat", "EASY_WIN")} />
                <KPICard label="Retard moyen" value={kpis.avg_delay_days} color={kpis.avg_delay_days > 30 ? "#ef4444" : "#f59e0b"} suffix="j" icon={TrendingUp} />
                <KPICard label="Clôturés" value={kpis.total_closed} color="#22c55e" icon={CheckCircle} onClick={() => setView("closed")} />
              </div>

              {/* Responsibility Waterfall */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Cascade de responsabilité</h3>
                <div className="flex items-center gap-0.5 h-10 rounded-lg overflow-hidden">
                  {[
                    { key: "primary", val: kpis.resp_primary, label: "Primaire", color: PHASE_COLORS.primary },
                    { key: "secondary", val: kpis.resp_secondary, label: "Secondaire", color: PHASE_COLORS.secondary },
                    { key: "moex_relance_secondary", val: kpis.resp_moex_relance, label: "Relance MOEX", color: PHASE_COLORS.moex_relance_secondary },
                    { key: "moex", val: kpis.resp_moex, label: "MOEX", color: PHASE_COLORS.moex },
                  ].map(seg => {
                    const w = (seg.val / kpis.total_open) * 100;
                    if (w < 1) return null;
                    return (
                      <button key={seg.key} onClick={() => goQueue("phase", seg.key)}
                        className="h-full flex items-center justify-center text-white text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
                        style={{ width: `${w}%`, backgroundColor: seg.color, minWidth: w > 3 ? "auto" : "24px" }}
                        title={`${seg.label}: ${seg.val}`}>
                        {w > 8 && `${seg.label} (${seg.val})`}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-2">
                  {[
                    { label: "Primaire", val: kpis.resp_primary, color: PHASE_COLORS.primary },
                    { label: "Secondaire", val: kpis.resp_secondary, color: PHASE_COLORS.secondary },
                    { label: "Relance MOEX", val: kpis.resp_moex_relance, color: PHASE_COLORS.moex_relance_secondary },
                    { label: "MOEX", val: kpis.resp_moex, color: PHASE_COLORS.moex },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                      <span className="text-slate-500">{l.label}:</span>
                      <span className="font-semibold text-slate-700">{l.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Cards + Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Categories */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Catégories</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {categories.map(cat => (
                      <button key={cat.key} onClick={() => goQueue("cat", cat.key)}
                        className="p-3 rounded-lg border-2 hover:shadow-md transition-all text-center"
                        style={{ borderColor: CAT_COLORS[cat.key] + "60", backgroundColor: CAT_COLORS[cat.key] + "08" }}>
                        <div className="text-2xl font-bold" style={{ color: CAT_COLORS[cat.key] }}>{cat.count}</div>
                        <div className="text-xs font-medium text-slate-600 mt-0.5">{CAT_LABELS[cat.key]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trend 30j */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Tendance 30 jours</h3>
                  {trend_30j?.global?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={trend_30j.global}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d?.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} labelFormatter={d => `Date: ${d}`} />
                        <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="Dossiers ouverts" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <p className="text-xs text-slate-400 text-center py-8">Aucune donnée de tendance</p>}
                </div>
              </div>

              {/* Top Defaulters + MOEX Sub-phases */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Top défaillants (secondaires)</h3>
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-100">
                      <th className="text-left py-1.5 font-semibold text-slate-500">Mission</th>
                      <th className="text-right py-1.5 font-semibold text-slate-500">Défauts</th>
                    </tr></thead>
                    <tbody>
                      {(kpis.top_defaulters || []).map((d, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-1.5 text-slate-700">{d.mission}</td>
                          <td className="py-1.5 text-right font-semibold text-red-600">{d.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Sous-phases MOEX</h3>
                  <div className="space-y-2">
                    {[
                      { label: "Tous répondu", val: kpis.moex_all_responded, color: "#22c55e" },
                      { label: "Défaut secondaire", val: kpis.moex_secondary_default, color: "#f59e0b" },
                      { label: "Sans secondaire", val: kpis.moex_no_secondary, color: "#94a3b8" },
                      { label: "Orphelin", val: kpis.moex_orphan, color: "#ef4444" },
                    ].map(sp => (
                      <div key={sp.label} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: sp.color }} />
                        <span className="text-xs text-slate-600 flex-1">{sp.label}</span>
                        <span className="text-sm font-bold" style={{ color: sp.color }}>{sp.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* QUEUE VIEW                                  */}
          {/* ═══════════════════════════════════════════ */}
          {view === "queue" && (
            <div className="flex flex-col h-full max-w-full">
              {/* Filter Bar */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 space-y-2 flex-shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter size={14} className="text-slate-400" />
                  <MultiSelect label="Lot" options={uniqueLots} selected={filterLot} onChange={setFilterLot} />
                  <MultiSelect label="Émetteur" options={uniqueEmetteurs} selected={filterEmetteur} onChange={setFilterEmetteur} />
                  <ChipToggle items={["EASY_WIN","CONFLICT","BLOCKED","WAITING","FAST_REJECT","NOT_STARTED"]} selected={filterCat} onChange={setFilterCat} colorMap={CAT_COLORS} labelMap={CAT_LABELS} />
                  <div className="w-px h-5 bg-slate-200" />
                  <ChipToggle items={["ISSUE_VISA","ARBITRATE","CHASE","DONE"]} selected={filterAction} onChange={setFilterAction} colorMap={{ISSUE_VISA:"#22c55e",ARBITRATE:"#f97316",CHASE:"#3b82f6",DONE:"#94a3b8"}} labelMap={ACTION_LABELS} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <ChipToggle items={["primary","secondary","moex_relance_secondary","moex"]} selected={filterPhase} onChange={setFilterPhase} colorMap={PHASE_COLORS} labelMap={PHASE_LABELS} />
                  <div className="w-px h-5 bg-slate-200" />
                  <ChipToggle items={["ALL_APPROVE","ALL_REJECT","MIXED","NOT_STARTED"]} selected={filterConsensus} onChange={setFilterConsensus} colorMap={{ALL_APPROVE:"#22c55e",ALL_REJECT:"#ef4444",MIXED:"#f59e0b",NOT_STARTED:"#94a3b8"}} labelMap={CONSENSUS_LABELS} />
                  <div className="w-px h-5 bg-slate-200" />
                  <ChipToggle items={["hard","soft","none"]} selected={filterConflict} onChange={setFilterConflict} colorMap={{hard:"#ef4444",soft:"#f59e0b",none:"#94a3b8"}} labelMap={CONFLICT_LABELS} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500">Listes:</span>
                  <ChipToggle items={["CHRONIC","MISSING","BLOCKED","CONFLICT","EASY_WIN"]} selected={filterSL} onChange={setFilterSL} colorMap={{CHRONIC:"#8b5cf6",MISSING:"#ef4444",BLOCKED:"#f97316",CONFLICT:"#ef4444",EASY_WIN:"#22c55e"}} labelMap={SL_LABELS} />
                  <div className="w-px h-5 bg-slate-200" />
                  <span className="text-xs text-slate-500">Retard:</span>
                  {["all","late","30","60"].map(v => (
                    <button key={v} onClick={() => setFilterOverdue(v)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${filterOverdue === v ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {{ all:"Tous", late:"En retard", "30":"> 30j", "60":"> 60j" }[v]}
                    </button>
                  ))}
                  <div className="w-px h-5 bg-slate-200" />
                  <button onClick={() => setFilterMoexHolder(!filterMoexHolder)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${filterMoexHolder ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                    MOEX holder
                  </button>
                  <button onClick={() => setFilterArbitration(!filterArbitration)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${filterArbitration ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                    Arbitrage
                  </button>
                  <div className="flex-1" />
                  {activeFilterCount > 0 && (
                    <button onClick={resetFilters} className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded">
                      <RotateCcw size={12} /> Réinitialiser ({activeFilterCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Queue Header */}
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <span className="text-sm font-semibold text-slate-700">{filteredQueue.length} dossiers{activeFilterCount > 0 ? " (filtré)" : ""}</span>
                <div className="flex gap-2">
                  {selectedRows.size > 0 && (
                    <button onClick={() => { const items = filteredQueue.filter(q => selectedRows.has(q.id)); exportExcel(items, "Selection"); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                      <Download size={12} /> Exporter sélection ({selectedRows.size})
                    </button>
                  )}
                  <button onClick={() => exportExcel(filteredQueue, "Queue_filtree")}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 text-white rounded-lg hover:bg-slate-800">
                    <FileSpreadsheet size={12} /> Exporter vue ({filteredQueue.length})
                  </button>
                </div>
              </div>

              {/* Queue Table */}
              <div className="bg-white rounded-xl border border-slate-200 flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="overflow-x-auto flex-shrink-0">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-2 py-2.5 w-8">
                          <input type="checkbox" className="rounded border-slate-300"
                            checked={selectedRows.size === filteredQueue.length && filteredQueue.length > 0}
                            onChange={e => setSelectedRows(e.target.checked ? new Set(filteredQueue.map(q => q.id)) : new Set())} />
                        </th>
                        <SortHeader label="Score" field="score" sort={sort} onSort={handleSort} />
                        <SortHeader label="Doc" field="doc" sort={sort} onSort={handleSort} />
                        <SortHeader label="Ind." field="rev" sort={sort} onSort={handleSort} />
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Titre</th>
                        <SortHeader label="Lot" field="lot" sort={sort} onSort={handleSort} />
                        <SortHeader label="Ém." field="emetteur" sort={sort} onSort={handleSort} />
                        <SortHeader label="Cat." field="cat" sort={sort} onSort={handleSort} />
                        <SortHeader label="Consensus" field="consensus" sort={sort} onSort={handleSort} />
                        <SortHeader label="Retard" field="overdue" sort={sort} onSort={handleSort} />
                        <SortHeader label="Compl." field="completion_ratio" sort={sort} onSort={handleSort} />
                        <SortHeader label="Holders" field="holder_count" sort={sort} onSort={handleSort} />
                        <SortHeader label="Phase" field="responsibility_phase" sort={sort} onSort={handleSort} />
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Action</th>
                      </tr>
                    </thead>
                  </table>
                </div>
                <div className="overflow-auto flex-1" ref={queueScrollRef} onScroll={handleQueueScroll}>
                  <div style={{ height: filteredQueue.length * ROW_HEIGHT, position: "relative" }}>
                    {filteredQueue.slice(visibleRange.start, visibleRange.end).map((q, idx) => (
                      <div key={q.id} className="flex items-center border-b border-slate-50 hover:bg-blue-50 cursor-pointer transition-colors"
                        style={{ position: "absolute", top: (visibleRange.start + idx) * ROW_HEIGHT, height: ROW_HEIGHT, width: "100%" }}
                        onClick={() => setSelectedItem(q)}>
                        <div className="px-2 w-8 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded border-slate-300"
                            checked={selectedRows.has(q.id)}
                            onChange={() => { const next = new Set(selectedRows); next.has(q.id) ? next.delete(q.id) : next.add(q.id); setSelectedRows(next); }} />
                        </div>
                        <div className="px-3 w-20 flex-shrink-0"><ScoreBar value={q.score} /></div>
                        <div className="px-3 w-24 flex-shrink-0 text-xs font-mono text-slate-700 truncate">{q.doc}</div>
                        <div className="px-3 w-12 flex-shrink-0 text-xs text-center text-slate-500">{q.indice}</div>
                        <div className="px-3 flex-1 min-w-0 text-xs text-slate-600 truncate" title={q.titre}>{q.titre}</div>
                        <div className="px-3 w-16 flex-shrink-0 text-xs font-medium text-slate-700">{q.lot}</div>
                        <div className="px-3 w-14 flex-shrink-0 text-xs text-slate-500">{q.emetteur}</div>
                        <div className="px-3 w-20 flex-shrink-0"><Badge label={CAT_LABELS[q.cat] || q.cat} color={CAT_COLORS[q.cat] || "#94a3b8"} small /></div>
                        <div className="px-3 w-24 flex-shrink-0"><Badge label={CONSENSUS_LABELS[q.consensus] || q.consensus} color={q.consensus === "ALL_APPROVE" ? "#22c55e" : q.consensus === "ALL_REJECT" ? "#ef4444" : q.consensus === "MIXED" ? "#f59e0b" : "#94a3b8"} small /></div>
                        <div className="px-3 w-16 flex-shrink-0 text-xs font-mono text-right" style={{ color: q.overdue > 0 ? "#ef4444" : "#22c55e" }}>{q.overdue > 0 ? `+${q.overdue}j` : "0j"}</div>
                        <div className="px-3 w-20 flex-shrink-0"><CompletionBar ratio={q.completion_ratio} /></div>
                        <div className="px-3 w-16 flex-shrink-0 text-xs text-center" title={(q.current_holders || []).join("\n")}>{q.holder_count}</div>
                        <div className="px-3 w-24 flex-shrink-0"><Badge label={PHASE_LABELS[q.responsibility_phase] || q.responsibility_phase} color={PHASE_COLORS[q.responsibility_phase] || "#94a3b8"} small /></div>
                        <div className="px-3 w-32 flex-shrink-0 text-xs text-slate-600 truncate" title={q.action_needed}>{q.action_needed || ACTION_LABELS[q.action] || q.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* LOT HEALTH VIEW                             */}
          {/* ═══════════════════════════════════════════ */}
          {view === "lots" && (
            <div className="max-w-7xl mx-auto">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Santé des lots</h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Lot","Santé","Total","En attente","Retard","Refusé","Chronique","Complet","Conflit dur","Backlog","Compl. moy."].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map(l => (
                      <tr key={l.code} className="border-b border-slate-50 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => { resetFilters(); setFilterLot(new Set([l.code])); setView("queue"); }}>
                        <td className="px-3 py-2 font-medium text-slate-800">{l.code}</td>
                        <td className="px-3 py-2"><HealthBar value={l.health} /></td>
                        <td className="px-3 py-2 text-slate-600">{l.total}</td>
                        <td className="px-3 py-2 text-blue-600 font-medium">{l.pending}</td>
                        <td className="px-3 py-2 text-red-500 font-medium">{l.overdue}</td>
                        <td className="px-3 py-2 text-red-600 font-medium">{l.ref}</td>
                        <td className="px-3 py-2 text-purple-600">{l.chronic}</td>
                        <td className="px-3 py-2 text-green-600">{l.fully_responded}</td>
                        <td className="px-3 py-2 text-red-500">{l.hard_conflict}</td>
                        <td className="px-3 py-2 text-orange-600">{l.backlog}</td>
                        <td className="px-3 py-2 text-slate-500">{l.avg_completion?.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* MISSIONS VIEW                               */}
          {/* ═══════════════════════════════════════════ */}
          {view === "missions" && (
            <div className="max-w-7xl mx-auto">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Missions</h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Mission","","Holds","Sole holds","Retards","Multi","Conflits","Retard moy. (j)","Part backlog"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mission_stats.map(m => (
                      <tr key={m.mission} className="border-b border-slate-50 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => { resetFilters(); setSearchText(m.mission.split(" ").pop()); setView("queue"); }}>
                        <td className="px-3 py-2 font-medium text-slate-800">{m.mission}</td>
                        <td className="px-3 py-2">{m.is_moex && <Badge label="MOEX" color="#ef4444" small />}</td>
                        <td className="px-3 py-2 text-red-600 font-bold">{m.holds}</td>
                        <td className="px-3 py-2 text-orange-600 font-medium">{m.sole_holds}</td>
                        <td className="px-3 py-2 text-red-500">{m.late}</td>
                        <td className="px-3 py-2 text-slate-600">{m.multi}</td>
                        <td className="px-3 py-2 text-orange-500">{m.conflicts}</td>
                        <td className="px-3 py-2 text-slate-600">{m.avg_delay?.toFixed(1)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${m.backlog_share}%` }} />
                            </div>
                            <span className="text-slate-500">{m.backlog_share}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* CLOSED VIEW                                 */}
          {/* ═══════════════════════════════════════════ */}
          {view === "closed" && (
            <div className="max-w-7xl mx-auto space-y-5">
              <h2 className="text-lg font-bold text-slate-800">Dossiers clôturés ({closed_summary.count})</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pie: Clean vs Forced */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Type de clôture</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={Object.entries(closed_summary.by_close_type).map(([k, v]) => ({ name: CLOSE_LABELS[k] || k, value: v }))}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                        {Object.keys(closed_summary.by_close_type).map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "#f97316" : "#22c55e"} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Bar: By Decision Tag */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Par décision</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={Object.entries(closed_summary.by_decision_tag).map(([k, v]) => ({ name: TAG_LABELS[k] || k, value: v, key: k }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {Object.entries(closed_summary.by_decision_tag).map(([k], i) => (
                          <Cell key={i} fill={DECISION_TAG_COLORS[k] || PIE_COLORS[i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Rejection Rate Table */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Taux de rejet par émetteur</h3>
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Émetteur</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">Clôturés</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">Refusés</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">Taux rejet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(closed_summary.emetteur_rejection || []).map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-medium text-slate-700">{r.emetteur}</td>
                        <td className="px-3 py-1.5 text-right text-slate-600">{r.total_closed}</td>
                        <td className="px-3 py-1.5 text-right text-red-600 font-medium">{r.rejected}</td>
                        <td className="px-3 py-1.5 text-right">
                          <span className={`font-bold ${r.rejection_rate > 50 ? "text-red-600" : r.rejection_rate > 25 ? "text-orange-500" : "text-green-600"}`}>
                            {r.rejection_rate?.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* SOCOTEC VIEW                                */}
          {/* ═══════════════════════════════════════════ */}
          {view === "socotec" && (
            <div className="max-w-7xl mx-auto">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Registre SOCOTEC ({(socotec_registry || []).length} fiches)</h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Fiche","Date","Pages","Docs","FAV","SUSP","DEF","Fichier"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(socotec_registry || []).map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700">{r.fiche_number}</td>
                        <td className="px-3 py-2 text-slate-600">{r.fiche_date}</td>
                        <td className="px-3 py-2 text-slate-500">{r.pages}</td>
                        <td className="px-3 py-2 text-slate-600">{r.docs_listed}</td>
                        <td className="px-3 py-2 text-green-600 font-medium">{r.fav_explicit}</td>
                        <td className="px-3 py-2 text-amber-600 font-medium">{r.susp_explicit}</td>
                        <td className="px-3 py-2 text-red-600 font-medium">{r.def_explicit}</td>
                        <td className="px-3 py-2 text-slate-400 truncate max-w-xs" title={r.filename}>{r.filename}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <tr>
                      <td className="px-3 py-2 text-slate-700">Total</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-slate-600">{(socotec_registry || []).reduce((s, r) => s + (r.pages || 0), 0)}</td>
                      <td className="px-3 py-2 text-slate-600">{(socotec_registry || []).reduce((s, r) => s + (r.docs_listed || 0), 0)}</td>
                      <td className="px-3 py-2 text-green-600">{(socotec_registry || []).reduce((s, r) => s + (r.fav_explicit || 0), 0)}</td>
                      <td className="px-3 py-2 text-amber-600">{(socotec_registry || []).reduce((s, r) => s + (r.susp_explicit || 0), 0)}</td>
                      <td className="px-3 py-2 text-red-600">{(socotec_registry || []).reduce((s, r) => s + (r.def_explicit || 0), 0)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* DETAIL PANEL (SLIDE-IN)                        */}
      {/* ═══════════════════════════════════════════════ */}
      {selectedItem && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelectedItem(null)} />
          <div className="fixed top-0 right-0 h-full w-3/5 bg-white shadow-2xl z-50 flex flex-col overflow-hidden animate-slideIn">
            {/* Detail Header */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-start gap-3 flex-shrink-0">
              <button onClick={() => setSelectedItem(null)} className="p-1.5 rounded-lg hover:bg-slate-200 mt-0.5"><X size={18} /></button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold text-slate-800">{selectedItem.doc}</span>
                  <Badge label={`Ind. ${selectedItem.indice}`} color="#64748b" />
                  <Badge label={CAT_LABELS[selectedItem.cat] || selectedItem.cat} color={CAT_COLORS[selectedItem.cat] || "#94a3b8"} />
                  <ScoreBar value={selectedItem.score} />
                </div>
                <p className="text-sm text-slate-600 mt-1">{selectedItem.titre}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>Lot: <strong className="text-slate-700">{selectedItem.lot}</strong></span>
                  <span>Émetteur: <strong className="text-slate-700">{selectedItem.emetteur}</strong></span>
                </div>
              </div>
            </div>

            {/* Detail Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Status Cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">État</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">{STATE_LABELS[selectedItem.current_state] || selectedItem.current_state}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Décision</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">{DECISION_LABELS[selectedItem.final_decision] || selectedItem.final_decision}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Conflit</div>
                  <Badge label={CONFLICT_LABELS[selectedItem.conflict_severity] || selectedItem.conflict_severity}
                    color={selectedItem.conflict_severity === "hard" ? "#ef4444" : selectedItem.conflict_severity === "soft" ? "#f59e0b" : "#94a3b8"} />
                  {selectedItem.worst_tag && <span className="ml-1 text-xs text-slate-500">({TAG_LABELS[selectedItem.worst_tag] || selectedItem.worst_tag})</span>}
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Phase</div>
                  <Badge label={PHASE_LABELS[selectedItem.responsibility_phase] || selectedItem.responsibility_phase}
                    color={PHASE_COLORS[selectedItem.responsibility_phase] || "#94a3b8"} />
                  {selectedItem.responsible_missions?.length > 0 && (
                    <div className="text-xs text-slate-500 mt-1">{selectedItem.responsible_missions.join(", ")}</div>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Action</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">{selectedItem.action_needed || ACTION_LABELS[selectedItem.action]}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Blocage</div>
                  <div className="text-sm text-slate-700 mt-0.5">{selectedItem.blocking_summary || "—"}</div>
                </div>
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="px-2 py-1 rounded bg-slate-100 text-slate-600">Ancienneté: <strong>{selectedItem.aging_days}j</strong></span>
                {selectedItem.is_moex_holder && <span className="px-2 py-1 rounded bg-red-50 text-red-600 font-medium">MOEX holder</span>}
                {selectedItem.is_moex_late && <span className="px-2 py-1 rounded bg-red-50 text-red-600 font-medium">MOEX en retard</span>}
                {selectedItem.moex_default_flag && <span className="px-2 py-1 rounded bg-orange-50 text-orange-600 font-medium">MOEX défaut</span>}
                {selectedItem.moex_sub_phase && <span className="px-2 py-1 rounded bg-blue-50 text-blue-600">Sub-phase: {selectedItem.moex_sub_phase}</span>}
                {selectedItem.secondary_window_remaining != null && <span className="px-2 py-1 rounded bg-teal-50 text-teal-600">Fenêtre secondaire: {selectedItem.secondary_window_remaining}j restants</span>}
                {selectedItem.defaulted_missions?.length > 0 && <span className="px-2 py-1 rounded bg-red-50 text-red-600">Défaillants: {selectedItem.defaulted_missions.join(", ")}</span>}
              </div>

              {/* Response Table */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Réponses ({selectedItem.responses?.length || 0})</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Acteur</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Réponse</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Sévérité</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Deadline</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Répondu le</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-600">Retard</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Commentaire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedItem.responses || []).map((r, i) => {
                        const bgColor = r.response_severity === "favorable" ? "#f0fdf4" : r.response_severity === "caution" ? "#fffbeb" : r.response_severity === "blocking" ? "#fef2f2" : r.is_pending ? "#f8fafc" : "#ffffff";
                        return (
                          <tr key={i} style={{ backgroundColor: bgColor }} className="border-b border-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-700">
                              {r.actor_clean?.replace(/^[0-9A-Z]-/, "")}
                              {r.is_moex && <span className="ml-1 text-red-500 text-xs">(MOEX)</span>}
                              {!r.is_relevant && <span className="ml-1 text-slate-400 text-xs">(non pertinent)</span>}
                            </td>
                            <td className="px-3 py-2"><Badge label={TAG_LABELS[r.response_tag_code] || r.response_tag_code} color={TAG_COLORS[r.response_tag_code] || "#94a3b8"} small /></td>
                            <td className="px-3 py-2"><span className="w-2 h-2 inline-block rounded-full mr-1" style={{ backgroundColor: SEV_COLORS[r.response_severity] || "#94a3b8" }} />{r.response_severity}</td>
                            <td className="px-3 py-2 text-slate-500">{r.deadline_date || "—"}</td>
                            <td className="px-3 py-2 text-slate-500">{r.response_date || "—"}</td>
                            <td className="px-3 py-2 text-right font-mono" style={{ color: r.delay_days > 0 ? "#ef4444" : r.delay_days < 0 ? "#22c55e" : "#94a3b8" }}>
                              {r.delay_days != null ? (r.delay_days > 0 ? `+${r.delay_days}` : r.delay_days) : "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-600 max-w-xs truncate" title={r.comment || ""}>{r.comment || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Comments by Actor */}
              {selectedItem.comments_by_actor && Object.keys(selectedItem.comments_by_actor).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Commentaires</h3>
                  <div className="space-y-2">
                    {Object.entries(selectedItem.comments_by_actor).map(([actor, comments]) => (
                      <div key={actor} className="border border-slate-200 rounded-lg p-3">
                        <div className="text-xs font-semibold text-slate-600 mb-1">{actor.replace(/^[0-9A-Z]-/, "")}</div>
                        {comments.map((c, i) => (
                          <p key={i} className="text-xs text-slate-700 leading-relaxed">{c}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Lists */}
              {selectedItem.sl?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Listes intelligentes</h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.sl.map(s => (
                      <Badge key={s} label={SL_LABELS[s] || s} color={s === "CHRONIC" ? "#8b5cf6" : s === "MISSING" ? "#ef4444" : CAT_COLORS[s] || "#64748b"} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slideIn { animation: slideIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
