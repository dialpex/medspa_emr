import { notFound } from "next/navigation";
import { getUser } from "@/lib/actions/users";
import { UserForm } from "../user-form";

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
      <h1 className="text-2xl font-bold mb-6">Edit User</h1>
      <UserForm user={user} />
    </div>
  );
}
