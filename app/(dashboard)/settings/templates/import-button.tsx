"use client";

import { useState } from "react";
import { UploadIcon } from "lucide-react";
import { ImportModal } from "./import-modal";

export function ImportButton() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setImportOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
      >
        <UploadIcon className="size-4" />
        Import Template
      </button>
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
