import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getInvoices, getClinicInfo } from "@/lib/actions/invoices";
import { prisma } from "@/lib/prisma";
import { getPayments } from "@/lib/actions/payments";
import { getMembershipPlans, getMembershipData, getPatientMemberships } from "@/lib/actions/memberships";
import { getServicesForClinic } from "@/lib/actions/services";
import { getProductsForClinic } from "@/lib/actions/products";
import { getGiftCardsList, getGiftCardDenominationsAction, getGiftCardStats } from "@/lib/actions/gift-cards";
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
    const clinicId = (session.user as { clinicId: string }).clinicId;
    const [invoices, services, products, clinicInfo, clinic] = await Promise.all([
      getInvoices(),
      getServicesForClinic(),
      getProductsForClinic(),
      getClinicInfo(),
      prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { stripeAccountId: true, stripeChargesEnabled: true },
      }),
    ]);
    const serviceOptions = services.map((s) => ({ id: s.id, name: s.name, price: s.price }));
    const productOptions = products.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name, price: p.retailPrice }));
    const stripeConnected = !!(clinic?.stripeAccountId && clinic?.stripeChargesEnabled);
    const stripeAccountId = clinic?.stripeAccountId ?? null;
    content = <InvoiceListView initialInvoices={invoices} services={serviceOptions} products={productOptions} clinicInfo={clinicInfo} stripeConnected={stripeConnected} stripeAccountId={stripeAccountId} />;
  } else if (section === "payments") {
    const payments = await getPayments();
    content = <PaymentsView payments={payments} />;
  } else if (section === "memberships") {
    const [plans, data, patientMemberships] = await Promise.all([
      getMembershipPlans(),
      getMembershipData(),
      getPatientMemberships(),
    ]);
    content = <MembershipsView plans={plans} membershipData={data} patientMemberships={patientMemberships} />;
  } else if (section === "gift-cards") {
    const [giftCards, denominations, stats] = await Promise.all([
      getGiftCardsList(),
      getGiftCardDenominationsAction(),
      getGiftCardStats(),
    ]);
    const denomOpts = denominations.map((d) => ({ id: d.id, amount: d.amount }));
    content = <GiftCardsView giftCards={giftCards} denominations={denomOpts} stats={stats} />;
  }

  return (
    <div className="flex h-screen">
      <SalesSidebar />
      <div className="flex-1 overflow-y-auto p-6">
        {content}
      </div>
    </div>
  );
}
