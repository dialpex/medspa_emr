"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  SearchIcon,
  EyeIcon,
  DownloadIcon,
  FileTextIcon,
  ClipboardListIcon,
  Loader2Icon,
} from "lucide-react";
import { GALLERY_TEMPLATES, type GalleryTemplate } from "@/lib/data/template-gallery";
import { createTemplate } from "@/lib/actions/chart-templates";
import { TemplatePreviewModal } from "@/components/template-preview-modal";

type CategoryTab = "all" | string;

export function TemplateGallery() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryTab>("all");
  const [previewTemplate, setPreviewTemplate] = useState<GalleryTemplate | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    GALLERY_TEMPLATES.forEach((t) => cats.add(t.category));
    return Array.from(cats).sort();
  }, []);

  const filtered = useMemo(() => {
    let list = GALLERY_TEMPLATES;

    if (category !== "all") {
      list = list.filter((t) => t.category === category);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }

    return list;
  }, [category, search]);

  const handleInstall = async (template: GalleryTemplate) => {
    setInstalling(template.id);
    try {
      const result = await createTemplate({
        type: template.type,
        name: template.name,
        description: template.description,
        category: template.category,
        fieldsConfig: template.fieldsConfig,
      });
      if (result.success) {
        router.push("/settings/templates");
      }
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200">
        <button
          onClick={() => setCategory("all")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            category === "all"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          All
          <span className="ml-1 text-xs text-gray-400">({GALLERY_TEMPLATES.length})</span>
        </button>
        {categories.map((cat) => {
          const count = GALLERY_TEMPLATES.filter((t) => t.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                category === cat
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {cat}
              <span className="ml-1 text-xs text-gray-400">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          No templates match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => {
            const Icon = template.type === "form" ? ClipboardListIcon : FileTextIcon;
            return (
              <div
                key={template.id}
                className="rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600 shrink-0">
                    <Icon className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">{template.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                      template.type === "form"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-purple-50 text-purple-700"
                    }`}
                  >
                    {template.type === "form" ? "Form" : "Chart"}
                  </span>
                  <span className="text-xs text-gray-400">{template.category}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {template.fieldsConfig.length} fields
                  </span>
                </div>

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => setPreviewTemplate(template)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <EyeIcon className="size-3.5" />
                    Preview
                  </button>
                  <button
                    onClick={() => handleInstall(template)}
                    disabled={installing === template.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {installing === template.id ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <DownloadIcon className="size-3.5" />
                    )}
                    Install
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          name={previewTemplate.name}
          fields={previewTemplate.fieldsConfig}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
}
