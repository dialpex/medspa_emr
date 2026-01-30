import { UserForm } from "../user-form";

export default function NewUserPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add User</h1>
      <UserForm />
    </div>
  );
}
