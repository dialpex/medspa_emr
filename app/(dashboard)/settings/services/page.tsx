import Link from "next/link";
import { getServicesForClinic, toggleServiceActive } from "@/lib/actions/services";
import { ToggleActiveButton } from "./toggle-active-button";

export default async function ServicesPage() {
  const services = await getServicesForClinic();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your clinic&apos;s treatments and service catalog
          </p>
        </div>
        <Link
          href="/settings/services/new"
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
        >
          Add Service
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No services yet. Add your first service to get started.
                </td>
              </tr>
            )}
            {services.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/settings/services/${s.id}`}
                    className="font-medium text-gray-900 hover:text-purple-600"
                  >
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.category || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{s.duration} min</td>
                <td className="px-4 py-3 text-gray-600">${s.price.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <ToggleActiveButton serviceId={s.id} isActive={s.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
