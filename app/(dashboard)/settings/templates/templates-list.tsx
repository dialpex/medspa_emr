"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  SearchIcon,
  FilterIcon,
  PencilIcon,
  SparklesIcon,
  LayoutGridIcon,
  ShareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  FileTextIcon,
  ClipboardListIcon,
} from "lucide-react";
import { bulkArchiveTemplates, bulkDeleteTemplates } from "@/lib/actions/chart-templates";
import type { TemplateStatus } from "@/lib/types/charts";
import { AiCopilotPanel } from "@/components/ai-copilot-panel";
import { useRouter } from "next/navigation";

interface TemplateData {
  id: string;
  type: string;
  name: string;
  description: string | null;
  category: string | null;
  fieldsConfig: string;
  status: string;
  isSystem: boolean;
}

interface TemplatesListProps {
  templates: TemplateData[];
  canManage: boolean;
}

const ITEMS_PER_PAGE = 6;

const STATUS_STYLES: Record<string, string> = {
  Active: "bg-green-50 text-green-700",
  Draft: "bg-amber-50 text-amber-700",
  Archived: "bg-gray-100 text-gray-500",
};

type TypeTab = "all" | "chart" | "form";

export function TemplatesList({ templates, canManage }: TemplatesListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeTab, setTypeTab] = useState<TypeTab>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);


  // Derive categories and counts
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    templates.forEach((t) => { if (t.category) cats.add(t.category); });
    return Array.from(cats).sort();
  }, [templates]);

  const allStatuses: TemplateStatus[] = ["Active", "Draft", "Archived"];

  // Filter logic
  const filtered = useMemo(() => {
    let list = templates;

    if (typeTab !== "all") {
      list = list.filter((t) => t.type === typeTab);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }

    if (selectedCategories.size > 0) {
      list = list.filter((t) => t.category && selectedCategories.has(t.category));
    }

    if (selectedStatuses.size > 0) {
      list = list.filter((t) => selectedStatuses.has(t.status));
    }

    return list;
  }, [templates, typeTab, search, selectedCategories, selectedStatuses]);

  // Counts per type tab
  const chartCount = templates.filter((t) => t.type === "chart").length;
  const formCount = templates.filter((t) => t.type === "form").length;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const startItem = filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(safePage * ITEMS_PER_PAGE, filtered.length);

  // Checkbox handlers
  const allPageSelected = paged.length > 0 && paged.every((t) => selectedIds.has(t.id));
  const toggleAll = () => {
    if (allPageSelected) {
      const next = new Set(selectedIds);
      paged.forEach((t) => next.delete(t.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      paged.forEach((t) => next.add(t.id));
      setSelectedIds(next);
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Bulk actions
  const handleBulkArchive = async () => {
    setBulkLoading(true);
    await bulkArchiveTemplates(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkLoading(false);
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    await bulkDeleteTemplates(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
    setBulkLoading(false);
  };

  const toggleCategory = (cat: string) => {
    const next = new Set(selectedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setSelectedCategories(next);
    setPage(1);
  };

  const toggleStatus = (s: string) => {
    const next = new Set(selectedStatuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSelectedStatuses(next);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Search + Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search templates by name or category..."
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              selectedCategories.size > 0 || selectedStatuses.size > 0
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <FilterIcon className="size-4" />
            Filter
            {(selectedCategories.size > 0 || selectedStatuses.size > 0) && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-600 text-white rounded-full">
                {selectedCategories.size + selectedStatuses.size}
              </span>
            )}
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg border border-gray-200 shadow-lg z-20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Filters</span>
                  <button
                    onClick={() => { setSelectedCategories(new Set()); setSelectedStatuses(new Set()); }}
                    className="text-xs text-purple-600 hover:text-purple-700"
                  >
                    Clear all
                  </button>
                </div>
                {allCategories.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Category</p>
                    <div className="space-y-1">
                      {allCategories.map((cat) => (
                        <label key={cat} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCategories.has(cat)}
                            onChange={() => toggleCategory(cat)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          {cat}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Status</p>
                  <div className="space-y-1">
                    {allStatuses.map((s) => (
                      <label key={s} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedStatuses.has(s)}
                          onChange={() => toggleStatus(s)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <span className="text-sm text-gray-500 shrink-0">{filtered.length} total items</span>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: "all" as TypeTab, label: "All", count: templates.length },
          { key: "chart" as TypeTab, label: "Charts", count: chartCount },
          { key: "form" as TypeTab, label: "Forms", count: formCount },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setTypeTab(tab.key); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              typeTab === tab.key
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-gray-400">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {search || selectedCategories.size > 0 || selectedStatuses.size > 0
              ? "No templates match your filters."
              : "No templates yet. Create one to get started."}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {canManage && (
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Template Name & Details
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Structure</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.map((t) => {
                let fieldCount = 0;
                try { fieldCount = JSON.parse(t.fieldsConfig).length; } catch {}
                const Icon = t.type === "form" ? ClipboardListIcon : FileTextIcon;
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    {canManage && (
                      <td className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleOne(t.id)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 shrink-0 mt-0.5">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{t.name}</div>
                          {t.description && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">{t.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          t.type === "form"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {t.type === "form" ? "Form" : "Chart"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.category ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        {fieldCount} fields
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                          STATUS_STYLES[t.status] ?? STATUS_STYLES.Active
                        }`}
                      >
                        {t.status === "Archived" && (
                          <span className="size-1.5 rounded-full bg-gray-400" />
                        )}
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canManage && (
                        <Link
                          href={`/settings/templates/${t.id}`}
                          className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-purple-600 rounded-md hover:bg-purple-50"
                        >
                          <PencilIcon className="size-4" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Showing {startItem}-{endItem} of {filtered.length} templates
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
              if (totalPages > 5 && n > 2 && n < totalPages - 1 && Math.abs(n - safePage) > 1) {
                if (n === 3 || n === totalPages - 2) {
                  return <span key={n} className="px-1 text-gray-400">...</span>;
                }
                return null;
              }
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`min-w-[28px] h-7 rounded-md text-sm font-medium ${
                    n === safePage
                      ? "bg-purple-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {n}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && canManage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white rounded-xl px-5 py-3 shadow-2xl">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-gray-600" />
          <button
            onClick={handleBulkArchive}
            disabled={bulkLoading}
            className="text-sm font-medium text-amber-300 hover:text-amber-200 disabled:opacity-50"
          >
            Archive
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={bulkLoading}
            className="text-sm font-medium text-red-300 hover:text-red-200 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1 text-gray-400 hover:text-white"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Templates</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete {selectedIds.size} template{selectedIds.size !== 1 ? "s" : ""}? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {bulkLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        {/* AI Auto-Generator */}
        <div className="rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 mb-3">
            <SparklesIcon className="size-5" />
          </div>
          <h4 className="font-semibold text-gray-900 mb-1">AI Auto-Generator</h4>
          <p className="text-sm text-gray-500 mb-3">
            Describe your workflow and let AI create a complete template for you.
          </p>
          <button
            onClick={() => setCopilotOpen(true)}
            className="text-sm font-medium text-purple-600 hover:text-purple-700"
          >
            Try AI Assist &gt;
          </button>
        </div>

        {/* Template Gallery */}
        <div className="rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-3">
            <LayoutGridIcon className="size-5" />
          </div>
          <h4 className="font-semibold text-gray-900 mb-1">Template Gallery</h4>
          <p className="text-sm text-gray-500 mb-3">
            Browse pre-built templates for common medspa procedures.
          </p>
          <Link
            href="/settings/templates/gallery"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View Gallery &gt;
          </Link>
        </div>

        {/* Patient Portals */}
        <div className="rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 mb-3">
            <ShareIcon className="size-5" />
          </div>
          <h4 className="font-semibold text-gray-900 mb-1">Patient Portals</h4>
          <p className="text-sm text-gray-500 mb-3">
            Share forms with patients for digital intake and consent.
          </p>
          <button
            onClick={() => {
              const el = document.getElementById("coming-soon-toast");
              if (el) { el.classList.remove("hidden"); setTimeout(() => el.classList.add("hidden"), 3000); }
            }}
            className="text-sm font-medium text-gray-500 hover:text-gray-600"
          >
            Setup Sharing &gt;
          </button>
        </div>
      </div>

      {/* Coming soon toast */}
      <div
        id="coming-soon-toast"
        className="hidden fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm"
      >
        Coming Soon — Patient Portals are under development.
      </div>

      {/* AI Copilot panel */}
      <AiCopilotPanel
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onApplyResult={(data) => {
          const encoded = Buffer.from(
            JSON.stringify({
              fields: data.fields,
              name: data.name,
              type: data.type,
              category: data.category,
            })
          ).toString("base64");
          router.push(`/settings/templates/new?ai=${encoded}`);
        }}
      />
    </div>
  );
}
