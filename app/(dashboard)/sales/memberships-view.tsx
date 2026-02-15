"use client";

import { useState, useTransition } from "react";
import { Plus, CreditCard, TrendingUp, Users, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageCard } from "@/components/ui/page-card";
import {
  createMembershipPlan,
  updateMembershipPlan,
  toggleMembershipPlanActive,
  assignMembershipToPatient,
  type MembershipPlanItem,
  type MembershipDataItem,
  type PatientMembershipItem,
} from "@/lib/actions/memberships";
import { searchPatients } from "@/lib/actions/invoices";
import { PatientAvatar } from "@/components/patient-avatar";

type Props = {
  plans: MembershipPlanItem[];
  membershipData: MembershipDataItem[];
  patientMemberships: PatientMembershipItem[];
};

export function MembershipsView({ plans: initialPlans, membershipData, patientMemberships }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [isPending, startTransition] = useTransition();
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlanItem | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Plan form state
  const [planName, setPlanName] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [planPrice, setPlanPrice] = useState(0);

  // Assign form state
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assignPatientId, setAssignPatientId] = useState("");
  const [assignTermMonths, setAssignTermMonths] = useState("12");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<{ id: string; firstName: string; lastName: string }[]>([]);

  // Aggregate stats
  const totalMRR = membershipData.reduce((s, d) => s + d.mrr, 0);
  const totalActive = membershipData.reduce((s, d) => s + d.activeMembers, 0);
  const totalAll = membershipData.reduce((s, d) => s + d.totalMembers, 0);

  function openPlanForm(plan?: MembershipPlanItem) {
    if (plan) {
      setEditingPlan(plan);
      setPlanName(plan.name);
      setPlanDesc(plan.description ?? "");
      setPlanPrice(plan.price);
    } else {
      setEditingPlan(null);
      setPlanName("");
      setPlanDesc("");
      setPlanPrice(0);
    }
    setShowPlanForm(true);
  }

  function handleSavePlan() {
    if (!planName.trim() || planPrice <= 0) { setError("Name and price are required"); return; }
    setError(null);
    startTransition(async () => {
      const input = { name: planName, description: planDesc || undefined, price: planPrice };
      const result = editingPlan
        ? await updateMembershipPlan(editingPlan.id, input)
        : await createMembershipPlan(input);
      if (!result.success) { setError(result.error); return; }
      setShowPlanForm(false);
      window.location.reload();
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleMembershipPlanActive(id);
      window.location.reload();
    });
  }

  async function handlePatientSearch(q: string) {
    setPatientSearch(q);
    if (q.length < 2) { setPatientResults([]); return; }
    const results = await searchPatients(q);
    setPatientResults(results);
  }

  function handleAssign() {
    if (!assignPlanId || !assignPatientId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignMembershipToPatient({ patientId: assignPatientId, planId: assignPlanId, termMonths: parseInt(assignTermMonths, 10) });
      if (!result.success) { setError(result.error); return; }
      setShowAssign(false);
      window.location.reload();
    });
  }

  return (
    <PageCard
      title="Memberships"
      headerAction={
        <div className="flex gap-2">
          <button onClick={() => setShowAssign(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Plus className="size-4" /> Assign to Patient
          </button>
          <button onClick={() => openPlanForm()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">
            <Plus className="size-4" /> New Plan
          </button>
        </div>
      }
    >
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">{error}</div>}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <DollarSign className="size-4" /> Monthly Recurring Revenue
          </div>
          <div className="text-2xl font-bold text-gray-900">${totalMRR.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Users className="size-4" /> Active Members
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalActive}</div>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <TrendingUp className="size-4" /> Total Enrolled
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalAll}</div>
        </div>
      </div>

      {/* Membership Plans */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Plans</h3>

        {showPlanForm && (
          <div className="bg-white border rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input value={planName} onChange={(e) => setPlanName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Price ($/mo)</label>
                <input type="number" min={0} step={0.01} value={planPrice} onChange={(e) => setPlanPrice(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <input value={planDesc} onChange={(e) => setPlanDesc(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500" placeholder="Benefits, included services, etc." />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSavePlan} disabled={isPending} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                {isPending ? "Saving..." : editingPlan ? "Update" : "Create"}
              </button>
              <button onClick={() => setShowPlanForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}

        {showAssign && (
          <div className="bg-white border rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Plan</label>
                <select value={assignPlanId} onChange={(e) => setAssignPlanId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select plan...</option>
                  {plans.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (${p.price.toFixed(2)}/mo)</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 mb-1">Patient</label>
                <input
                  value={patientSearch}
                  onChange={(e) => handlePatientSearch(e.target.value)}
                  placeholder="Search patient..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                {patientResults.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {patientResults.map((p) => (
                      <li key={p.id}>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => { setAssignPatientId(p.id); setPatientSearch(`${p.firstName} ${p.lastName}`); setPatientResults([]); }}
                        >
                          {p.firstName} {p.lastName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Term (months)</label>
                <select value={assignTermMonths} onChange={(e) => setAssignTermMonths(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? "month" : "months"}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAssign} disabled={isPending || !assignPlanId || !assignPatientId} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                {isPending ? "Assigning..." : "Assign"}
              </button>
              <button onClick={() => setShowAssign(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          {membershipData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CreditCard className="size-8 mx-auto mb-2 text-gray-300" />
              No membership plans yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Membership</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Price/mo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Active Patients</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Paused</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">MRR</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Churn %</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {membershipData.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{d.name}</div>
                      {d.description && <div className="text-xs text-gray-500">{d.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">${d.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">{d.activeMembers}</td>
                    <td className="px-4 py-3 text-right text-yellow-600">{d.pausedMembers}</td>
                    <td className="px-4 py-3 text-right font-semibold">${d.mrr.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("text-sm", d.churnRate > 30 ? "text-red-600 font-medium" : d.churnRate > 15 ? "text-yellow-600" : "text-green-600")}>
                        {d.churnRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", d.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {d.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => {
                        const plan = plans.find((p) => p.id === d.id);
                        if (plan) openPlanForm(plan);
                      }} className="text-xs text-purple-600 hover:underline">Edit</button>
                      <button onClick={() => handleToggle(d.id)} className="text-xs text-gray-500 hover:underline">{d.isActive ? "Deactivate" : "Activate"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Member History Table */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Member History</h3>
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          {patientMemberships.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="size-8 mx-auto mb-2 text-gray-300" />
              No member history yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Patient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Start Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Remaining</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Price/mo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {patientMemberships.map((m) => {
                  const toDate = (v: string | number | Date) => v instanceof Date ? v : new Date(typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v);
                  const now = new Date();
                  const endRef = m.status === "Cancelled" && m.cancelledAt ? toDate(m.cancelledAt) : now;
                  const start = toDate(m.startDate);
                  const elapsed = (endRef.getFullYear() - start.getFullYear()) * 12 + (endRef.getMonth() - start.getMonth());
                  const left = Math.max(0, m.termMonths - elapsed);
                  const remaining = `${left} mo`;
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PatientAvatar firstName={m.patient.firstName} lastName={m.patient.lastName} size="sm" />
                          <span className="font-medium text-gray-900">{m.patient.firstName} {m.patient.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{m.plan.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          m.status === "Active" ? "bg-green-100 text-green-700" :
                          m.status === "Paused" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-500"
                        )}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{start.toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{remaining}</td>
                      <td className="px-4 py-3 text-right font-medium">${m.plan.price.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageCard>
  );
}
