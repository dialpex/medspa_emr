"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

export function PatientSearch({ initialSearch }: { initialSearch?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(initialSearch ?? "");

  const handleSearch = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (term) {
        params.set("q", term);
      } else {
        params.delete("q");
      }
      startTransition(() => {
        router.push(`/patients?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  return (
    <div className="mb-6">
      <div className="relative">
        <input
          type="text"
          placeholder="Search patients by name, email, or phone..."
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleSearch(e.target.value);
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {isPending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
