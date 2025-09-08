import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Label, Tooltip, CartesianGrid, LabelList, Legend, Scatter, Cell } from "recharts";

// ---------------------- Types ----------------------
/** @typedef {{ id: string; name: string; container: string; quantity: number; min?: number; notes?: string }} Item */

// ---------------------- Config ----------------------
const LS_KEY = "lab-reagent-inventory:v1";
// Paste your public Apps Script Web App URL (must be https://script.google.com/macros/s/.../exec)
const BASE_URL = "https://script.google.com/macros/s/AKfycbxySCkB42Yn_boka8EYRexyL1ymWd3agi_p0N32xwROuCg9NPbuzj-YROorbffxlFka/exec";
// Optional shared secret if you enabled TOKEN in Apps Script
const TOKEN = "";

// ---------------------- Utils ----------------------
const uid = () => Math.random().toString(36).slice(2, 9);

/** @returns {Item[]} */
function loadItems() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return getSeed();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getSeed();
    return parsed.map((x) => ({ ...x, quantity: Number(x.quantity) || 0 }));
  } catch {
    return getSeed();
  }
}

/** @param {Item[]} items */
function saveItems(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function getSeed() {
  return [
    { id: uid(), name: "Critical Reagent X", container: "Plate", quantity: 3, min: 2, notes: "96-well plates" },
    { id: uid(), name: "Critical Reagent Y", container: "Kit", quantity: 10, min: 5, notes: "Vendor ABC" },
    { id: uid(), name: "Buffer Z", container: "Bottle", quantity: 2, min: 1 },
  ];
}

// ---------------------- Cloud API (Apps Script) ----------------------
async function apiList() {
  if (!BASE_URL) return [];
  const url = new URL(BASE_URL);
  url.searchParams.set("action", "items");
  if (TOKEN) url.searchParams.set("token", TOKEN);
  const res = await fetch(url.toString()); // simple GET (no preflight)
  if (!res.ok) throw new Error("List failed: " + res.status);
  const data = await res.json();
  return /** @type {Item[]} */ (data.items || []);
}

/** @param {Item} item */
async function apiUpsert(item) {
  if (!BASE_URL) return;
  // Use text/plain to avoid preflight (Apps Script doesn't serve OPTIONS)
  await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "upsert", item, ...(TOKEN ? { token: TOKEN } : {}) }),
  });
}

async function apiDelete(id) {
  if (!BASE_URL) return;
  await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "delete", id, ...(TOKEN ? { token: TOKEN } : {}) }),
  });
}

// ---------------------- Components ----------------------
function Header({ total, cloudNote }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Lab Reagent Inventory</h1>
      <div className="flex items-center gap-4">
        <span className="text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-600 bg-white">
          Cloud: {BASE_URL ? (cloudNote || "Ready") : "Not configured"}
        </span>
        <div className="text-sm opacity-70">
          Total items: <b>{total}</b>
        </div>
      </div>
    </div>
  );
}

function Toolbar({ onAdd, onReset, onImport, onExport, filter, setFilter, query, setQuery, onSync }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6">
      {/* Search */}
      <input
        className="md:col-span-4 px-3 py-2 rounded-2xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 min-w-0"
        placeholder="Search by name or notes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Container filter */}
      <select
        className="md:col-span-3 px-3 py-2 rounded-2xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 min-w-0"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="">All containers</option>
        <option>Plate</option>
        <option>Kit</option>
        <option>Bottle</option>
        <option>Tube</option>
        <option>Box</option>
        <option>Other</option>
      </select>

      {/* Actions */}
      <div className="md:col-span-5 flex flex-wrap gap-2 justify-end items-center">
        <button className="px-3 py-2 rounded-2xl border" onClick={onSync}>Sync</button>
        <button className="px-3 py-2 rounded-2xl bg-lime-500 text-black shadow-indigo-500/50 shadow-md hover:opacity-70" onClick={onAdd}>Add item</button>
        <button className="px-3 py-2 rounded-2xl border border-gray-300 hover:bg-gray-50" onClick={onExport}>Export</button>
        <label className="px-3 py-2 rounded-2xl border border-gray-300 hover:bg-gray-50 cursor-pointer">
          Import
          <input type="file" className="hidden" accept="application/json" onChange={onImport} />
        </label>
        <button className="px-3 py-2 rounded-2xl border border-red-300 text-red-700 hover:bg-red-50" onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}

function StatCards({ items }) {
  const totalQty = items.reduce((a, b) => a + (Number(b.quantity) || 0), 0);
  const low = items.filter((i) => i.min != null && i.quantity <= i.min);
  const containers = Object.entries(
    items.reduce((acc, i) => {
      acc[i.container] = (acc[i.container] || 0) + i.quantity;
      return acc;
    }, /** @type {Record<string, number>} */ ({}))
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card title="Total quantity" value={totalQty} subtitle="All units combined" />
      <Card title="Unique reagents" value={items.length} subtitle="Tracked SKUs" />
      <Card title="Low / at min" value={low.length} subtitle="Needs reorder" warn={low.length > 0} />
      <div className="md:col-span-3 bg-white rounded-2xl p-4 shadow-sm border">
        <div className="font-semibold mb-2">By container</div>
        <div className="flex flex-wrap gap-2">
          {containers.map(([name, qty]) => (
            <span key={name} className="px-3 py-1 rounded-full border bg-gray-50">
              {name}: <b>{qty}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, subtitle, warn = false }) {
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border ${warn ? "border-amber-300" : ""}`}>
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs opacity-60">{subtitle}</div>
    </div>
  );
}

function InventoryGrid({ items, onEdit, onDelete, onAdjust, adjustingId }) {
  if (!items.length) {
    return <div className="p-8 text-center text-gray-500 border rounded-2xl bg-white">No items match your filters.</div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className={`relative bg-white rounded-2xl p-4 shadow-sm border ${item.min != null && item.quantity <= item.min ? "border-amber-300" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold leading-tight">{item.name}</div>
                  <div className="text-xs opacity-60">{item.container}</div>
                </div>
                <div className="text-2xl font-bold tabular-nums">{item.quantity}</div>
              </div>
              {item.notes ? <div className="mt-2 text-sm opacity-80">{item.notes}</div> : null}
              {item.min != null ? <div className="mt-1 text-xs opacity-60">Min: {item.min}</div> : null}
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    className={`px-3 py-1 rounded-xl border flex items-center justify-center min-w-[40px] ${adjustingId === item.id ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => onAdjust(item.id, -1)}
                    disabled={adjustingId === item.id}
                    aria-busy={adjustingId === item.id}
                  >
                    {adjustingId === item.id ? (
                      <span className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></span>
                    ) : (
                      "-1"
                    )}
                  </button>
                  <button
                    className={`px-3 py-1 rounded-xl border flex items-center justify-center min-w-[40px] ${adjustingId === item.id ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => onAdjust(item.id, +1)}
                    disabled={adjustingId === item.id}
                    aria-busy={adjustingId === item.id}
                  >
                    {adjustingId === item.id ? (
                      <span className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></span>
                    ) : (
                      "+1"
                    )}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 rounded-xl border" onClick={() => onEdit(item)}>
                    Edit
                  </button>
                  <button className="px-3 py-1 rounded-xl border border-red-300 text-red-600" onClick={() => onDelete(item.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function AddEditModal({ open, initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [container, setContainer] = useState(initial?.container || "Plate");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 0));
  const [min, setMin] = useState(String(initial?.min ?? ""));
  const [notes, setNotes] = useState(initial?.notes || "");

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setContainer(initial?.container || "Plate");
      setQuantity(String(initial?.quantity ?? 0));
      setMin(String(initial?.min ?? ""));
      setNotes(initial?.notes || "");
    }
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-2xl shadow-xl border">
          <div className="p-4 border-b font-semibold">{initial ? "Edit item" : "Add item"}</div>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-sm block mb-1">Name</label>
              <input className="w-full px-3 py-2 rounded-xl border" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Critical Reagent X" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm block mb-1">Container</label>
                <select className="w-full px-3 py-2 rounded-xl border" value={container} onChange={(e) => setContainer(e.target.value)}>
                  {"Plate,Kit,Bottle,Tube,Box,Other".split(",").map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm block mb-1">Quantity</label>
                <input type="number" min={0} className="w-full px-3 py-2 rounded-xl border" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div>
                <label className="text-sm block mb-1">Min (optional)</label>
                <input type="number" min={0} className="w-full px-3 py-2 rounded-xl border" value={min} onChange={(e) => setMin(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm block mb-1">Notes (optional)</label>
              <textarea className="w-full px-3 py-2 rounded-xl border" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Vendor, lot, storage, etc." />
            </div>
          </div>
          <div className="p-4 border-t flex justify-end gap-2">
            <button className="px-3 py-2 rounded-xl border" onClick={onClose}>
              Cancel
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-black text-white"
              onClick={async () => {
                if (!name.trim()) return alert("Name is required");
                const payload = {
                  id: initial?.id || uid(),
                  name: name.trim(),
                  container: container || "Other",
                  quantity: Math.max(0, Number(quantity) || 0),
                  min: min === "" ? undefined : Math.max(0, Number(min) || 0),
                  notes: notes.trim() || undefined,
                };
                await onSave(payload);
              }}
            >
              {initial ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------- Chart ----------------------
function InventoryBarChart({ items }) {
  const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#22c55e"];
  const [view, setView] = React.useState("items"); // 'items' | 'containers'

  const data = React.useMemo(() => {
    if (view === "containers") {
      // aggregate totals per container; min is sum of mins in that container
      const grouped = {};
      for (const i of items) {
        const c = i.container || "Other";
        if (!grouped[c]) grouped[c] = { name: c, quantity: 0, min: 0 };
        grouped[c].quantity += Number(i.quantity) || 0;
        if (i.min != null) grouped[c].min += Math.max(0, Number(i.min) || 0);
      }
      return Object.values(grouped);
    }
    // items view
    return items.map((i) => ({ name: i.name, quantity: Number(i.quantity) || 0, min: i.min == null ? 0 : Math.max(0, Number(i.min) || 0) }));
  }, [items, view]);

  if (!data.length) return <div className="p-8 text-center text-gray-500 border rounded-2xl bg-white">No data to chart.</div>;

  const MinTick = (props) => { const { cx, cy } = props; const w = 16; return (<g><line x1={cx - w/2} x2={cx + w/2} y1={cy} y2={cy} stroke="#0f172a" strokeWidth={2} /></g>); };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Inventory Chart {view === 'items' ? '(by item)' : '(by container)'}</div>
        <div className="text-xs bg-gray-100 rounded-xl p-1">
          <button onClick={() => setView('items')} className={`px-2 py-1 rounded-lg ${view === 'items' ? 'bg-white shadow border' : 'opacity-70'}`}>Items</button>
          <button onClick={() => setView('containers')} className={`px-2 py-1 rounded-lg ${view === 'containers' ? 'bg-white shadow border' : 'opacity-70'}`}>Containers</button>
        </div>
      </div>
      <div className="h-[520px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }}>
              <Label value="Item count" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fontSize: 24, fill:"black"}} />
            </YAxis>
            <Tooltip />
            <Legend />
            <Bar dataKey="quantity" name="Quantity" legendType="line" fill="#000000ff">
              {data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              <LabelList dataKey="quantity" position="top" />
            </Bar>
            {/* per-category horizontal min tick */}
            <Scatter dataKey="min" name="Min target" shape={<MinTick />} legendType="line" fill="#000000ff" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------- Root ----------------------
export default function App() {
  const [items, setItems] = useState(() => loadItems());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(/** @type {Item | null} */ (null));
  const [cloudNote, setCloudNote] = useState("");
  const [adjustingId, setAdjustingId] = useState(/** @type {string | null} */(null));

  useEffect(() => {
    saveItems(items);
  }, [items]);

  // Initial pull from cloud (if configured)
  useEffect(() => {
    (async () => {
      try {
        if (!BASE_URL) return;
        const fromCloud = await apiList();
        if (Array.isArray(fromCloud) && fromCloud.length) setItems(fromCloud);
        setCloudNote("Synced");
      } catch (e) {
        console.warn("Cloud sync failed, using local", e);
        setCloudNote("Error");
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items
      .filter(
        (i) => (!filter || i.container === filter) && (!q || i.name.toLowerCase().includes(q) || (i.notes || "").toLowerCase().includes(q))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, filter, query]);

  const handleAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const handleEdit = (item) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this item?")) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      await apiDelete(id);
      setCloudNote("Saved");
    } catch (e) {
      console.warn(e);
      setCloudNote("Error");
    }
  };

  const handleSave = async (payload) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === payload.id);
      if (idx === -1) return [payload, ...prev];
      const copy = [...prev];
      copy[idx] = payload;
      return copy;
    });
    try {
      await apiUpsert(payload);
      setCloudNote("Saved");
    } catch (e) {
      console.warn(e);
      setCloudNote("Error");
    }
    setModalOpen(false);
  };

  const handleAdjust = async (id, delta) => {
    if (adjustingId === id) return; // prevent double click while saving
    const current = items.find((x) => x.id === id);
    if (!current) return;
    const newItem = {
      ...current,
      quantity: Math.max(0, (Number(current.quantity) || 0) + delta),
    };
    // Optimistic UI update
    setItems((prev) => prev.map((x) => (x.id === id ? newItem : x)));
    setAdjustingId(id);
    // Persist to Sheets
    try {
      await apiUpsert(newItem);
      setCloudNote("Saved");
    } catch (e) {
      console.warn(e);
      setCloudNote("Error");
    } finally {
      setAdjustingId(null);
    }
  };

  const handleSync = async () => {
    try {
      const cloud = await apiList();
      setItems(cloud);
      setCloudNote("Synced");
    } catch (e) {
      alert("Sync failed");
      setCloudNote("Error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Header total={items.length} cloudNote={cloudNote} />
        <StatCards items={items} />
        <Toolbar
          onAdd={handleAdd}
          onReset={() => {
            if (!confirm("Reset to sample data? This will overwrite current items.")) return;
            const seed = getSeed();
            setItems(seed);
          }}
          onImport={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
              try {
                const parsed = JSON.parse(String(reader.result));
                if (!Array.isArray(parsed)) throw new Error("Invalid file");
                const normalized = parsed.map((x) => ({
                  id: x.id || uid(),
                  name: String(x.name || "Unnamed"),
                  container: String(x.container || "Other"),
                  quantity: Math.max(0, Number(x.quantity) || 0),
                  min: x.min == null ? undefined : Math.max(0, Number(x.min) || 0),
                  notes: x.notes ? String(x.notes) : undefined,
                }));
                setItems(normalized);
                for (const it of normalized) {
                  try {
                    await apiUpsert(it);
                  } catch {}
                }
                setCloudNote("Saved");
              } catch (err) {
                alert(`Import failed: ${err.message || err}`);
                setCloudNote("Error");
              }
            };
            reader.readAsText(file);
            e.target.value = "";
          }}
          onExport={() => {
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `lab-inventory-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }}
          filter={filter}
          setFilter={setFilter}
          query={query}
          setQuery={setQuery}
          onSync={handleSync}
        />
        <InventoryGrid items={filtered} onEdit={handleEdit} onDelete={handleDelete} onAdjust={handleAdjust} adjustingId={adjustingId} />

        {/* Full-width chart at bottom */}
        <div className="mt-6">
          <InventoryBarChart items={filtered} />
        </div>
      </div>

      <AddEditModal open={modalOpen} initial={editing || undefined} onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  );
}
