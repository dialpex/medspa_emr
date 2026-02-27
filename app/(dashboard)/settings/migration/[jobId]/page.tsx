import { getMigrationStatus } from "@/lib/actions/migration";
import { notFound } from "next/navigation";
import { MigrationWizard } from "./migration-wizard";

interface Props {
  params: Promise<{ jobId: string }>;
}

export default async function MigrationJobPage({ params }: Props) {
  const { jobId } = await params;
  const job = await getMigrationStatus(jobId);

  if (!job) {
    notFound();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <MigrationWizard job={job} />
    </div>
  );
}
