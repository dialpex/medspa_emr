import { notFound } from "next/navigation";
import { getUser } from "@/lib/actions/users";
import { UserForm } from "../user-form";
import { PageCard } from "@/components/ui/page-card";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageCard title="Edit User">
        <UserForm user={user} />
      </PageCard>
    </div>
  );
}
