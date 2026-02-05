import { UserForm } from "../user-form";
import { PageCard } from "@/components/ui/page-card";

export default function NewUserPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageCard label="Configuration" title="Add User">
        <UserForm />
      </PageCard>
    </div>
  );
}
