import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getInvoices, getClinicInfo } from "@/lib/actions/invoices";
import { getPayments } from "@/lib/actions/payments";
import { getMembershipPlans, getMembershipData } from "@/lib/actions/memberships";
import { getServicesForClinic } from "@/lib/actions/services";
import { SalesSidebar } from "./sales-sidebar";
import { InvoiceListView } from "./invoice-list-view";
import { PaymentsView } from "./payments-view";
import { MembershipsView } from "./memberships-view";
import { GiftCardsView } from "./gift-cards-view";

const ALLOWED_ROLES = ["Owner", "Admin", "Billing"];

type Props = {
  searchParams: Promise<{ section?: string }>;
};

export default async function SalesPage({ searchParams }: Props) {
  const session = await auth();

  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    redirect("/calendar");
  }

  const params = await searchParams;
  const section = params.section || "invoices";

  let content: React.ReactNode = null;

  if (section === "invoices") {
    const [invoices, services, clinicInfo] = await Promise.all([
      getInvoices(),
      getServicesForClinic(),
      getClinicInfo(),
    ]);
    const serviceOptions = services.map((s) => ({ id: s.id, name: s.name, price: s.price }));
    content = <InvoiceListView initialInvoices={invoices} services={serviceOptions} clinicInfo={clinicInfo} />;
  } else if (section === "payments") {
    const payments = await getPayments();
    content = <PaymentsView payments={payments} />;
  } else if (section === "memberships") {
    const [plans, data] = await Promise.all([
      getMembershipPlans(),
      getMembershipData(),
    ]);
    content = <MembershipsView plans={plans} membershipData={data} />;
  } else if (section === "gift-cards") {
    content = <GiftCardsView />;
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <SalesSidebar />
      <div className="flex-1 overflow-y-auto p-6">
        {content}
      </div>
    </div>
  );
}
