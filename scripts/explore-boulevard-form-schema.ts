/**
 * Boulevard Form Schema Explorer
 *
 * Discovers the correct GraphQL schema for fetching form field content.
 * Run: npx tsx scripts/explore-boulevard-form-schema.ts
 */

import * as readline from "readline";

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

  const result = await res.json();
  return result;
}

async function main() {
  console.log("=== Boulevard Form Schema Explorer ===\n");

  const email = await prompt("Boulevard email: ");
  const password = await prompt("Boulevard password: ", true);
  const cookies = await authenticate(email, password);
  console.log("Authenticated OK\n");

  // Step 1: Introspect the CustomForm type
  console.log("--- Step 1: Introspecting CustomForm type ---\n");
  const introspectResult = await graphQuery(
    cookies,
    `query IntrospectCustomForm {
      __type(name: "CustomForm") {
        name
        fields {
          name
          type {
            name
            kind
            ofType { name kind ofType { name kind } }
          }
        }
      }
    }`
  );

  const customFormFields = (introspectResult.data?.__type as { fields: Array<{ name: string; type: { name: string; kind: string; ofType?: unknown } }> })?.fields;
  if (customFormFields) {
    console.log("CustomForm fields:");
    for (const f of customFormFields) {
      const typeName = f.type.name || `[${(f.type.ofType as { name?: string })?.name || f.type.kind}]`;
      console.log(`  ${f.name}: ${typeName}`);
    }
  } else {
    console.log("Failed to introspect CustomForm:", JSON.stringify(introspectResult.errors, null, 2));
  }

  // Step 2: Introspect the CustomFormVersion type
  console.log("\n--- Step 2: Introspecting CustomFormVersion type ---\n");
  const versionResult = await graphQuery(
    cookies,
    `query IntrospectVersion {
      __type(name: "CustomFormVersion") {
        name
        fields {
          name
          type {
            name
            kind
            ofType { name kind ofType { name kind } }
          }
        }
      }
    }`
  );

  const versionFields = (versionResult.data?.__type as { fields: Array<{ name: string; type: { name: string; kind: string; ofType?: unknown } }> })?.fields;
  if (versionFields) {
    console.log("CustomFormVersion fields:");
    for (const f of versionFields) {
      const typeName = f.type.name || `[${(f.type.ofType as { name?: string })?.name || f.type.kind}]`;
      console.log(`  ${f.name}: ${typeName}`);
    }
  }

  // Step 3: Search for client and get form IDs
  const searchName = await prompt("\nPatient name to search: ");
  const searchResult = await graphQuery(
    cookies,
    `query ClientSearch($query: String, $pageSize: Int, $pageNumber: Int, $filter: JSON) {
      clientSearch(query: $query, pageSize: $pageSize, pageNumber: $pageNumber, filter: $filter) {
        clients { id fullName }
      }
    }`,
    { query: searchName, pageSize: 5, pageNumber: 0, filter: "null" }
  );

  const clients = (searchResult.data?.clientSearch as { clients: Array<{ id: string; fullName: string }> })?.clients;
  if (!clients?.length) {
    console.log("No clients found.");
    process.exit(0);
  }

  const clientId = clients[0].id;
  console.log(`\nUsing client: ${clients[0].fullName} (${clientId})`);

  // Step 4: Get forms for this client
  const formsResult = await graphQuery(
    cookies,
    `query GetClientForms($id: ID!) {
      client(id: $id) {
        customForms {
          id
          version {
            template { name internal }
            templatingVersion
          }
          status
        }
      }
    }`,
    { id: clientId }
  );

  const forms = (formsResult.data?.client as { customForms: Array<Record<string, unknown>> })?.customForms || [];
  console.log(`\nFound ${forms.length} forms:`);
  forms.forEach((f, i) => {
    const v = f.version as { template?: { name: string; internal: boolean }; templatingVersion?: string };
    console.log(`  [${i + 1}] ${v?.template?.name || "Unknown"} (status: ${f.status}, templatingVersion: ${v?.templatingVersion}, id: ${f.id})`);
  });

  if (forms.length === 0) process.exit(0);

  const formChoice = await prompt(`\nPick a form to explore (1-${forms.length}): `);
  const formIdx = parseInt(formChoice, 10) - 1;
  const formId = forms[formIdx]?.id as string;

  if (!formId) {
    console.log("Invalid choice.");
    process.exit(0);
  }

  // Step 5: Try multiple query shapes for form content
  console.log(`\n--- Step 5: Exploring form ${formId} ---\n`);

  // Query A: Our current query (sections.fields)
  console.log("=== Query A: version.sections.fields ===");
  const queryA = await graphQuery(
    cookies,
    `query GetFormContentA($id: ID!) {
      customForm(id: $id) {
        id
        version {
          sections {
            fields {
              id
              label
              type
              values { value }
              options { label selected }
            }
          }
        }
      }
    }`,
    { id: formId }
  );
  console.log(JSON.stringify(queryA, null, 2));

  // Query B: Try version.components
  console.log("\n=== Query B: version.components ===");
  const queryB = await graphQuery(
    cookies,
    `query GetFormContentB($id: ID!) {
      customForm(id: $id) {
        id
        version {
          components {
            id
            label
            type
            value
          }
        }
      }
    }`,
    { id: formId }
  );
  console.log(JSON.stringify(queryB, null, 2));

  // Query C: Try formValues / responses at root level
  console.log("\n=== Query C: formValues / responses ===");
  const queryC = await graphQuery(
    cookies,
    `query GetFormContentC($id: ID!) {
      customForm(id: $id) {
        id
        formValues {
          fieldId
          value
        }
      }
    }`,
    { id: formId }
  );
  console.log(JSON.stringify(queryC, null, 2));

  // Query D: Try deeply nested version with more fields
  console.log("\n=== Query D: Deep version introspection ===");
  const queryD = await graphQuery(
    cookies,
    `query GetFormContentD($id: ID!) {
      customForm(id: $id) {
        id
        version {
          template { name }
          templatingVersion
          sections {
            id
            label
            fields {
              id
              label
              type
              required
              values { value }
              options { label selected value }
            }
          }
        }
      }
    }`,
    { id: formId }
  );
  console.log(JSON.stringify(queryD, null, 2));

  // Query E: Full __typename introspection to see all available fields
  console.log("\n=== Query E: __typename discovery ===");
  const queryE = await graphQuery(
    cookies,
    `query GetFormContentE($id: ID!) {
      customForm(id: $id) {
        __typename
        id
        version {
          __typename
          template { __typename name }
          templatingVersion
        }
      }
    }`,
    { id: formId }
  );
  console.log(JSON.stringify(queryE, null, 2));

  // Query F: Introspect what fields sections and fields have
  console.log("\n=== Query F: Introspect CustomFormSection type ===");
  const queryF = await graphQuery(
    cookies,
    `query {
      __type(name: "CustomFormSection") {
        name
        fields { name type { name kind ofType { name kind } } }
      }
    }`
  );
  console.log(JSON.stringify(queryF, null, 2));

  console.log("\n=== Query G: Introspect CustomFormField type ===");
  const queryG = await graphQuery(
    cookies,
    `query {
      __type(name: "CustomFormField") {
        name
        fields { name type { name kind ofType { name kind } } }
      }
    }`
  );
  console.log(JSON.stringify(queryG, null, 2));

  console.log("\nDone. Review the output above to find the correct query structure.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
