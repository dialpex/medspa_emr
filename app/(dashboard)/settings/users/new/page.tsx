import { UserForm } from "../user-form";
import { PageCard } from "@/components/ui/page-card";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

export default function NewUserPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Breadcrumbs items={buildBreadcrumbItems(
        { label: "System Config", href: "/settings" },
        { label: "Users", href: "/settings/users" },
        { label: "New User" }
      )} />
      <PageCard title="Add User">
        <UserForm />
      </PageCard>
    </div>
  );
}
