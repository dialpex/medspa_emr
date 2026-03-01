/**
 * Boulevard Form Components Explorer (Phase 2)
 *
 * Discovers all CustomFormComponent union members and their fields,
 * then fetches actual form content using inline fragments.
 *
 * Run: npx tsx scripts/explore-boulevard-form-components.ts
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
  if (sessionRes.status !== 204 && sessionRes.status !== 200) throw new Error(`Login failed (${sessionRes.status})`);
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

async function graphQuery(cookies: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(BOULEVARD_GRAPH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json, text/plain, */*",
      Cookie: cookies,
      Origin: BOULEVARD_BASE,
      Referer: `${BOULEVARD_BASE}/home`,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function main() {
  console.log("=== Boulevard Form Components Explorer ===\n");

  const email = await prompt("Boulevard email: ");
  const password = await prompt("Boulevard password: ", true);
  const cookies = await authenticate(email, password);
  console.log("Authenticated OK\n");

  // Step 1: Introspect CustomFormComponent union type
  console.log("--- Step 1: Introspect CustomFormComponent union ---\n");
  const unionResult = await graphQuery(cookies, `query {
    __type(name: "CustomFormComponent") {
      kind
      possibleTypes { name }
    }
  }`);

  const possibleTypes = (unionResult.data?.__type as { possibleTypes: Array<{ name: string }> })?.possibleTypes;
  if (possibleTypes) {
    console.log("CustomFormComponent is a UNION with these types:");
    for (const t of possibleTypes) {
      console.log(`  - ${t.name}`);
    }
  } else {
    console.log("Result:", JSON.stringify(unionResult, null, 2));
  }

  // Step 2: Introspect each component type's fields
  if (possibleTypes) {
    console.log("\n--- Step 2: Introspect each component type ---\n");
    for (const t of possibleTypes) {
      const typeResult = await graphQuery(cookies, `query {
        __type(name: "${t.name}") {
          name
          fields { name type { name kind ofType { name kind } } }
        }
      }`);
      const fields = (typeResult.data?.__type as { fields: Array<{ name: string; type: { name: string; kind: string; ofType?: { name: string } } }> })?.fields;
      if (fields) {
        console.log(`${t.name}:`);
        for (const f of fields) {
          const typeName = f.type.name || `[${f.type.ofType?.name || f.type.kind}]`;
          console.log(`  ${f.name}: ${typeName}`);
        }
        console.log();
      }
    }
  }

  // Step 3: Also check formUrl and other top-level fields on CustomForm
  console.log("--- Step 3: Full CustomForm introspection ---\n");
  const cfResult = await graphQuery(cookies, `query {
    __type(name: "CustomForm") {
      fields {
        name
        type { name kind ofType { name kind ofType { name kind } } }
      }
    }
  }`);
  const cfFields = (cfResult.data?.__type as { fields: Array<{ name: string; type: Record<string, unknown> }> })?.fields;
  if (cfFields) {
    console.log("CustomForm fields:");
    for (const f of cfFields) {
      console.log(`  ${f.name}: ${JSON.stringify(f.type)}`);
    }
  }

  // Step 4: Also check CustomFormVersion fields
  console.log("\n--- Step 4: Full CustomFormVersion introspection ---\n");
  const vResult = await graphQuery(cookies, `query {
    __type(name: "CustomFormVersion") {
      fields {
        name
        type { name kind ofType { name kind ofType { name kind } } }
      }
    }
  }`);
  const vFields = (vResult.data?.__type as { fields: Array<{ name: string; type: Record<string, unknown> }> })?.fields;
  if (vFields) {
    console.log("CustomFormVersion fields:");
    for (const f of vFields) {
      console.log(`  ${f.name}: ${JSON.stringify(f.type)}`);
    }
  }

  // Step 5: Fetch Carla Cora's Dermalier chart using inline fragments
  const searchName = await prompt("\nPatient name to search: ");
  const searchResult = await graphQuery(cookies,
    `query($q: String) { clientSearch(query: $q, pageSize: 5, pageNumber: 0, filter: "null") { clients { id fullName } } }`,
    { q: searchName }
  );
  const clients = (searchResult.data?.clientSearch as { clients: Array<{ id: string; fullName: string }> })?.clients;
  if (!clients?.length) { console.log("No clients found."); process.exit(0); }

  const clientId = clients[0].id;
  console.log(`\nUsing client: ${clients[0].fullName}`);

  // Get forms
  const formsResult = await graphQuery(cookies,
    `query($id: ID!) { client(id: $id) { customForms { id version { template { name } templatingVersion } status } } }`,
    { id: clientId }
  );
  const forms = (formsResult.data?.client as { customForms: Array<Record<string, unknown>> })?.customForms || [];
  console.log(`\nForms (${forms.length}):`);
  forms.forEach((f, i) => {
    const v = f.version as { template?: { name: string }; templatingVersion?: number };
    console.log(`  [${i + 1}] ${v?.template?.name} (v${v?.templatingVersion}, id: ${f.id})`);
  });

  const formChoice = await prompt(`\nPick form to fetch content (1-${forms.length}): `);
  const formId = forms[parseInt(formChoice, 10) - 1]?.id as string;
  if (!formId) { console.log("Invalid."); process.exit(0); }

  // Step 6: Fetch with inline fragments for all known V2 component types
  console.log(`\n--- Step 6: Fetching form ${formId} with inline fragments ---\n`);

  // Build a comprehensive query with all known component subtypes
  const contentQuery = `query GetFormContent($id: ID!) {
    customForm(id: $id) {
      id
      formUrl
      version {
        template { name }
        templatingVersion
        components {
          __typename
          ... on CustomFormComponentTextV2 {
            id
            h
            w
            x
            y
            label
            value
            floatingLabel
          }
          ... on CustomFormComponentCheckboxV2 {
            id
            h
            w
            x
            y
            label
            checked
          }
          ... on CustomFormComponentCheckbox {
            id
            h
            w
            x
            y
            label
            checked
          }
          ... on CustomFormComponentDateV2 {
            id
            h
            w
            x
            y
            label
            dateValue: value
          }
          ... on CustomFormComponentDate {
            id
            h
            w
            x
            y
            label
            dateValue: value
          }
          ... on CustomFormComponentDropdownV2 {
            id
            h
            w
            x
            y
            label
            dropdownValues: values
            selectedValue: value
          }
          ... on CustomFormComponentTextInputV2 {
            id
            h
            w
            x
            y
            label
            textInputValue: value
          }
          ... on CustomFormComponentTextareaV2 {
            id
            h
            w
            x
            y
            label
            textareaValue: value
          }
          ... on CustomFormComponentSignatureV2 {
            id
            h
            w
            x
            y
            label
            signatureUrl: value
          }
          ... on CustomFormComponentImageV2 {
            id
            h
            w
            x
            y
            label
            imageUrl: value
          }
          ... on CustomFormComponentRadioV2 {
            id
            h
            w
            x
            y
            label
            radioValues: values
            radioValue: value
          }
          ... on CustomFormComponentLikertScaleV2 {
            id
            h
            w
            x
            y
            label
            likertValue: value
          }
        }
      }
    }
  }`;

  const contentResult = await graphQuery(cookies, contentQuery, { id: formId });

  if (contentResult.errors) {
    console.log("Errors:", JSON.stringify(contentResult.errors, null, 2));
    console.log("\nLet me try with just __typename to see what types exist...");

    const simpleQuery = await graphQuery(cookies, `query($id: ID!) {
      customForm(id: $id) {
        id
        formUrl
        version {
          components { __typename id h w x y }
        }
      }
    }`, { id: formId });
    console.log(JSON.stringify(simpleQuery, null, 2));
  } else {
    console.log(JSON.stringify(contentResult, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
