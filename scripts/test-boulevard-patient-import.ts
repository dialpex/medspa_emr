/**
 * Boulevard Single Patient Import Test
 *
 * Run: npx tsx scripts/test-boulevard-patient-import.ts
 *
 * 1. Prompts for Boulevard credentials (not stored)
 * 2. Fetches client list from Boulevard using actual internal API schema
 * 3. You pick the dummy patient
 * 4. Fetches full client details
 * 5. Imports that single patient into your local Neuvvia dev DB
 */

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BOULEVARD_BASE = "https://dashboard.boulevard.io";
const BOULEVARD_SESSION_URL = `${BOULEVARD_BASE}/auth/sessions`;
const BOULEVARD_IDENTITY_URL = `${BOULEVARD_BASE}/auth/identities`;
const BOULEVARD_GRAPH_URL = `${BOULEVARD_BASE}/api/v1.0/graph`;

function extractCookies(res: Response, existingCookies: string): string {
  const cookieMap = new Map<string, string>();
  if (existingCookies) {
    for (const pair of existingCookies.split("; ")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx > 0) cookieMap.set(pair.substring(0, eqIdx), pair.substring(eqIdx + 1));
    }
  }
  const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
  for (const header of setCookieHeaders) {
    const nameValue = header.split(";")[0].trim();
    const eqIdx = nameValue.indexOf("=");
    if (eqIdx > 0) cookieMap.set(nameValue.substring(0, eqIdx), nameValue.substring(eqIdx + 1));
  }
  return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (hidden) {
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.isTTY) stdin.setRawMode(true);
      let input = "";
      const onData = (char: Buffer) => {
        const c = char.toString();
        if (c === "\n" || c === "\r") {
          if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (c === "\u0003") { process.exit(0); }
        else if (c === "\u007F" || c === "\b") { input = input.slice(0, -1); }
        else { input += c; }
      };
      stdin.on("data", onData);
    } else {
      rl.question(question, (answer) => { rl.close(); resolve(answer); });
    }
  });
}

async function authenticate(email: string, password: string) {
  console.log("\n--- Authenticating with Boulevard ---");

  const sessionRes = await fetch(BOULEVARD_SESSION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: BOULEVARD_BASE,
      Referer: `${BOULEVARD_BASE}/login-v2/`,
    },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });

  if (sessionRes.status !== 204 && sessionRes.status !== 200) {
    throw new Error(`Login failed (${sessionRes.status})`);
  }

  let cookies = extractCookies(sessionRes, "");

  const identityRes = await fetch(BOULEVARD_IDENTITY_URL, {
    method: "GET",
    headers: { Accept: "application/json", Cookie: cookies },
    redirect: "manual",
  });

  if (identityRes.status === 401) throw new Error("Session invalid");
  cookies = extractCookies(identityRes, cookies);

  console.log("Authenticated OK\n");
  return cookies;
}

async function graphQuery(cookies: string, query: string, variables?: Record<string, unknown>, operationName?: string) {
  const body: Record<string, unknown> = { query, variables };
  if (operationName) body.operationName = operationName;

  const res = await fetch(BOULEVARD_GRAPH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json, text/plain, */*",
      Cookie: cookies,
      Origin: BOULEVARD_BASE,
      Referer: `${BOULEVARD_BASE}/home`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GraphQL error (${res.status}): ${text}`);
  }

  const result = await res.json();
  if (result.errors?.length) {
    console.error("GraphQL errors:", JSON.stringify(result.errors, null, 2));
  }
  return result;
}

async function main() {
  console.log("=== Boulevard Single Patient Import Test ===\n");

  const email = await prompt("Boulevard email: ");
  const password = await prompt("Boulevard password: ", true);

  const cookies = await authenticate(email, password);

  // Fetch location ID (needed for files query)
  const bizResult = await graphQuery(
    cookies,
    `query { business { id name locations { edges { node { id name } } } } }`,
    undefined,
    "GetBusiness"
  );
  const business = bizResult.data?.business as Record<string, unknown> | null;
  const locations = business?.locations as { edges: Array<{ node: { id: string; name: string } }> } | null;
  const locationId = locations?.edges?.[0]?.node?.id;
  if (locationId) {
    console.log(`Location: ${locations?.edges?.[0]?.node?.name} (${locationId})\n`);
  }

  // Step 1: Search for client by name
  const searchName = await prompt("Patient name to search: ");

  console.log(`\n--- Searching Boulevard for "${searchName}" ---`);
  const searchResult = await graphQuery(
    cookies,
    `query ClientSearch($query: String, $pageSize: Int, $pageNumber: Int, $filter: JSON) {
      clientSearch(query: $query, pageSize: $pageSize, pageNumber: $pageNumber, filter: $filter) {
        totalEntries
        clients {
          id
          firstName
          lastName
          fullName
          email
          phoneNumber
          active
          appointmentsCount
          lastAppointmentAt
          insertedAt
        }
      }
    }`,
    { query: searchName, pageSize: 10, pageNumber: 0, filter: "null" },
    "ClientSearch"
  );

  const searchData = searchResult.data?.clientSearch as {
    totalEntries: number;
    clients: Array<Record<string, unknown>>;
  };

  if (!searchData || searchData.clients.length === 0) {
    console.log(`No clients matching "${searchName}" found in Boulevard.`);
    process.exit(0);
  }

  console.log(`Found ${searchData.totalEntries} matching clients:\n`);

  searchData.clients.forEach((c, i) => {
    const emailStr = c.email ? ` (${c.email})` : "";
    const appts = c.appointmentsCount ? ` [${c.appointmentsCount} appts]` : "";
    console.log(`  [${i + 1}] ${c.fullName}${emailStr}${appts}`);
  });

  console.log();
  const choice = await prompt(`Pick a patient to import (1-${searchData.clients.length}): `);
  const idx = parseInt(choice, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= searchData.clients.length) {
    console.log("Invalid choice. Exiting.");
    process.exit(0);
  }

  const selectedId = searchData.clients[idx].id as string;
  const selectedName = searchData.clients[idx].fullName as string;

  // Step 2: Fetch full client details
  console.log(`\nFetching full details for "${selectedName}"...`);
  const detailResult = await graphQuery(
    cookies,
    `query GetClient($id: ID!) {
      client(id: $id, requestSource: CLIENT_PROFILE_OVERVIEW) {
        id
        firstName
        lastName
        fullName
        email
        phoneNumber
        dob
        pronoun
        sexAssignedAtBirth
        active
        address {
          line1
          line2
          city
          state
          zip
          country
        }
        tags {
          id
          name
        }
        bookingMemo {
          text
        }
        appointmentStatistics {
          appointmentCount
        }
      }
    }`,
    { id: selectedId },
    "GetClient"
  );

  const client = detailResult.data?.client as Record<string, unknown>;
  if (!client) {
    console.error("Failed to fetch client details.");
    process.exit(1);
  }

  const addr = client.address as { line1?: string; line2?: string; city?: string; state?: string; zip?: string } | null;
  const tags = client.tags as Array<{ name: string }> | null;
  const memo = client.bookingMemo as { text?: string } | null;

  console.log(`\n  Name: ${client.firstName} ${client.lastName}`);
  console.log(`  Email: ${client.email || "N/A"}`);
  console.log(`  Phone: ${client.phoneNumber || "N/A"}`);
  console.log(`  DOB: ${client.dob || "N/A"}`);
  console.log(`  Gender: ${client.pronoun || client.sexAssignedAtBirth || "N/A"}`);
  console.log(`  Address: ${addr?.line1 || "N/A"}${addr?.line2 ? `, ${addr.line2}` : ""}`);
  console.log(`  City/State/Zip: ${addr?.city || ""} ${addr?.state || ""} ${addr?.zip || ""}`);
  console.log(`  Tags: ${tags?.map(t => t.name).join(", ") || "None"}`);
  console.log(`  Booking Memo: ${memo?.text || "None"}`);
  console.log(`  Boulevard ID: ${client.id}`);

  // Step 3: Fetch photo gallery
  console.log(`\n--- Fetching photos for "${selectedName}" ---`);
  const photoResult = await graphQuery(
    cookies,
    `query getPhotoGallery($clientId: ID!, $options: GetPhotoGalleryOptions) {
      photoGallery(clientId: $clientId, options: $options) {
        cursor
        items {
          appointmentId
          customFormId
          serviceStaffIds
          entity
          id
          insertedAt
          label
          url
        }
      }
    }`,
    { clientId: selectedId, options: { limit: 100 } },
    "getPhotoGallery"
  );

  const gallery = photoResult.data?.photoGallery as {
    cursor: string | null;
    items: Array<Record<string, unknown>>;
  } | null;

  const photos = gallery?.items || [];
  if (photos.length > 0) {
    console.log(`Found ${photos.length} photo(s):\n`);
    photos.forEach((p, i) => {
      const label = p.label || "Unlabeled";
      const date = p.insertedAt ? new Date(p.insertedAt as string).toLocaleDateString() : "N/A";
      const apptId = p.appointmentId ? ` (appt: ${(p.appointmentId as string).slice(0, 8)}...)` : "";
      console.log(`  [${i + 1}] ${label} — ${date}${apptId}`);
      console.log(`       URL: ${(p.url as string).slice(0, 80)}...`);
    });
  } else {
    console.log("No photos found.");
  }

  // Step 4: Fetch forms/charts
  console.log(`\n--- Fetching forms/charts for "${selectedName}" ---`);
  const formsResult = await graphQuery(
    cookies,
    `query GetClientForms($id: ID!) {
      client(id: $id) {
        id
        pendingFormTemplates {
          id
          appointmentId
          name
          internal
        }
        customForms {
          id
          submittedByStaff {
            firstName
            lastName
          }
          submittedByClient {
            firstName
            lastName
          }
          updatedAt
          submittedAt
          offline
          status
          expirationDate
          version {
            template {
              id
              name
              internal
            }
            templatingVersion
          }
          appointment {
            id
            appointmentServices {
              id
              staff {
                id
                isMe
              }
            }
            abilities {
              view
            }
          }
        }
      }
    }`,
    { id: selectedId },
    "GetClientForms"
  );

  const formsClient = formsResult.data?.client as Record<string, unknown> | null;
  const pendingForms = (formsClient?.pendingFormTemplates as Array<Record<string, unknown>>) || [];
  const customForms = (formsClient?.customForms as Array<Record<string, unknown>>) || [];

  if (pendingForms.length > 0) {
    console.log(`\n  Pending forms (${pendingForms.length}):`);
    pendingForms.forEach((f, i) => {
      const internal = f.internal ? " [internal]" : "";
      console.log(`    [${i + 1}] ${f.name}${internal}`);
    });
  }

  if (customForms.length > 0) {
    console.log(`\n  Submitted forms (${customForms.length}):`);
    customForms.forEach((f, i) => {
      const version = f.version as { template?: { name?: string; internal?: boolean }; templatingVersion?: string } | null;
      const templateName = version?.template?.name || "Unknown Form";
      const internal = version?.template?.internal ? " [internal]" : "";
      const status = f.status || "unknown";
      const submittedAt = f.submittedAt ? new Date(f.submittedAt as string).toLocaleDateString() : "N/A";
      const staff = f.submittedByStaff as { firstName?: string; lastName?: string } | null;
      const submitter = staff ? `${staff.firstName} ${staff.lastName}` : "Client";
      const appt = f.appointment as { id?: string } | null;
      const apptStr = appt?.id ? ` (appt: ${appt.id.slice(0, 8)}...)` : "";
      console.log(`    [${i + 1}] ${templateName}${internal} — ${status} — ${submittedAt} — by ${submitter}${apptStr}`);
    });
  } else {
    console.log("No submitted forms found.");
  }

  // Step 5: Fetch files/documents
  let files: Array<Record<string, unknown>> = [];
  if (locationId) {
    console.log(`\n--- Fetching files for "${selectedName}" ---`);
    const filesResult = await graphQuery(
      cookies,
      `query getMigratedFiles($input: MigratedFilesInput!) {
        migratedFiles(input: $input) {
          migratedFiles {
            fileName
            id
            insertedAt
            originallyCreatedAt
            url
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          totalCount
        }
      }`,
      { input: { clientId: selectedId, locationId, limit: 50 } },
      "getMigratedFiles"
    );

    const filesData = filesResult.data?.migratedFiles as {
      migratedFiles: Array<Record<string, unknown>>;
      totalCount: number;
    } | null;

    files = filesData?.migratedFiles || [];
    if (files.length > 0) {
      console.log(`Found ${files.length} file(s) (total: ${filesData?.totalCount}):\n`);
      files.forEach((f, i) => {
        const name = f.fileName || "Unknown";
        const created = f.originallyCreatedAt
          ? new Date(f.originallyCreatedAt as string).toLocaleDateString()
          : f.insertedAt
            ? new Date(f.insertedAt as string).toLocaleDateString()
            : "N/A";
        console.log(`  [${i + 1}] ${name} — ${created}`);
        console.log(`       URL: ${(f.url as string).slice(0, 80)}...`);
      });
    } else {
      console.log(`No files found (total: ${filesData?.totalCount ?? 0}).`);
    }
  } else {
    console.log("\n--- Skipping files (no locationId found) ---");
  }

  // Summary
  console.log(`\n--- Import Summary ---`);
  console.log(`  Demographics: Yes`);
  console.log(`  Photos: ${photos.length}`);
  console.log(`  Pending forms: ${pendingForms.length}`);
  console.log(`  Submitted forms: ${customForms.length}`);
  console.log(`  Files: ${files.length}`);

  const confirm = await prompt("\nImport this patient into local Neuvvia dev DB? (yes/no): ");
  if (confirm.toLowerCase() !== "yes") {
    console.log("Cancelled.");
    process.exit(0);
  }

  // Find the first clinic in the dev DB
  const clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    console.error("ERROR: No clinic found in dev DB. Seed the database first.");
    process.exit(1);
  }

  // Check for duplicate
  const existing = await prisma.patient.findFirst({
    where: {
      clinicId: clinic.id,
      firstName: client.firstName as string,
      lastName: client.lastName as string,
    },
  });

  if (existing) {
    console.log(`\nPatient "${client.firstName} ${client.lastName}" already exists in dev DB (id: ${existing.id}). Skipping.`);
    process.exit(0);
  }

  // Create patient — medicalNotes only contains actual booking memo, not raw migration data
  const patient = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      firstName: (client.firstName as string) || "",
      lastName: (client.lastName as string) || "",
      email: (client.email as string)?.toLowerCase() || undefined,
      phone: (client.phoneNumber as string) || undefined,
      dateOfBirth: client.dob ? new Date(client.dob as string) : undefined,
      gender: (client.pronoun as string) || (client.sexAssignedAtBirth as string) || undefined,
      address: addr?.line1 || undefined,
      city: addr?.city || undefined,
      state: addr?.state || undefined,
      zipCode: addr?.zip || undefined,
      medicalNotes: memo?.text || undefined,
      tags: tags?.map((t) => t.name).join(",") || undefined,
    },
  });

  const firstUser = await prisma.user.findFirst({ where: { clinicId: clinic.id } });

  // Download photos to HIPAA-compliant storage path
  // Boulevard often provides both a processed thumbnail and the original for each photo.
  // We deduplicate by label, keeping only the highest-resolution version.
  if (photos.length > 0 && firstUser) {
    const photosDir = path.join("storage", "photos", clinic.id, patient.id);
    fs.mkdirSync(photosDir, { recursive: true });
    console.log(`\nDownloading ${photos.length} photo(s) to storage/...`);

    // Phase 1: Download all photos and get their metadata
    const downloaded: Array<{
      label: string;
      buffer: Buffer;
      mimeType: string;
      width: number;
      height: number;
      pixels: number;
    }> = [];

    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const url = p.url as string;
      try {
        const res = await fetch(url, { headers: { Cookie: cookies } });
        if (res.ok) {
          let buffer = Buffer.from(await res.arrayBuffer());
          let mimeType = res.headers.get("content-type") || "image/jpeg";

          // Flatten RGBA PNGs to JPEG — Boulevard serves some photos as PNGs
          // with transparent backgrounds which causes display issues
          const meta = await sharp(buffer).metadata();
          if (meta.hasAlpha) {
            buffer = await sharp(buffer)
              .flatten({ background: { r: 0, g: 0, b: 0 } })
              .jpeg({ quality: 90 })
              .toBuffer();
            mimeType = "image/jpeg";
          }

          const finalMeta = meta.hasAlpha ? await sharp(buffer).metadata() : meta;
          const w = finalMeta.width || 0;
          const h = finalMeta.height || 0;
          downloaded.push({
            label: (p.label as string) || `photo-${i + 1}`,
            buffer,
            mimeType,
            width: w,
            height: h,
            pixels: w * h,
          });
          console.log(`  Fetched: ${p.label || `photo-${i + 1}`} (${w}x${h}, ${(buffer.length / 1024).toFixed(0)} KB)`);
        } else {
          console.log(`  Failed to download photo ${i + 1}: ${res.status}`);
        }
      } catch (err) {
        console.log(`  Error downloading photo ${i + 1}: ${err}`);
      }
    }

    // Phase 2: Deduplicate — group by label, keep highest resolution
    // Only dedup when images have similar aspect ratios (same photo at different sizes).
    // Different aspect ratios = different images (e.g., original vs annotated markup).
    const byLabel = new Map<string, typeof downloaded>();
    for (const photo of downloaded) {
      const key = photo.label.trim().toLowerCase();
      if (!byLabel.has(key)) byLabel.set(key, []);
      byLabel.get(key)!.push(photo);
    }

    const deduped: typeof downloaded = [];
    for (const [label, group] of byLabel) {
      if (group.length > 1) {
        // Cluster by similar aspect ratio (within 15% tolerance)
        const clusters: (typeof downloaded)[] = [];
        for (const photo of group) {
          const ratio = photo.width / photo.height;
          const matched = clusters.find((c) => {
            const cRatio = c[0].width / c[0].height;
            return Math.abs(ratio - cRatio) / Math.max(ratio, cRatio) < 0.15;
          });
          if (matched) {
            matched.push(photo);
          } else {
            clusters.push([photo]);
          }
        }
        // From each cluster, keep only the highest-resolution version
        for (const cluster of clusters) {
          cluster.sort((a, b) => b.pixels - a.pixels);
          deduped.push(cluster[0]);
          if (cluster.length > 1) {
            console.log(`  Dedup: "${label}" — kept ${cluster[0].width}x${cluster[0].height}, skipped ${cluster.length - 1} lower-res duplicate(s)`);
          }
        }
        if (clusters.length > 1) {
          console.log(`  Kept ${clusters.length} distinct "${label}" images (different aspect ratios)`);
        }
      } else {
        deduped.push(group[0]);
      }
    }

    console.log(`  ${downloaded.length} photos downloaded, ${deduped.length} unique after dedup`);

    // Phase 3: Save deduplicated photos
    for (let i = 0; i < deduped.length; i++) {
      const photo = deduped[i];
      const filename = `photo-${i + 1}.jpg`;
      const storagePath = path.join(photosDir, filename);
      try {
        fs.writeFileSync(storagePath, photo.buffer);
        console.log(`  Saved: ${filename} — ${photo.label} (${photo.width}x${photo.height}, ${(photo.buffer.length / 1024).toFixed(0)} KB)`);

        await prisma.photo.create({
          data: {
            clinicId: clinic.id,
            patientId: patient.id,
            takenById: firstUser.id,
            filename,
            storagePath,
            mimeType: photo.mimeType,
            sizeBytes: photo.buffer.length,
            category: photo.label || "imported",
            caption: `[Imported from Boulevard] ${photo.label || "photo"}`,
          },
        });
      } catch (err) {
        console.log(`  Error saving photo ${i + 1}: ${err}`);
      }
    }
  }

  // Import forms with AI classification
  if (customForms.length > 0) {
    console.log(`\nClassifying ${customForms.length} form(s) with AI heuristics...`);

    // Build SourceForm-like objects and fetch form content
    interface FormFieldContent {
      fieldId: string;
      label: string;
      type: string;
      value: string | null;
      selectedOptions?: string[];
      availableOptions?: string[];
      sortOrder?: number;
    }

    interface ClassifiableForm {
      sourceId: string;
      templateName: string;
      isInternal: boolean;
      status: string;
      submittedAt: string | null;
      submittedByName: string | null;
      submittedByRole: "staff" | "client" | null;
      appointmentSourceId: string | null;
      fields?: FormFieldContent[];
      raw: Record<string, unknown>;
    }

    // Boulevard form content query — uses inline fragments for the CustomFormComponent union
    const FORM_CONTENT_QUERY = `query GetFormContent($id: ID!) {
      customForm(id: $id) {
        id
        formUrl
        version {
          template { name }
          components {
            __typename
            ... on CustomFormComponentTextV2 { id y value }
            ... on CustomFormComponentTextInputV2 { id y label textAnswer placeholder connectedField }
            ... on CustomFormComponentTextarea { id y label textAnswer textareaAnswer }
            ... on CustomFormComponentText { id y label textAnswer }
            ... on CustomFormComponentCheckboxV2 { id y label checkboxAnswer values { label } enableOther otherAnswer }
            ... on CustomFormComponentCheckbox { id y label checkboxAnswer values { label } }
            ... on CustomFormComponentDateV2 { id y label dateAnswer connectedField }
            ... on CustomFormComponentDate { id y label dateAnswer }
            ... on CustomFormComponentDropdownV2 { id y label dropdownAnswer values { label } }
            ... on CustomFormComponentSelect { id y label selectAnswer values { label } }
            ... on CustomFormComponentMultipleChoiceV2 { id y label radioAnswer values { label } }
            ... on CustomFormComponentRadio { id y label radioAnswer values { label } }
            ... on CustomFormComponentSignatureV2 { id y label }
            ... on CustomFormComponentSignature { id y label }
            ... on CustomFormComponentImageUploaderV2 { id y label }
            ... on CustomFormComponentImageV2 { id y label src }
            ... on CustomFormComponentH1 { id y label }
            ... on CustomFormComponentH2 { id y label }
            ... on CustomFormComponentDividerV2 { id y }
            ... on CustomFormComponentLogoV2 { id y }
            ... on CustomFormComponentLogo { id y }
            ... on CustomFormComponentMarkdown { id y markdownContent }
          }
        }
      }
    }`;

    function parseBoulevardComponents(components: Array<Record<string, unknown>>): FormFieldContent[] {
      const fields: FormFieldContent[] = [];
      for (const comp of components) {
        const typename = comp.__typename as string;
        const id = (comp.id as string) || "";
        const y = (comp.y as number) ?? 0;

        // Skip decorative
        if (typename.includes("Divider") || typename.includes("Logo") || typename === "CustomFormComponentMarkdown") continue;

        if (typename === "CustomFormComponentH1" || typename === "CustomFormComponentH2") {
          if (comp.label) fields.push({ fieldId: id, label: comp.label as string, type: "heading", value: null, sortOrder: y });
          continue;
        }
        if (typename === "CustomFormComponentTextV2") {
          if (comp.value) fields.push({ fieldId: id, label: comp.value as string, type: "heading", value: null, sortOrder: y });
          continue;
        }
        if (typename === "CustomFormComponentTextInputV2" || typename === "CustomFormComponentText") {
          fields.push({ fieldId: id, label: (comp.label as string) || "", type: "text", value: (comp.textAnswer as string) || null, sortOrder: y });
          continue;
        }
        if (typename === "CustomFormComponentTextarea") {
          fields.push({ fieldId: id, label: (comp.label as string) || "", type: "textarea", value: (comp.textareaAnswer as string) || (comp.textAnswer as string) || null, sortOrder: y });
          continue;
        }
        if (typename.includes("Checkbox")) {
          const checked = (comp.checkboxAnswer as string[]) || [];
          const vals = (comp.values as Array<{ label: string }>) || [];
          const other = comp.otherAnswer as string | undefined;
          const selected = [...checked];
          if (other) selected.push(other);
          fields.push({ fieldId: id, label: (comp.label as string) || "", type: "checkbox", value: selected.join(", ") || null, selectedOptions: selected.length > 0 ? selected : undefined, availableOptions: vals.map(v => v.label), sortOrder: y });
          continue;
        }
        if (typename.includes("Date")) {
          fields.push({ fieldId: id, label: (comp.label as string) || "", type: "date", value: (comp.dateAnswer as string) || null, sortOrder: y });
          continue;
        }
        if (typename.includes("Dropdown")) {
          const answer = (comp.dropdownAnswer as string[]) || [];
          const vals = (comp.values as Array<{ label: string }>) || [];
          fields.push({ fieldId: id, label: (comp.label as string) || "", type: "dropdown", value: answer.join(", ") || null, selectedOptions: answer.length > 0 ? answer : undefined, availableOptions: vals.map(v => v.label), sortOrder: y });
          continue;
        }
        if (typename.includes("Select")) {
          const answer = (comp.selectAnswer as string[]) || [];
          const vals = (comp.values as Array<{ label: string }>) || [];
          fields.push({ fieldId: id, label: (comp.label as string) || "", type: "select", value: answer.join(", ") || null, selectedOptions: answer.length > 0 ? answer : undefined, availableOptions: vals.map(v => v.label), sortOrder: y });
          continue;
        }
        if (typename.includes("MultipleChoice") || typename.includes("Radio")) {
          const vals = (comp.values as Array<{ label: string }>) || [];
          fields.push({ fieldId: id, label: (comp.label as string) || "", type: "radio", value: (comp.radioAnswer as string) || null, availableOptions: vals.map(v => v.label), sortOrder: y });
          continue;
        }
        if (typename.includes("Signature")) {
          fields.push({ fieldId: id, label: (comp.label as string) || "Signature", type: "signature", value: "[signed]", sortOrder: y });
          continue;
        }
        if (typename.includes("Image")) {
          fields.push({ fieldId: id, label: (comp.label as string) || "Photo", type: "image", value: (comp.src as string) || null, sortOrder: y });
          continue;
        }
      }
      fields.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      return fields;
    }

    const classifiableForms: ClassifiableForm[] = [];

    for (const f of customForms) {
      const v = f.version as { template?: { id?: string; name?: string; internal?: boolean } } | null;
      const staff = f.submittedByStaff as { firstName?: string; lastName?: string } | null;
      const clientSubmitter = f.submittedByClient as { firstName?: string; lastName?: string } | null;
      const appt = f.appointment as { id?: string } | null;

      // Fetch form field content from Boulevard using inline fragments
      let fields: FormFieldContent[] = [];
      try {
        const contentResult = await graphQuery(
          cookies,
          FORM_CONTENT_QUERY,
          { id: f.id as string },
          "GetFormContent"
        );

        const formData = contentResult.data?.customForm as Record<string, unknown> | null;
        const version = formData?.version as { components?: Array<Record<string, unknown>> } | null;
        if (version?.components) {
          fields = parseBoulevardComponents(version.components);
        }
      } catch {
        // Content fetch failed — proceed without field content
      }

      classifiableForms.push({
        sourceId: f.id as string,
        templateName: v?.template?.name || "Unknown Form",
        isInternal: v?.template?.internal || false,
        status: (f.status as string) || "unknown",
        submittedAt: (f.submittedAt as string) || null,
        submittedByName: staff?.firstName
          ? `${staff.firstName} ${staff.lastName || ""}`.trim()
          : clientSubmitter?.firstName
            ? `${clientSubmitter.firstName} ${clientSubmitter.lastName || ""}`.trim()
            : null,
        submittedByRole: staff?.firstName ? "staff" : clientSubmitter?.firstName ? "client" : null,
        appointmentSourceId: appt?.id || null,
        fields: fields.length > 0 ? fields : undefined,
        raw: f,
      });
    }

    // Classify using heuristics (same logic as classifyAndMapForms mock fallback)
    function classifyForm(f: ClassifiableForm) {
      const name = f.templateName.toLowerCase();

      if (f.isInternal && !name.includes("chart") && !name.includes("treatment")) {
        return { classification: "skip" as const, chartData: null };
      }
      if (
        name.includes("consent") || name.includes("waiver") || name.includes("agreement") ||
        name.includes("policy") || name.includes("authorization") || name.includes("instructions")
      ) {
        return { classification: "consent" as const, chartData: null };
      }
      if (
        name.includes("intake") || name.includes("history") || name.includes("questionnaire") ||
        name.includes("survey") || name.includes("registration")
      ) {
        return { classification: "intake" as const, chartData: null };
      }
      if (
        name.includes("chart") || name.includes("treatment") || name.includes("procedure") ||
        name.includes("clinical") || name.includes("assessment")
      ) {
        // Build rich narrative from form fields (format-agnostic)
        const dataFields = f.fields?.filter((fld) =>
          fld.type !== "heading" && fld.type !== "signature" && fld.type !== "image"
        ) || [];

        const narrativeLines: string[] = [];
        for (const fld of dataFields) {
          if (!fld.value && (!fld.selectedOptions || fld.selectedOptions.length === 0)) continue;
          const val = fld.selectedOptions?.length
            ? fld.selectedOptions.join(", ")
            : fld.value || "";
          if (val) narrativeLines.push(`${fld.label}: ${val}`);
        }

        return {
          classification: "clinical_chart" as const,
          chartData: {
            chiefComplaint: f.templateName,
            templateType: "Other" as const,
            treatmentCardTitle: f.templateName,
            narrativeText: narrativeLines.join("\n"),
            structuredData: {},
          },
        };
      }
      return { classification: "consent" as const, chartData: null };
    }

    const templateCache = new Map<string, string>();
    let consentCount = 0;
    let chartCount = 0;
    let skipCount = 0;

    for (const form of classifiableForms) {
      const { classification, chartData } = classifyForm(form);
      console.log(`  [${classification.toUpperCase()}] ${form.templateName}${form.fields ? ` (${form.fields.length} fields)` : ""}`);

      try {
        if (classification === "skip") {
          skipCount++;
          continue;
        }

        if (classification === "clinical_chart" && chartData) {
          // Create Chart + TreatmentCard
          const chartDate = form.submittedAt ? new Date(form.submittedAt) : new Date();
          const newChart = await prisma.chart.create({
            data: {
              clinicId: clinic.id,
              patientId: patient.id,
              status: "MDSigned",
              chiefComplaint: chartData.chiefComplaint,
              additionalNotes: chartData.narrativeText || null,
              createdById: firstUser?.id || null,
              signedAt: chartDate,
              createdAt: chartDate,
            },
          });

          await prisma.treatmentCard.create({
            data: {
              chartId: newChart.id,
              templateType: chartData.templateType,
              title: chartData.treatmentCardTitle,
              narrativeText: chartData.narrativeText,
              structuredData: JSON.stringify(chartData.structuredData),
            },
          });

          chartCount++;
          console.log(`    → Created Chart + TreatmentCard (${chartData.templateType})`);
          continue;
        }

        // consent or intake → PatientConsent
        let templateId = templateCache.get(form.templateName);
        if (!templateId) {
          const existing = await prisma.consentTemplate.findFirst({
            where: { clinicId: clinic.id, name: form.templateName },
            select: { id: true },
          });
          if (existing) {
            templateId = existing.id;
          } else {
            const newTemplate = await prisma.consentTemplate.create({
              data: {
                clinicId: clinic.id,
                name: form.templateName,
                content: `[Imported from Boulevard] This consent template was automatically created during data migration.`,
              },
            });
            templateId = newTemplate.id;
          }
          templateCache.set(form.templateName, templateId);
        }

        // Build snapshot with form field content
        // Fill in auto-populated fields from patient/form data
        const snapshotData: Record<string, unknown> = {
          importedFrom: "Boulevard",
          originalStatus: form.status,
          isInternal: form.isInternal,
          submittedByName: form.submittedByName,
          submittedByRole: form.submittedByRole,
        };
        if (form.fields && form.fields.length > 0) {
          snapshotData.formFields = form.fields.map((f) => {
            let resolvedValue = f.value;

            // Resolve auto-populated connected fields from patient data
            if (!resolvedValue || resolvedValue === "") {
              const lbl = f.label.toLowerCase();
              if (lbl === "first name" || lbl === "first_name" || lbl === "firstname") {
                resolvedValue = client.firstName as string || null;
              } else if (lbl === "last name" || lbl === "last_name" || lbl === "lastname") {
                resolvedValue = client.lastName as string || null;
              } else if (lbl === "email" || lbl === "email address") {
                resolvedValue = client.email as string || null;
              } else if (lbl === "phone" || lbl === "phone number") {
                resolvedValue = client.phoneNumber as string || null;
              } else if (lbl === "date of birth" || lbl === "patient date of birth" || lbl === "dob") {
                resolvedValue = client.dob as string || null;
              } else if (lbl.includes("today") && lbl.includes("date") || lbl === "date" || lbl === "signature date" || lbl === "treatment date") {
                resolvedValue = form.submittedAt
                  ? new Date(form.submittedAt).toLocaleDateString()
                  : null;
              }
            }

            return {
              label: f.label,
              type: f.type,
              value: resolvedValue,
              selectedOptions: f.selectedOptions,
            };
          });
        }

        await prisma.patientConsent.create({
          data: {
            clinicId: clinic.id,
            patientId: patient.id,
            templateId,
            signedAt: form.submittedAt ? new Date(form.submittedAt) : null,
            templateSnapshot: JSON.stringify(snapshotData),
          },
        });
        consentCount++;
      } catch (err) {
        console.log(`    Error: ${err}`);
      }
    }

    console.log(`\n  Classification results: ${consentCount} consents, ${chartCount} charts, ${skipCount} skipped`);
  }

  // Download files/documents to HIPAA-compliant storage path
  if (files.length > 0 && firstUser) {
    const filesDir = path.join("storage", "documents", clinic.id, patient.id);
    fs.mkdirSync(filesDir, { recursive: true });
    console.log(`\nDownloading ${files.length} file(s) to storage/...`);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const url = f.url as string;
      const filename = (f.fileName as string) || `file-${i + 1}`;
      const storagePath = path.join(filesDir, filename);
      try {
        const res = await fetch(url, { headers: { Cookie: cookies } });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(storagePath, buffer);
          console.log(`  Downloaded: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);

          await prisma.patientDocument.create({
            data: {
              clinicId: clinic.id,
              patientId: patient.id,
              uploadedById: firstUser.id,
              filename,
              storagePath,
              mimeType: res.headers.get("content-type") || null,
              sizeBytes: buffer.length,
              category: "imported",
              notes: "[Imported from Boulevard]",
            },
          });
        } else {
          console.log(`  Failed to download file ${i + 1}: ${res.status}`);
        }
      } catch (err) {
        console.log(`  Error downloading file ${i + 1}: ${err}`);
      }
    }
  }

  console.log(`\n=== IMPORT SUCCESSFUL ===`);
  console.log(`Neuvvia Patient ID: ${patient.id}`);
  console.log(`Name: ${patient.firstName} ${patient.lastName}`);
  console.log(`Clinic: ${clinic.name} (${clinic.id})`);
  console.log(`Source Boulevard ID: ${client.id}`);
  // Count what was actually created
  const finalCounts = {
    photos: await prisma.photo.count({ where: { patientId: patient.id } }),
    consents: await prisma.patientConsent.count({ where: { patientId: patient.id } }),
    charts: await prisma.chart.count({ where: { patientId: patient.id } }),
    treatmentCards: await prisma.treatmentCard.count({ where: { chart: { patientId: patient.id } } }),
    documents: await prisma.patientDocument.count({ where: { patientId: patient.id } }),
  };

  console.log(`\nStored in Neuvvia models:`);
  console.log(`  Demographics: Yes`);
  console.log(`  Medical Notes: ${memo?.text ? "Booking memo only" : "None"}`);
  console.log(`  Photo records: ${finalCounts.photos} (storage/photos/)`);
  console.log(`  Consent records: ${finalCounts.consents} (ConsentTemplate + PatientConsent)`);
  console.log(`  Chart records: ${finalCounts.charts} (Chart + ${finalCounts.treatmentCards} TreatmentCards)`);
  console.log(`  Document records: ${finalCounts.documents} (storage/documents/)`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
