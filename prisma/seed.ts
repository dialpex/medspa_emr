import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Default password for all demo users
const DEFAULT_PASSWORD = "password123";

async function main() {
  console.log("Seeding database...");

  // Generate password hash for demo users
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  console.log("Generated password hash for demo users");

  // ===========================================
  // CLINIC
  // ===========================================
  const clinic = await prisma.clinic.create({
    data: {
      name: "Radiance MedSpa",
      slug: "radiance-medspa",
      address: "123 Beauty Lane, Suite 100",
      phone: "(555) 123-4567",
      email: "info@radiancemedspa.com",
      timezone: "America/New_York",
    },
  });
  console.log(`Created clinic: ${clinic.name}`);

  // ===========================================
  // ROOMS
  // ===========================================
  const rooms = await Promise.all([
    prisma.room.create({
      data: { clinicId: clinic.id, name: "Treatment Room 1" },
    }),
    prisma.room.create({
      data: { clinicId: clinic.id, name: "Treatment Room 2" },
    }),
    prisma.room.create({
      data: { clinicId: clinic.id, name: "Consultation Room" },
    }),
  ]);
  console.log(`Created ${rooms.length} rooms`);

  // ===========================================
  // USERS
  // ===========================================
  const owner = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      email: "sarah.owner@radiancemedspa.com",
      name: "Dr. Sarah Mitchell",
      role: "Owner",
      passwordHash: passwordHash,
    },
  });

  const medicalDirector = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      email: "dr.chen@radiancemedspa.com",
      name: "Dr. Michael Chen",
      role: "MedicalDirector",
      requiresMDReview: false,
      passwordHash: passwordHash,
    },
  });

  const provider1 = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      email: "jessica.np@radiancemedspa.com",
      name: "Jessica Adams, NP",
      role: "Provider",
      requiresMDReview: true,
      supervisingMDId: medicalDirector.id,
      passwordHash: passwordHash,
    },
  });

  const provider2 = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      email: "emily.rn@radiancemedspa.com",
      name: "Emily Rodriguez, RN",
      role: "Provider",
      passwordHash: passwordHash,
    },
  });

  const frontDesk = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      email: "amanda.front@radiancemedspa.com",
      name: "Amanda Thompson",
      role: "FrontDesk",
      passwordHash: passwordHash,
    },
  });

  const billing = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      email: "robert.billing@radiancemedspa.com",
      name: "Robert Garcia",
      role: "Billing",
      passwordHash: passwordHash,
    },
  });

  console.log("Created 6 users (1 NP with requiresMDReview=true)");

  // ===========================================
  // SERVICES
  // ===========================================
  const services = await Promise.all([
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Botox - Forehead",
        description: "Botulinum toxin injection for forehead lines",
        duration: 30,
        price: 350,
        category: "Injectables",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Botox - Crow's Feet",
        description: "Botulinum toxin injection for crow's feet",
        duration: 20,
        price: 250,
        category: "Injectables",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Botox - Glabella",
        description: "Botulinum toxin injection for frown lines",
        duration: 20,
        price: 300,
        category: "Injectables",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Juvederm Ultra - Lips",
        description: "Hyaluronic acid filler for lip enhancement",
        duration: 45,
        price: 650,
        category: "Fillers",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Juvederm Voluma - Cheeks",
        description: "Hyaluronic acid filler for cheek augmentation",
        duration: 45,
        price: 850,
        category: "Fillers",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Sculptra - Full Face",
        description: "Poly-L-lactic acid for facial volume restoration",
        duration: 60,
        price: 950,
        category: "Fillers",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Chemical Peel - Light",
        description: "Superficial chemical peel for skin rejuvenation",
        duration: 30,
        price: 150,
        category: "Esthetics",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Microneedling",
        description: "Collagen induction therapy",
        duration: 60,
        price: 350,
        category: "Esthetics",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "IPL Photofacial",
        description: "Intense pulsed light treatment for sun damage and redness",
        duration: 45,
        price: 400,
        category: "Laser",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Laser Hair Removal - Face",
        description: "Laser hair removal for facial areas",
        duration: 30,
        price: 250,
        category: "Laser",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Consultation",
        description: "Initial consultation with provider",
        duration: 30,
        price: 100,
        category: "Consultation",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Follow-Up Visit",
        description: "Post-treatment follow-up appointment",
        duration: 15,
        price: 0,
        category: "Consultation",
      },
    }),
  ]);
  console.log(`Created ${services.length} services`);

  // ===========================================
  // PRODUCTS (Retail items)
  // ===========================================
  const products = await Promise.all([
    prisma.product.create({
      data: {
        clinicId: clinic.id,
        name: "SkinCeuticals C E Ferulic Serum",
        description: "High-potency vitamin C antioxidant serum with ferulic acid",
        size: "1.0 oz",
        sku: "SKC-CEF-30",
        upc: "635494263008",
        category: "Skincare",
        retailPrice: 182,
        wholesaleCost: 91,
        vendor: "SkinCeuticals",
        inventoryCount: 12,
        taxable: true,
      },
    }),
    prisma.product.create({
      data: {
        clinicId: clinic.id,
        name: "EltaMD UV Clear Sunscreen SPF 46",
        description: "Oil-free broad-spectrum sunscreen for sensitive and acne-prone skin",
        size: "1.7 oz",
        sku: "ELT-UVC-48",
        upc: "390205024001",
        category: "Skincare",
        retailPrice: 39,
        wholesaleCost: 19.5,
        vendor: "EltaMD",
        inventoryCount: 24,
        taxable: true,
      },
    }),
    prisma.product.create({
      data: {
        clinicId: clinic.id,
        name: "Revision Skincare Nectifirm",
        description: "Neck firming cream with plant extracts and peptides",
        size: "1.7 oz",
        sku: "REV-NCT-48",
        upc: "877180001234",
        category: "Skincare",
        retailPrice: 98,
        wholesaleCost: 49,
        vendor: "Revision Skincare",
        inventoryCount: 8,
        taxable: true,
      },
    }),
    prisma.product.create({
      data: {
        clinicId: clinic.id,
        name: "Alastin Regenerating Skin Nectar",
        description: "Post-procedure healing serum with TriHex Technology",
        size: "1.0 oz",
        sku: "ALA-RSN-30",
        upc: "850004009123",
        category: "Skincare",
        retailPrice: 195,
        wholesaleCost: 97.5,
        vendor: "Alastin Skincare",
        inventoryCount: 6,
        taxable: true,
      },
    }),
    prisma.product.create({
      data: {
        clinicId: clinic.id,
        name: "iS Clinical Active Serum",
        description: "Botanical anti-aging serum for all skin types",
        size: "1.0 oz",
        sku: "ISC-ACT-30",
        upc: "817244010012",
        category: "Skincare",
        retailPrice: 138,
        wholesaleCost: 69,
        vendor: "iS Clinical",
        inventoryCount: 10,
        taxable: true,
      },
    }),
    prisma.product.create({
      data: {
        clinicId: clinic.id,
        name: "SkinMedica TNS Advanced+ Serum",
        description: "Growth factor serum for fine lines and wrinkles",
        size: "1.0 oz",
        sku: "SKM-TNS-30",
        upc: "895439002345",
        category: "Skincare",
        retailPrice: 295,
        wholesaleCost: 147.5,
        vendor: "SkinMedica",
        inventoryCount: 4,
        taxable: true,
      },
    }),
  ]);
  console.log(`Created ${products.length} products`);

  // ===========================================
  // PATIENTS
  // ===========================================
  const patients = await Promise.all([
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Jennifer",
        lastName: "Williams",
        email: "jennifer.williams@email.com",
        phone: "(555) 234-5678",
        dateOfBirth: new Date("1985-03-15"),
        gender: "Female",
        address: "456 Oak Street",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        allergies: "Lidocaine",
        medicalNotes: "Previous rhinoplasty 2019. No complications.",
        tags: "VIP,Regular",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Michael",
        lastName: "Johnson",
        email: "m.johnson@email.com",
        phone: "(555) 345-6789",
        dateOfBirth: new Date("1978-07-22"),
        gender: "Male",
        address: "789 Pine Avenue",
        city: "Springfield",
        state: "IL",
        zipCode: "62702",
        allergies: null,
        medicalNotes: "Interested in preventative treatments.",
        tags: "New",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Lisa",
        lastName: "Chen",
        email: "lisa.chen@email.com",
        phone: "(555) 456-7890",
        dateOfBirth: new Date("1990-11-08"),
        gender: "Female",
        address: "321 Elm Road",
        city: "Springfield",
        state: "IL",
        zipCode: "62703",
        allergies: "Aspirin, Ibuprofen",
        medicalNotes: "Monthly Botox maintenance. Sensitive skin.",
        tags: "Regular,Membership",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "David",
        lastName: "Martinez",
        email: "david.m@email.com",
        phone: "(555) 567-8901",
        dateOfBirth: new Date("1982-05-30"),
        gender: "Male",
        address: "654 Maple Drive",
        city: "Springfield",
        state: "IL",
        zipCode: "62704",
        allergies: null,
        medicalNotes: "First time receiving injectables.",
        tags: "New",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Amanda",
        lastName: "Taylor",
        email: "amanda.t@email.com",
        phone: "(555) 678-9012",
        dateOfBirth: new Date("1975-09-14"),
        gender: "Female",
        address: "987 Cedar Lane",
        city: "Springfield",
        state: "IL",
        zipCode: "62705",
        allergies: "Latex",
        medicalNotes: "Regular client since 2020. Full face treatment plan.",
        tags: "VIP,Regular,Membership",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Sarah",
        lastName: "Kim",
        email: "sarah.kim@email.com",
        phone: "(555) 111-2233",
        dateOfBirth: new Date("1993-03-22"),
        gender: "Female",
        tags: "Regular",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Robert",
        lastName: "Davis",
        email: "r.davis@email.com",
        phone: "(555) 222-3344",
        dateOfBirth: new Date("1980-07-11"),
        gender: "Male",
        tags: "Membership",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Emily",
        lastName: "Nguyen",
        email: "emily.nguyen@email.com",
        phone: "(555) 333-4455",
        dateOfBirth: new Date("1988-12-05"),
        gender: "Female",
        tags: "VIP,Membership",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "James",
        lastName: "Wilson",
        email: "j.wilson@email.com",
        phone: "(555) 444-5566",
        dateOfBirth: new Date("1972-01-30"),
        gender: "Male",
        tags: "Regular",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Maria",
        lastName: "Garcia",
        email: "maria.g@email.com",
        phone: "(555) 555-6677",
        dateOfBirth: new Date("1995-06-18"),
        gender: "Female",
        tags: "Membership",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Kevin",
        lastName: "Brown",
        email: "kevin.b@email.com",
        phone: "(555) 666-7788",
        dateOfBirth: new Date("1985-10-25"),
        gender: "Male",
        tags: "Regular,Membership",
      },
    }),
    prisma.patient.create({
      data: {
        clinicId: clinic.id,
        firstName: "Rachel",
        lastName: "Patel",
        email: "rachel.p@email.com",
        phone: "(555) 777-8899",
        dateOfBirth: new Date("1990-04-08"),
        gender: "Female",
        tags: "VIP,Membership",
      },
    }),
  ]);
  console.log(`Created ${patients.length} patients`);

  // ===========================================
  // CONSENT TEMPLATES
  // ===========================================
  const consentTemplates = await Promise.all([
    prisma.consentTemplate.create({
      data: {
        clinicId: clinic.id,
        name: "Botox Treatment Consent",
        content: `# Botox Treatment Consent Form

## Procedure
I understand that Botulinum Toxin (Botox) will be injected into my facial muscles to temporarily improve the appearance of moderate to severe lines.

## Risks and Side Effects
I understand that possible side effects include but are not limited to:
- Temporary bruising, swelling, or redness at injection sites
- Headache
- Flu-like symptoms
- Temporary eyelid droop
- Allergic reaction

## Expectations
I understand that results are temporary and typically last 3-4 months.

## Consent
By signing below, I confirm that I have read and understood this consent form and agree to proceed with treatment.`,
        version: "1.0",
      },
    }),
    prisma.consentTemplate.create({
      data: {
        clinicId: clinic.id,
        name: "Dermal Filler Consent",
        content: `# Dermal Filler Treatment Consent Form

## Procedure
I understand that hyaluronic acid dermal fillers will be injected to add volume and reduce the appearance of wrinkles and folds.

## Risks and Side Effects
I understand that possible side effects include but are not limited to:
- Bruising, swelling, redness, pain, or tenderness at injection sites
- Lumps or bumps
- Asymmetry
- Infection
- Vascular occlusion (rare but serious)

## Expectations
I understand that results are temporary and typically last 6-18 months depending on the product used.

## Consent
By signing below, I confirm that I have read and understood this consent form and agree to proceed with treatment.`,
        version: "1.0",
      },
    }),
    prisma.consentTemplate.create({
      data: {
        clinicId: clinic.id,
        name: "General Treatment Consent",
        content: `# General Treatment Consent Form

I hereby consent to the cosmetic procedure(s) discussed with my provider today.

I understand the nature of the procedure, its risks, benefits, and alternatives. I have had the opportunity to ask questions and all my questions have been answered to my satisfaction.

By signing below, I confirm my consent to proceed with treatment.`,
        version: "1.0",
      },
    }),
  ]);
  console.log(`Created ${consentTemplates.length} consent templates`);

  // ===========================================
  // CHART TEMPLATES
  // ===========================================
  const chartTemplates = await Promise.all([
    prisma.chartTemplate.create({
      data: {
        clinicId: clinic.id,
        type: "chart",
        name: "Patient Treatment Chart",
        description: "Advanced treatment record",
        category: "Injectables",
        isSystem: true,
        fieldsConfig: JSON.stringify([
          { key: "medication", label: "Medication", type: "textarea", placeholder: "List current medications" },
          { key: "allergies", label: "Allergies", type: "text", required: true, placeholder: "List known allergies" },
          { key: "medical_history", label: "Current and Past Medical History", type: "textarea", placeholder: "Relevant medical history" },

          { key: "treatment_heading", label: "Treatment Details", type: "heading" },
          { key: "treatment_notes", label: "Treatment Notes", type: "textarea", placeholder: "Describe the treatment performed" },
          { key: "treatment_checklist", label: "Treatment Checklist", type: "checklist", options: [
            "Skin prepped and cleansed with chlorhexidine and alcohol",
            "Pre and post care instructions given",
            "No contraindications noted",
          ]},

          { key: "other_heading", label: "Other", type: "heading" },
          { key: "skin_type", label: "Skin Type", type: "select", options: ["Type I", "Type II", "Type III", "Type IV", "Type V", "Type VI"] },
          { key: "local_anesthesia", label: "Local Anesthesia", type: "select", options: [
            "BTL cream 20/10/10",
            "Lidocaine cream 10%",
            "Dental block with Lidocaine 2%",
            "Facial block with 5ml 2% lidocaine and 1ml Bicarb",
            "23% Lidocaine and tetracaine 7%",
            "None",
          ]},

          { key: "photos_heading", label: "Photos", type: "heading" },
          { key: "photos_front", label: "Front", type: "photo-pair", photoLabels: ["Before Photo", "After Photo"] },
          { key: "photos_left", label: "Left Profile", type: "photo-pair", photoLabels: ["Before Left Profile", "Post Left Profile"] },
          { key: "photos_right", label: "Right Profile", type: "photo-pair", photoLabels: ["Before Right Profile", "Post Right Profile"] },
          { key: "photos_body", label: "Body", type: "photo-pair", photoLabels: ["Before Body Photo", "After Body Photo"] },

          { key: "mapping_heading", label: "Mapping", type: "heading" },
          { key: "mapping_photo", label: "Mapping", type: "photo-single" },

          { key: "signatures_heading", label: "Signatures", type: "heading" },
          { key: "provider_signature", label: "Signature", type: "signature", required: true },
          { key: "treatment_date", label: "Treatment Date", type: "date", required: true },
          { key: "md_signature", label: "Medical Director Signature", type: "signature" },
        ]),
      },
    }),
    prisma.chartTemplate.create({
      data: {
        clinicId: clinic.id,
        type: "chart",
        name: "Neurotoxin Treatment",
        description: "Botox and neurotoxin injection record",
        category: "Injectables",
        isSystem: true,
        fieldsConfig: JSON.stringify([
          { key: "allergies", label: "Allergies", type: "text", required: true },
          { key: "areas", label: "Treatment Areas", type: "json-areas", required: true, options: ["Forehead", "Glabella", "Crow's Feet", "Bunny Lines", "Lip Flip", "Masseter", "Platysma Bands", "Hyperhidrosis"] },
          { key: "products", label: "Products Used", type: "json-products", required: true },
          { key: "total_units", label: "Total Units", type: "number", required: true, placeholder: "e.g. 40" },
          { key: "technique", label: "Injection Technique", type: "select", options: ["Standard", "Micro-Botox", "Deep Injection", "Intradermal"] },
          { key: "treatment_checklist", label: "Treatment Checklist", type: "checklist", options: [
            "Skin prepped and cleansed",
            "Pre and post care instructions given",
            "No contraindications noted",
            "Ice applied post treatment",
          ]},
          { key: "photos_front", label: "Front", type: "photo-pair", photoLabels: ["Before Photo", "After Photo"] },
          { key: "mapping", label: "Injection Mapping", type: "photo-single" },
          { key: "aftercare", label: "Aftercare Instructions", type: "textarea", defaultValue: "Avoid lying down for 4 hours. No strenuous exercise for 24 hours. Do not massage treated areas." },
          { key: "provider_signature", label: "Provider Signature", type: "signature", required: true },
          { key: "treatment_date", label: "Treatment Date", type: "date", required: true },
        ]),
      },
    }),
    prisma.chartTemplate.create({
      data: {
        clinicId: clinic.id,
        type: "form",
        name: "Patient Intake Form",
        description: "New patient intake questionnaire",
        category: "Forms",
        isSystem: true,
        fieldsConfig: JSON.stringify([
          { key: "reason_for_visit", label: "Reason for Visit", type: "textarea", required: true, placeholder: "What brings you in today?" },
          { key: "medications", label: "Current Medications", type: "textarea", placeholder: "List all current medications" },
          { key: "allergies", label: "Allergies", type: "text", required: true, placeholder: "List known allergies or write None" },
          { key: "medical_conditions", label: "Medical Conditions", type: "checklist", options: [
            "Diabetes",
            "High blood pressure",
            "Heart disease",
            "Autoimmune disorder",
            "Bleeding disorder",
            "Pregnancy or breastfeeding",
            "History of keloid scarring",
            "None of the above",
          ]},
          { key: "previous_treatments", label: "Previous Aesthetic Treatments", type: "textarea", placeholder: "List any previous cosmetic procedures" },
          { key: "patient_signature", label: "Patient Signature", type: "signature", required: true },
          { key: "date", label: "Date", type: "date", required: true },
        ]),
      },
    }),
  ]);
  console.log(`Created ${chartTemplates.length} chart templates`);

  // ===========================================
  // MEMBERSHIP PLANS
  // ===========================================
  const membershipPlans = await Promise.all([
    prisma.membershipPlan.create({
      data: {
        clinicId: clinic.id,
        name: "Silver",
        description: "Essential treatments and basic skincare",
        price: 50,
        billingCycle: "Monthly",
      },
    }),
    prisma.membershipPlan.create({
      data: {
        clinicId: clinic.id,
        name: "Gold",
        description: "Advanced treatments with priority booking",
        price: 100,
        billingCycle: "Monthly",
      },
    }),
    prisma.membershipPlan.create({
      data: {
        clinicId: clinic.id,
        name: "Platinum",
        description: "All-inclusive premium care with VIP perks",
        price: 200,
        billingCycle: "Monthly",
      },
    }),
  ]);
  console.log(`Created ${membershipPlans.length} membership plans`);

  // ===========================================
  // APPOINTMENTS — anchored to demo week Feb 16–20, 2026
  // ===========================================
  // Fixed dates for reproducible demo data
  const monday    = new Date("2026-02-16T00:00:00");
  const tuesday   = new Date("2026-02-17T00:00:00");
  const wednesday = new Date("2026-02-18T00:00:00"); // "today"
  const thursday  = new Date("2026-02-19T00:00:00");
  const friday    = new Date("2026-02-20T00:00:00");

  // Keep these aliases for backward-compat in memberships/comms sections
  const today = wednesday;
  const yesterday = tuesday;

  // Helper to create appointment times
  const setTime = (date: Date, hours: number, minutes: number): Date => {
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  // Patient index reference:
  // 0=Jennifer Williams, 1=Michael Johnson, 2=Lisa Chen, 3=David Martinez,
  // 4=Amanda Taylor, 5=Sarah Kim, 6=Robert Davis, 7=Emily Nguyen,
  // 8=James Wilson, 9=Maria Garcia, 10=Kevin Brown, 11=Rachel Patel

  // Service index reference:
  // 0=Botox Forehead, 1=Botox Crow's Feet, 2=Botox Glabella, 3=Juvederm Lips,
  // 4=Juvederm Voluma Cheeks, 5=Sculptra, 6=Chemical Peel, 7=Microneedling,
  // 8=IPL Photofacial, 9=Laser Hair Removal, 10=Consultation, 11=Follow-Up

  const appointments = await Promise.all([
    // ── MONDAY Feb 16 (past — all completed+checked out) ──
    // [0] Jennifer Williams / Botox Forehead / provider1 (NP) → Completed+CheckedOut
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[0].id,
        providerId: provider1.id,
        serviceId: services[0].id,
        roomId: rooms[0].id,
        startTime: setTime(monday, 9, 0),
        endTime: setTime(monday, 9, 30),
        status: "Completed",
        notes: "Patient tolerated procedure well. 20 units forehead.",
        checkedInAt: setTime(monday, 8, 50),
        startedAt: setTime(monday, 9, 2),
        completedAt: setTime(monday, 9, 28),
        checkedOutAt: setTime(monday, 9, 35),
      },
    }),
    // [1] Lisa Chen / Juvederm Lips / provider2 → Completed+CheckedOut
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[2].id,
        providerId: provider2.id,
        serviceId: services[3].id,
        roomId: rooms[1].id,
        startTime: setTime(monday, 10, 30),
        endTime: setTime(monday, 11, 15),
        status: "Completed",
        notes: "1 syringe Juvederm Ultra XC. Patient happy with results.",
        checkedInAt: setTime(monday, 10, 20),
        startedAt: setTime(monday, 10, 32),
        completedAt: setTime(monday, 11, 10),
        checkedOutAt: setTime(monday, 11, 18),
      },
    }),
    // [2] Amanda Taylor / Sculptra / provider2 → Completed+CheckedOut
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[4].id,
        providerId: provider2.id,
        serviceId: services[5].id,
        roomId: rooms[1].id,
        startTime: setTime(monday, 14, 0),
        endTime: setTime(monday, 15, 0),
        status: "Completed",
        notes: "Full face Sculptra session 2 of 3",
        checkedInAt: setTime(monday, 13, 50),
        startedAt: setTime(monday, 14, 5),
        completedAt: setTime(monday, 14, 55),
        checkedOutAt: setTime(monday, 15, 5),
      },
    }),

    // ── TUESDAY Feb 17 (yesterday — mix of completed and pending review) ──
    // [3] Michael Johnson / Botox Forehead / provider1 (NP) → Completed (pending MD review)
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[1].id,
        providerId: provider1.id,
        serviceId: services[0].id,
        roomId: rooms[0].id,
        startTime: setTime(tuesday, 9, 0),
        endTime: setTime(tuesday, 9, 30),
        status: "Completed",
        notes: "First time Botox patient. 20 units forehead.",
        checkedInAt: setTime(tuesday, 8, 50),
        startedAt: setTime(tuesday, 9, 2),
        completedAt: setTime(tuesday, 9, 28),
      },
    }),
    // [4] David Martinez / Microneedling / provider2 → Completed+CheckedOut
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[3].id,
        providerId: provider2.id,
        serviceId: services[7].id,
        roomId: rooms[1].id,
        startTime: setTime(tuesday, 11, 0),
        endTime: setTime(tuesday, 12, 0),
        status: "Completed",
        notes: "Full face microneedling. Good tolerance.",
        checkedInAt: setTime(tuesday, 10, 50),
        startedAt: setTime(tuesday, 11, 5),
        completedAt: setTime(tuesday, 11, 55),
        checkedOutAt: setTime(tuesday, 12, 5),
      },
    }),
    // [5] Amanda Taylor / Juvederm Voluma Cheeks / provider1 (NP) → Completed (pending MD review)
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[4].id,
        providerId: provider1.id,
        serviceId: services[4].id,
        roomId: rooms[0].id,
        startTime: setTime(tuesday, 14, 0),
        endTime: setTime(tuesday, 14, 45),
        status: "Completed",
        notes: "Cheek volume restoration. 1 syringe Voluma per side.",
        checkedInAt: setTime(tuesday, 13, 50),
        startedAt: setTime(tuesday, 14, 5),
        completedAt: setTime(tuesday, 14, 42),
      },
    }),

    // ── WEDNESDAY Feb 18 (today — full journey coverage) ──
    // [6] Robert Davis / Chemical Peel / provider1 → Completed+CheckedOut (done early)
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[6].id,
        providerId: provider1.id,
        serviceId: services[6].id,
        roomId: rooms[0].id,
        startTime: setTime(wednesday, 8, 0),
        endTime: setTime(wednesday, 8, 30),
        status: "Completed",
        notes: "Light peel completed, good tolerance",
        checkedInAt: setTime(wednesday, 7, 50),
        startedAt: setTime(wednesday, 8, 2),
        completedAt: setTime(wednesday, 8, 28),
        checkedOutAt: setTime(wednesday, 8, 35),
      },
    }),
    // [7] Emily Nguyen / Follow-Up / provider2 → Completed+CheckedOut (done early)
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[7].id,
        providerId: provider2.id,
        serviceId: services[11].id,
        roomId: rooms[2].id,
        startTime: setTime(wednesday, 8, 30),
        endTime: setTime(wednesday, 8, 45),
        status: "Completed",
        notes: "2-week follow-up, healing well",
        checkedInAt: setTime(wednesday, 8, 22),
        startedAt: setTime(wednesday, 8, 30),
        completedAt: setTime(wednesday, 8, 42),
        checkedOutAt: setTime(wednesday, 8, 48),
      },
    }),
    // [8] Sarah Kim / Botox Crow's Feet / provider1 (NP) → InProgress
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[5].id,
        providerId: provider1.id,
        serviceId: services[1].id,
        roomId: rooms[0].id,
        startTime: setTime(wednesday, 9, 0),
        endTime: setTime(wednesday, 9, 20),
        status: "InProgress",
        notes: "Crow's feet treatment",
        checkedInAt: setTime(wednesday, 8, 50),
        startedAt: setTime(wednesday, 9, 2),
      },
    }),
    // [9] Kevin Brown / IPL Photofacial / provider2 → InProgress
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[10].id,
        providerId: provider2.id,
        serviceId: services[8].id,
        roomId: rooms[1].id,
        startTime: setTime(wednesday, 9, 30),
        endTime: setTime(wednesday, 10, 15),
        status: "InProgress",
        notes: "Sun damage treatment",
        checkedInAt: setTime(wednesday, 9, 20),
        startedAt: setTime(wednesday, 9, 32),
      },
    }),
    // [10] Maria Garcia / Chemical Peel / provider1 → CheckedIn
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[9].id,
        providerId: provider1.id,
        serviceId: services[6].id,
        roomId: rooms[2].id,
        startTime: setTime(wednesday, 10, 0),
        endTime: setTime(wednesday, 10, 30),
        status: "CheckedIn",
        notes: "Light glycolic peel",
        checkedInAt: setTime(wednesday, 9, 50),
      },
    }),
    // [11] James Wilson / Laser Hair Removal / provider2 → CheckedIn
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[8].id,
        providerId: provider2.id,
        serviceId: services[9].id,
        roomId: rooms[1].id,
        startTime: setTime(wednesday, 10, 0),
        endTime: setTime(wednesday, 10, 30),
        status: "CheckedIn",
        notes: "Upper lip and chin hair removal",
        checkedInAt: setTime(wednesday, 9, 52),
      },
    }),
    // [12] Jennifer Williams / Botox Glabella / provider1 (NP) → Confirmed
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[0].id,
        providerId: provider1.id,
        serviceId: services[2].id,
        roomId: rooms[0].id,
        startTime: setTime(wednesday, 11, 0),
        endTime: setTime(wednesday, 11, 20),
        status: "Confirmed",
      },
    }),
    // [13] Rachel Patel / IPL Photofacial / provider2 → Confirmed
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[11].id,
        providerId: provider2.id,
        serviceId: services[8].id,
        roomId: rooms[1].id,
        startTime: setTime(wednesday, 11, 30),
        endTime: setTime(wednesday, 12, 15),
        status: "Confirmed",
      },
    }),
    // [14] Lisa Chen / Follow-Up / provider1 → Scheduled
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[2].id,
        providerId: provider1.id,
        serviceId: services[11].id,
        roomId: rooms[2].id,
        startTime: setTime(wednesday, 14, 0),
        endTime: setTime(wednesday, 14, 15),
        status: "Scheduled",
      },
    }),
    // [15] Michael Johnson / Consultation / provider2 → Scheduled
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[1].id,
        providerId: provider2.id,
        serviceId: services[10].id,
        roomId: rooms[2].id,
        startTime: setTime(wednesday, 14, 30),
        endTime: setTime(wednesday, 15, 0),
        status: "Scheduled",
      },
    }),
    // [16] David Martinez / Juvederm Lips / provider1 (NP) → Scheduled
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[3].id,
        providerId: provider1.id,
        serviceId: services[3].id,
        roomId: rooms[0].id,
        startTime: setTime(wednesday, 15, 0),
        endTime: setTime(wednesday, 15, 45),
        status: "Scheduled",
      },
    }),

    // ── THURSDAY Feb 19 ──
    // [17] Amanda Taylor / Botox Forehead / provider1 (NP) → Scheduled
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[4].id,
        providerId: provider1.id,
        serviceId: services[0].id,
        roomId: rooms[0].id,
        startTime: setTime(thursday, 9, 0),
        endTime: setTime(thursday, 9, 30),
        status: "Scheduled",
      },
    }),
    // [18] Emily Nguyen / Microneedling / provider2 → Scheduled
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[7].id,
        providerId: provider2.id,
        serviceId: services[7].id,
        roomId: rooms[1].id,
        startTime: setTime(thursday, 10, 0),
        endTime: setTime(thursday, 11, 0),
        status: "Scheduled",
      },
    }),
    // [19] Sarah Kim / Juvederm Voluma / provider1 → Scheduled
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[5].id,
        providerId: provider1.id,
        serviceId: services[4].id,
        roomId: rooms[0].id,
        startTime: setTime(thursday, 14, 0),
        endTime: setTime(thursday, 14, 45),
        status: "Scheduled",
      },
    }),

    // ── FRIDAY Feb 20 ──
    // [20] Robert Davis / Botox Crow's Feet / provider2 → Scheduled
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[6].id,
        providerId: provider2.id,
        serviceId: services[1].id,
        roomId: rooms[1].id,
        startTime: setTime(friday, 9, 0),
        endTime: setTime(friday, 9, 20),
        status: "Scheduled",
      },
    }),
    // [21] Kevin Brown / Consultation / provider1 → Scheduled
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[10].id,
        providerId: provider1.id,
        serviceId: services[10].id,
        roomId: rooms[2].id,
        startTime: setTime(friday, 11, 0),
        endTime: setTime(friday, 11, 30),
        status: "Scheduled",
      },
    }),
  ]);
  console.log(`Created ${appointments.length} appointments`);

  // ===========================================
  // ENCOUNTERS & CHARTS — lifecycle states for demo week
  // ===========================================

  // ── MONDAY: All finalized with MD sign-off ──

  // Encounter Mon-1: Jennifer W / Botox Forehead / NP → Finalized, MDSigned (co-signed)
  const encounterMon1 = await prisma.encounter.create({
    data: {
      appointmentId: appointments[0].id,
      clinicId: clinic.id,
      patientId: patients[0].id,
      providerId: provider1.id,
      status: "Finalized",
      requiresSupervision: true,
      finalizedAt: setTime(monday, 16, 0),
    },
  });
  const chartMon1 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      encounterId: encounterMon1.id,
      patientId: patients[0].id,
      appointmentId: appointments[0].id,
      createdById: provider1.id,
      status: "MDSigned",
      chiefComplaint: "Forehead lines and wrinkles",
      areasTreated: JSON.stringify(["Forehead"]),
      productsUsed: JSON.stringify([{ name: "Botox", lot: "C3456A", expiration: "2026-06-15", units: 20 }]),
      dosageUnits: "20 units",
      technique: "Standard injection technique, 5 injection points across forehead",
      aftercareNotes: "Avoid lying down for 4 hours. No strenuous exercise for 24 hours.",
      additionalNotes: "Patient tolerated well. No immediate adverse reactions.",
      providerSignedAt: setTime(monday, 9, 30),
      providerSignedById: provider1.id,
      signedById: medicalDirector.id,
      signedByName: medicalDirector.name,
      signedAt: setTime(monday, 16, 0),
      recordHash: "sha256:mon1_cosigned_hash_demo",
    },
  });
  await prisma.treatmentCard.create({
    data: {
      chartId: chartMon1.id,
      templateType: "Injectable",
      title: "Injectable",
      narrativeText: "Botox 20 units to forehead. 5 injection points evenly distributed. No adverse reactions.",
      structuredData: JSON.stringify({
        productName: "Botox",
        areas: ["Forehead"],
        totalUnits: 20,
        lotEntries: [{ lot: "C3456A", expiration: "2026-06-15", units: 20 }],
        outcome: "Patient tolerated well",
        followUpPlan: "Return in 3-4 months",
        aftercare: "Avoid lying down for 4 hours. No strenuous exercise for 24 hours.",
      }),
      sortOrder: 0,
    },
  });

  // Encounter Mon-2: Lisa C / Juvederm Lips / provider2 → Finalized, MDSigned (direct)
  const encounterMon2 = await prisma.encounter.create({
    data: {
      appointmentId: appointments[1].id,
      clinicId: clinic.id,
      patientId: patients[2].id,
      providerId: provider2.id,
      status: "Finalized",
      finalizedAt: setTime(monday, 16, 30),
    },
  });
  const chartMon2 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      encounterId: encounterMon2.id,
      patientId: patients[2].id,
      appointmentId: appointments[1].id,
      createdById: provider2.id,
      status: "MDSigned",
      chiefComplaint: "Lip enhancement - desires fuller lips",
      areasTreated: JSON.stringify(["Upper lip", "Lower lip", "Vermillion border"]),
      productsUsed: JSON.stringify([{ name: "Juvederm Ultra XC", lot: "J7890B", expiration: "2026-08-20", syringes: 1 }]),
      dosageUnits: "1 syringe (1.0mL)",
      technique: "Serial puncture and linear threading technique",
      aftercareNotes: "Ice as needed. Avoid hot beverages for 24 hours. Arnica gel recommended.",
      additionalNotes: "Achieved natural enhancement per patient preference. Symmetry achieved.",
      signedById: provider2.id,
      signedByName: provider2.name,
      signedAt: setTime(monday, 16, 30),
      recordHash: "sha256:mon2_direct_hash_demo",
    },
  });
  await prisma.treatmentCard.create({
    data: {
      chartId: chartMon2.id,
      templateType: "Injectable",
      title: "Injectable",
      narrativeText: "Juvederm Ultra XC 1 syringe to lips. Serial puncture and linear threading. Natural enhancement achieved.",
      structuredData: JSON.stringify({
        productName: "Juvederm Ultra XC",
        areas: ["Upper lip", "Lower lip", "Vermillion border"],
        totalUnits: 0,
        lotEntries: [{ lot: "J7890B", expiration: "2026-08-20", syringes: 1 }],
        outcome: "Natural enhancement, good symmetry",
        followUpPlan: "Return in 2 weeks for follow-up",
        aftercare: "Ice as needed. Avoid hot beverages for 24 hours.",
      }),
      sortOrder: 0,
    },
  });

  // Encounter Mon-3: Amanda T / Sculptra / provider2 → Finalized, MDSigned (direct)
  const encounterMon3 = await prisma.encounter.create({
    data: {
      appointmentId: appointments[2].id,
      clinicId: clinic.id,
      patientId: patients[4].id,
      providerId: provider2.id,
      status: "Finalized",
      finalizedAt: setTime(monday, 17, 0),
    },
  });
  const chartMon3 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      encounterId: encounterMon3.id,
      patientId: patients[4].id,
      appointmentId: appointments[2].id,
      createdById: provider2.id,
      status: "MDSigned",
      chiefComplaint: "Volume loss in cheeks and temples - session 2 of 3",
      areasTreated: JSON.stringify(["Cheeks", "Temples", "Jawline"]),
      productsUsed: JSON.stringify([{ name: "Sculptra", lot: "S2345C", expiration: "2026-12-01", vials: 2 }]),
      dosageUnits: "2 vials reconstituted with 8mL sterile water each",
      technique: "Deep dermal/subcutaneous injection with fanning technique",
      aftercareNotes: "Massage treated areas 5 minutes, 5 times daily for 5 days. Follow-up in 6 weeks.",
      additionalNotes: "Good volume distribution achieved. Schedule session 3 in 6 weeks.",
      signedById: provider2.id,
      signedByName: provider2.name,
      signedAt: setTime(monday, 17, 0),
      recordHash: "sha256:mon3_direct_hash_demo",
    },
  });
  await prisma.treatmentCard.create({
    data: {
      chartId: chartMon3.id,
      templateType: "Injectable",
      title: "Injectable",
      narrativeText: "Sculptra 2 vials. Deep dermal/subcutaneous fanning technique to cheeks, temples, jawline.",
      structuredData: JSON.stringify({
        productName: "Sculptra",
        areas: ["Cheeks", "Temples", "Jawline"],
        totalUnits: 0,
        lotEntries: [{ lot: "S2345C", expiration: "2026-12-01", vials: 2 }],
        outcome: "Good volume distribution",
        followUpPlan: "Session 3 in 6 weeks",
        aftercare: "Massage 5 min, 5x daily for 5 days",
      }),
      sortOrder: 0,
    },
  });

  // ── TUESDAY: Mix of pending review and finalized ──

  // Encounter Tue-1: Michael J / Botox Forehead / NP → PendingReview (MD Review queue)
  const encounterTue1 = await prisma.encounter.create({
    data: {
      appointmentId: appointments[3].id,
      clinicId: clinic.id,
      patientId: patients[1].id,
      providerId: provider1.id,
      status: "PendingReview",
      requiresSupervision: true,
    },
  });
  const chartTue1 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      encounterId: encounterTue1.id,
      patientId: patients[1].id,
      appointmentId: appointments[3].id,
      createdById: provider1.id,
      status: "NeedsSignOff",
      chiefComplaint: "Forehead lines - first time Botox",
      areasTreated: JSON.stringify(["Forehead"]),
      productsUsed: JSON.stringify([{ name: "Botox", lot: "C3456A", expiration: "2026-06-15", units: 20 }]),
      dosageUnits: "20 units",
      technique: "Standard injection technique, 5 points across forehead",
      aftercareNotes: "Avoid lying down for 4 hours. No exercise for 24 hours.",
      additionalNotes: "First time patient. Tolerated well. Discussed expectations.",
      providerSignedAt: setTime(tuesday, 9, 30),
      providerSignedById: provider1.id,
    },
  });
  await prisma.treatmentCard.create({
    data: {
      chartId: chartTue1.id,
      templateType: "Injectable",
      title: "Injectable",
      narrativeText: "Botox 20 units to forehead. First time patient, tolerated well.",
      structuredData: JSON.stringify({
        productName: "Botox",
        areas: ["Forehead"],
        totalUnits: 20,
        lotEntries: [{ lot: "C3456A", expiration: "2026-06-15", units: 20 }],
        outcome: "Tolerated well, no adverse reactions",
        followUpPlan: "Return in 2 weeks for follow-up, then 3-4 months",
        aftercare: "Avoid lying down for 4 hours. No exercise for 24 hours.",
      }),
      sortOrder: 0,
    },
  });

  // Encounter Tue-2: David M / Microneedling / provider2 → Finalized, MDSigned (direct)
  const encounterTue2 = await prisma.encounter.create({
    data: {
      appointmentId: appointments[4].id,
      clinicId: clinic.id,
      patientId: patients[3].id,
      providerId: provider2.id,
      status: "Finalized",
      finalizedAt: setTime(tuesday, 16, 0),
    },
  });
  const chartTue2 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      encounterId: encounterTue2.id,
      patientId: patients[3].id,
      appointmentId: appointments[4].id,
      createdById: provider2.id,
      status: "MDSigned",
      chiefComplaint: "Skin texture improvement - microneedling",
      areasTreated: JSON.stringify(["Full face"]),
      productsUsed: JSON.stringify([{ name: "Hyaluronic acid serum", lot: "HA-2026-01" }]),
      dosageUnits: "N/A",
      technique: "1.5mm depth, cross-hatch pattern",
      aftercareNotes: "Avoid sun exposure for 48 hours. Use gentle cleanser only.",
      additionalNotes: "Good skin response. Mild erythema expected 24-48 hours.",
      signedById: provider2.id,
      signedByName: provider2.name,
      signedAt: setTime(tuesday, 16, 0),
      recordHash: "sha256:tue2_direct_hash_demo",
    },
  });
  await prisma.treatmentCard.create({
    data: {
      chartId: chartTue2.id,
      templateType: "Esthetics",
      title: "Esthetics",
      narrativeText: "Full face microneedling at 1.5mm depth. HA serum applied. Good skin response.",
      structuredData: JSON.stringify({
        areasTreated: "Full face",
        productsUsed: "Hyaluronic acid serum",
        skinResponse: "Mild erythema, expected to resolve 24-48 hours",
        outcome: "Good treatment response",
        aftercare: "Avoid sun 48 hours. Gentle cleanser only.",
      }),
      sortOrder: 0,
    },
  });

  // Encounter Tue-3: Amanda T / Juvederm Voluma Cheeks / NP → PendingReview (MD Review queue)
  const encounterTue3 = await prisma.encounter.create({
    data: {
      appointmentId: appointments[5].id,
      clinicId: clinic.id,
      patientId: patients[4].id,
      providerId: provider1.id,
      status: "PendingReview",
      requiresSupervision: true,
    },
  });
  const chartTue3 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      encounterId: encounterTue3.id,
      patientId: patients[4].id,
      appointmentId: appointments[5].id,
      createdById: provider1.id,
      status: "NeedsSignOff",
      chiefComplaint: "Cheek volume restoration",
      areasTreated: JSON.stringify(["Right cheek", "Left cheek"]),
      productsUsed: JSON.stringify([{ name: "Juvederm Voluma XC", lot: "V4567D", expiration: "2026-10-15", syringes: 2 }]),
      dosageUnits: "2 syringes (2.0mL total)",
      technique: "Deep injection with fanning technique, supraperiosteal plane",
      aftercareNotes: "Ice 10 minutes every hour for first 4 hours. Avoid strenuous activity 24 hours.",
      additionalNotes: "Excellent cheek projection achieved. Symmetry verified.",
      providerSignedAt: setTime(tuesday, 14, 45),
      providerSignedById: provider1.id,
    },
  });
  await prisma.treatmentCard.create({
    data: {
      chartId: chartTue3.id,
      templateType: "Injectable",
      title: "Injectable",
      narrativeText: "Juvederm Voluma XC 2 syringes to cheeks. Deep fanning technique. Excellent projection.",
      structuredData: JSON.stringify({
        productName: "Juvederm Voluma XC",
        areas: ["Right cheek", "Left cheek"],
        totalUnits: 0,
        lotEntries: [{ lot: "V4567D", expiration: "2026-10-15", syringes: 2 }],
        outcome: "Excellent cheek projection, symmetry verified",
        followUpPlan: "Return in 2 weeks for assessment",
        aftercare: "Ice 10 min every hour for 4 hours. No strenuous activity 24 hours.",
      }),
      sortOrder: 0,
    },
  });

  // ── TODAY (Wednesday): Robert D completed, Sarah K & Kevin B in-progress ──

  // Encounter Wed-1: Robert D / Chemical Peel / provider1 → Finalized, MDSigned (done early)
  const encounterWed1 = await prisma.encounter.create({
    data: {
      appointmentId: appointments[6].id,
      clinicId: clinic.id,
      patientId: patients[6].id,
      providerId: provider1.id,
      status: "Finalized",
      finalizedAt: setTime(wednesday, 8, 35),
    },
  });
  const chartWed1 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      encounterId: encounterWed1.id,
      patientId: patients[6].id,
      appointmentId: appointments[6].id,
      createdById: provider1.id,
      status: "MDSigned",
      chiefComplaint: "Light chemical peel for skin rejuvenation",
      areasTreated: JSON.stringify(["Full face"]),
      productsUsed: JSON.stringify([{ name: "Glycolic acid 30%", lot: "GA-2026-02" }]),
      technique: "Even application, 3-minute contact time",
      aftercareNotes: "SPF 50 mandatory. Avoid exfoliants for 7 days.",
      additionalNotes: "Good tolerance. Mild erythema post-peel.",
      signedById: provider1.id,
      signedByName: provider1.name,
      signedAt: setTime(wednesday, 8, 35),
      recordHash: "sha256:wed1_direct_hash_demo",
    },
  });
  await prisma.treatmentCard.create({
    data: {
      chartId: chartWed1.id,
      templateType: "Esthetics",
      title: "Esthetics",
      narrativeText: "Light glycolic peel 30%, 3-minute contact time. Good tolerance.",
      structuredData: JSON.stringify({
        areasTreated: "Full face",
        productsUsed: "Glycolic acid 30%",
        skinResponse: "Mild erythema, good tolerance",
        outcome: "Successful peel",
        aftercare: "SPF 50 mandatory. No exfoliants for 7 days.",
      }),
      sortOrder: 0,
    },
  });

  // Encounter Wed-2: Sarah K / Botox Crow's Feet / NP → Draft (InProgress)
  const encounterWed2 = await prisma.encounter.create({
    data: {
      appointmentId: appointments[8].id,
      clinicId: clinic.id,
      patientId: patients[5].id,
      providerId: provider1.id,
      status: "Draft",
      requiresSupervision: true,
    },
  });
  const chartWed2 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      encounterId: encounterWed2.id,
      patientId: patients[5].id,
      appointmentId: appointments[8].id,
      createdById: provider1.id,
      status: "Draft",
      chiefComplaint: "Crow's feet treatment",
    },
  });
  await prisma.treatmentCard.create({
    data: {
      chartId: chartWed2.id,
      templateType: "Injectable",
      title: "Injectable",
      narrativeText: "",
      structuredData: JSON.stringify({
        productName: "",
        areas: [],
        totalUnits: 0,
        lotEntries: [],
        outcome: "",
        followUpPlan: "",
        aftercare: "",
      }),
      sortOrder: 0,
    },
  });

  // Encounter Wed-3: Kevin B / IPL Photofacial / provider2 → Draft (InProgress)
  const encounterWed3 = await prisma.encounter.create({
    data: {
      appointmentId: appointments[9].id,
      clinicId: clinic.id,
      patientId: patients[10].id,
      providerId: provider2.id,
      status: "Draft",
    },
  });
  const chartWed3 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      encounterId: encounterWed3.id,
      patientId: patients[10].id,
      appointmentId: appointments[9].id,
      createdById: provider2.id,
      status: "Draft",
      chiefComplaint: "IPL for sun damage and redness",
    },
  });
  await prisma.treatmentCard.create({
    data: {
      chartId: chartWed3.id,
      templateType: "Laser",
      title: "Laser",
      narrativeText: "",
      structuredData: JSON.stringify({
        deviceName: "",
        areasTreated: [],
        parameters: { energy: "", passes: 0 },
        outcome: "",
        aftercare: "",
      }),
      sortOrder: 0,
    },
  });

  // Chart: Standalone Draft — Michael J / provider1 (partial injectable card for AI draft testing)
  const chartStandalone = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[1].id,
      createdById: provider1.id,
      status: "Draft",
      chiefComplaint: "Initial consultation for preventative Botox",
      additionalNotes: "Patient interested in starting preventative treatments. Discussed options.",
    },
  });
  await prisma.treatmentCard.create({
    data: {
      chartId: chartStandalone.id,
      templateType: "Injectable",
      title: "Injectable",
      narrativeText: "",
      structuredData: JSON.stringify({
        productName: "Botox",
        areas: [],
        totalUnits: 0,
        lotEntries: [],
        outcome: "",
        followUpPlan: "",
        aftercare: "",
      }),
      sortOrder: 0,
    },
  });

  console.log("Created encounters + charts (3 MDSigned Mon, 1 MDSigned Tue, 2 NeedsSignOff Tue, 1 MDSigned Wed, 2 Draft Wed, 1 standalone Draft)");

  // ===========================================
  // PATIENT CONSENTS
  // ===========================================
  const consents = await Promise.all([
    prisma.patientConsent.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[0].id,
        templateId: consentTemplates[0].id,
        signatureData: "data:image/png;base64,signature_placeholder",
        signedAt: setTime(monday, 8, 45),
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (iPad)",
        templateSnapshot: consentTemplates[0].content,
      },
    }),
    prisma.patientConsent.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[2].id,
        templateId: consentTemplates[1].id,
        signatureData: "data:image/png;base64,signature_placeholder",
        signedAt: setTime(monday, 10, 15),
        ipAddress: "192.168.1.101",
        userAgent: "Mozilla/5.0 (iPhone)",
        templateSnapshot: consentTemplates[1].content,
      },
    }),
    prisma.patientConsent.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[1].id,
        templateId: consentTemplates[0].id,
        signatureData: "data:image/png;base64,signature_placeholder",
        signedAt: setTime(tuesday, 8, 45),
        ipAddress: "192.168.1.102",
        userAgent: "Mozilla/5.0 (iPhone)",
        templateSnapshot: consentTemplates[0].content,
      },
    }),
  ]);
  console.log(`Created ${consents.length} patient consents`);

  // ===========================================
  // INVOICES — This week's appointments + historical
  // ===========================================

  // Monday paid invoices
  await prisma.invoice.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[0].id,
      appointmentId: appointments[0].id,
      invoiceNumber: "INV-2026-0001",
      status: "Paid",
      subtotal: 350,
      discountAmount: 0,
      taxAmount: 0,
      total: 350,
      paidAt: setTime(monday, 9, 35),
      createdAt: setTime(monday, 9, 35),
      items: {
        create: [{ clinicId: clinic.id, serviceId: services[0].id, description: "Botox - Forehead (20 units)", quantity: 1, unitPrice: 350, total: 350 }],
      },
      payments: {
        create: [{ clinicId: clinic.id, amount: 350, paymentMethod: "credit", reference: "VISA-4242", createdAt: setTime(monday, 9, 35) }],
      },
    },
  });
  await prisma.invoice.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[2].id,
      appointmentId: appointments[1].id,
      invoiceNumber: "INV-2026-0002",
      status: "Paid",
      subtotal: 650,
      discountAmount: 65,
      discountPercent: 10,
      taxAmount: 0,
      total: 585,
      notes: "10% membership discount applied",
      paidAt: setTime(monday, 11, 18),
      createdAt: setTime(monday, 11, 18),
      items: {
        create: [{ clinicId: clinic.id, serviceId: services[3].id, description: "Juvederm Ultra - Lips (1 syringe)", quantity: 1, unitPrice: 650, total: 650 }],
      },
      payments: {
        create: [{ clinicId: clinic.id, amount: 585, paymentMethod: "credit", reference: "AMEX-3310", createdAt: setTime(monday, 11, 18) }],
      },
    },
  });
  await prisma.invoice.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[4].id,
      appointmentId: appointments[2].id,
      invoiceNumber: "INV-2026-0003",
      status: "Paid",
      subtotal: 950,
      discountAmount: 0,
      taxAmount: 0,
      total: 950,
      paidAt: setTime(monday, 15, 5),
      createdAt: setTime(monday, 15, 5),
      items: {
        create: [{ clinicId: clinic.id, serviceId: services[5].id, description: "Sculptra - Full Face (2 vials)", quantity: 1, unitPrice: 950, total: 950 }],
      },
      payments: {
        create: [{ clinicId: clinic.id, amount: 950, paymentMethod: "credit", reference: "MC-7788", createdAt: setTime(monday, 15, 5) }],
      },
    },
  });

  // Tuesday paid invoices
  await prisma.invoice.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[3].id,
      appointmentId: appointments[4].id,
      invoiceNumber: "INV-2026-0004",
      status: "Paid",
      subtotal: 350,
      discountAmount: 0,
      taxAmount: 0,
      total: 350,
      paidAt: setTime(tuesday, 12, 5),
      createdAt: setTime(tuesday, 12, 5),
      items: {
        create: [{ clinicId: clinic.id, serviceId: services[7].id, description: "Microneedling", quantity: 1, unitPrice: 350, total: 350 }],
      },
      payments: {
        create: [{ clinicId: clinic.id, amount: 350, paymentMethod: "debit", reference: "DBT-5501", createdAt: setTime(tuesday, 12, 5) }],
      },
    },
  });

  // Today — Sent (unpaid) invoice for early-completed appointments
  await prisma.invoice.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[6].id,
      appointmentId: appointments[6].id,
      invoiceNumber: "INV-2026-0005",
      status: "Sent",
      subtotal: 150,
      discountAmount: 0,
      taxAmount: 0,
      total: 150,
      createdAt: setTime(wednesday, 8, 35),
      items: {
        create: [{ clinicId: clinic.id, serviceId: services[6].id, description: "Chemical Peel - Light", quantity: 1, unitPrice: 150, total: 150 }],
      },
    },
  });

  console.log("Created 5 weekly invoices (3 Mon paid, 1 Tue paid, 1 Wed sent)");

  // ===========================================
  // ADDITIONAL SALES DATA (Nov 2025 – Jan 2026)
  // ===========================================
  const salesData: {
    patientIdx: number;
    serviceIdx: number;
    date: Date;
    method: string;
    ref: string;
  }[] = [
    // --- November 2025 ---
    // Week 1
    { patientIdx: 3, serviceIdx: 0, date: new Date("2025-11-03T10:00:00"), method: "credit", ref: "VISA-9901" },
    { patientIdx: 5, serviceIdx: 6, date: new Date("2025-11-04T14:00:00"), method: "cash", ref: "" },
    { patientIdx: 7, serviceIdx: 8, date: new Date("2025-11-05T09:00:00"), method: "credit", ref: "AMEX-3310" },
    // Week 2
    { patientIdx: 0, serviceIdx: 3, date: new Date("2025-11-10T11:00:00"), method: "credit", ref: "VISA-4242" },
    { patientIdx: 2, serviceIdx: 7, date: new Date("2025-11-11T15:00:00"), method: "debit", ref: "DBT-5501" },
    { patientIdx: 4, serviceIdx: 4, date: new Date("2025-11-12T10:30:00"), method: "credit", ref: "MC-7788" },
    { patientIdx: 8, serviceIdx: 0, date: new Date("2025-11-13T13:00:00"), method: "cash", ref: "" },
    // Week 3
    { patientIdx: 1, serviceIdx: 5, date: new Date("2025-11-17T09:30:00"), method: "credit", ref: "VISA-1122" },
    { patientIdx: 9, serviceIdx: 2, date: new Date("2025-11-18T14:00:00"), method: "credit", ref: "AMEX-6644" },
    { patientIdx: 6, serviceIdx: 1, date: new Date("2025-11-19T11:00:00"), method: "debit", ref: "DBT-8820" },
    { patientIdx: 11, serviceIdx: 6, date: new Date("2025-11-20T16:00:00"), method: "cash", ref: "" },
    { patientIdx: 10, serviceIdx: 3, date: new Date("2025-11-21T10:00:00"), method: "credit", ref: "VISA-3355" },
    // Week 4
    { patientIdx: 4, serviceIdx: 7, date: new Date("2025-11-24T09:00:00"), method: "credit", ref: "MC-2299" },
    { patientIdx: 0, serviceIdx: 2, date: new Date("2025-11-25T13:30:00"), method: "debit", ref: "DBT-4410" },

    // --- December 2025 ---
    // Week 1
    { patientIdx: 2, serviceIdx: 0, date: new Date("2025-12-01T10:00:00"), method: "credit", ref: "VISA-4242" },
    { patientIdx: 5, serviceIdx: 4, date: new Date("2025-12-02T14:00:00"), method: "credit", ref: "AMEX-7711" },
    { patientIdx: 7, serviceIdx: 3, date: new Date("2025-12-03T11:00:00"), method: "cash", ref: "" },
    { patientIdx: 1, serviceIdx: 1, date: new Date("2025-12-04T09:30:00"), method: "credit", ref: "MC-5544" },
    { patientIdx: 10, serviceIdx: 5, date: new Date("2025-12-05T15:00:00"), method: "credit", ref: "VISA-8866" },
    // Week 2
    { patientIdx: 4, serviceIdx: 0, date: new Date("2025-12-08T10:00:00"), method: "debit", ref: "DBT-3301" },
    { patientIdx: 0, serviceIdx: 4, date: new Date("2025-12-09T14:00:00"), method: "credit", ref: "VISA-4242" },
    { patientIdx: 3, serviceIdx: 7, date: new Date("2025-12-10T11:00:00"), method: "cash", ref: "" },
    { patientIdx: 9, serviceIdx: 6, date: new Date("2025-12-11T09:00:00"), method: "credit", ref: "AMEX-2200" },
    { patientIdx: 6, serviceIdx: 3, date: new Date("2025-12-12T16:00:00"), method: "credit", ref: "MC-9933" },
    { patientIdx: 8, serviceIdx: 5, date: new Date("2025-12-12T10:00:00"), method: "credit", ref: "VISA-1177" },
    // Week 3 (holiday rush)
    { patientIdx: 11, serviceIdx: 4, date: new Date("2025-12-15T09:00:00"), method: "credit", ref: "VISA-6688" },
    { patientIdx: 2, serviceIdx: 5, date: new Date("2025-12-16T13:00:00"), method: "credit", ref: "AMEX-3310" },
    { patientIdx: 0, serviceIdx: 3, date: new Date("2025-12-17T10:30:00"), method: "debit", ref: "DBT-7702" },
    { patientIdx: 7, serviceIdx: 0, date: new Date("2025-12-17T14:00:00"), method: "cash", ref: "" },
    { patientIdx: 4, serviceIdx: 1, date: new Date("2025-12-18T11:00:00"), method: "credit", ref: "MC-4466" },
    { patientIdx: 5, serviceIdx: 7, date: new Date("2025-12-19T15:00:00"), method: "credit", ref: "VISA-2233" },
    { patientIdx: 1, serviceIdx: 4, date: new Date("2025-12-19T09:30:00"), method: "credit", ref: "AMEX-5599" },
    // Week 4
    { patientIdx: 3, serviceIdx: 2, date: new Date("2025-12-22T10:00:00"), method: "credit", ref: "VISA-1122" },
    { patientIdx: 10, serviceIdx: 0, date: new Date("2025-12-23T14:00:00"), method: "cash", ref: "" },
    { patientIdx: 9, serviceIdx: 3, date: new Date("2025-12-23T11:00:00"), method: "credit", ref: "MC-8877" },

    // --- January 2026 ---
    // Week 1
    { patientIdx: 0, serviceIdx: 0, date: new Date("2026-01-05T10:00:00"), method: "credit", ref: "VISA-4242" },
    { patientIdx: 2, serviceIdx: 3, date: new Date("2026-01-06T14:00:00"), method: "credit", ref: "AMEX-3310" },
    { patientIdx: 4, serviceIdx: 7, date: new Date("2026-01-07T11:00:00"), method: "debit", ref: "DBT-1102" },
    { patientIdx: 6, serviceIdx: 1, date: new Date("2026-01-07T09:00:00"), method: "cash", ref: "" },
    // Week 2
    { patientIdx: 1, serviceIdx: 5, date: new Date("2026-01-12T10:30:00"), method: "credit", ref: "VISA-9944" },
    { patientIdx: 5, serviceIdx: 4, date: new Date("2026-01-13T14:00:00"), method: "credit", ref: "MC-6611" },
    { patientIdx: 8, serviceIdx: 0, date: new Date("2026-01-14T09:00:00"), method: "credit", ref: "AMEX-2288" },
    { patientIdx: 11, serviceIdx: 2, date: new Date("2026-01-14T15:00:00"), method: "debit", ref: "DBT-3303" },
    { patientIdx: 3, serviceIdx: 3, date: new Date("2026-01-15T11:00:00"), method: "credit", ref: "VISA-7766" },
    // Week 3
    { patientIdx: 7, serviceIdx: 5, date: new Date("2026-01-19T10:00:00"), method: "credit", ref: "MC-4400" },
    { patientIdx: 0, serviceIdx: 1, date: new Date("2026-01-20T14:00:00"), method: "cash", ref: "" },
    { patientIdx: 9, serviceIdx: 4, date: new Date("2026-01-21T09:30:00"), method: "credit", ref: "VISA-5533" },
    { patientIdx: 10, serviceIdx: 7, date: new Date("2026-01-22T13:00:00"), method: "credit", ref: "AMEX-1199" },
    { patientIdx: 4, serviceIdx: 0, date: new Date("2026-01-22T16:00:00"), method: "debit", ref: "DBT-6604" },
    // Week 4
    { patientIdx: 2, serviceIdx: 5, date: new Date("2026-01-26T10:00:00"), method: "credit", ref: "VISA-4242" },
    { patientIdx: 6, serviceIdx: 3, date: new Date("2026-01-27T14:00:00"), method: "credit", ref: "MC-8822" },
    { patientIdx: 1, serviceIdx: 6, date: new Date("2026-01-28T11:00:00"), method: "cash", ref: "" },
    { patientIdx: 5, serviceIdx: 0, date: new Date("2026-01-29T09:00:00"), method: "credit", ref: "AMEX-3377" },
  ];

  let invoiceCounter = 3; // Continue from INV-2025-0002
  for (const sale of salesData) {
    const patient = patients[sale.patientIdx];
    const service = services[sale.serviceIdx];
    const invYear = sale.date.getFullYear();
    const invNum = `INV-${invYear}-${String(invoiceCounter).padStart(4, "0")}`;
    invoiceCounter++;

    await prisma.invoice.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        invoiceNumber: invNum,
        status: "Paid",
        subtotal: service.price,
        discountAmount: 0,
        taxAmount: 0,
        total: service.price,
        paidAt: sale.date,
        createdAt: sale.date,
        items: {
          create: [
            {
              clinicId: clinic.id,
              serviceId: service.id,
              description: service.name,
              quantity: 1,
              unitPrice: service.price,
              total: service.price,
            },
          ],
        },
        payments: {
          create: [
            {
              clinicId: clinic.id,
              amount: service.price,
              paymentMethod: sale.method,
              reference: sale.ref || null,
              createdAt: sale.date,
            },
          ],
        },
      },
    });
  }
  console.log(`Created ${salesData.length} additional invoices with payments (Nov 2025 – Jan 2026)`);

  // Product purchases (retail items linked to Product records)
  const productSales = [
    { patientIdx: 0, productIdx: 0, date: new Date("2026-01-10T11:00:00"), method: "credit", ref: "VISA-4242" },
    { patientIdx: 0, productIdx: 1, date: new Date("2026-01-10T11:00:00"), method: "credit", ref: "VISA-4242" },
    { patientIdx: 2, productIdx: 2, date: new Date("2025-12-20T14:00:00"), method: "credit", ref: "AMEX-3310" },
    { patientIdx: 4, productIdx: 3, date: new Date("2026-01-08T10:00:00"), method: "debit", ref: "DBT-9901" },
    { patientIdx: 1, productIdx: 4, date: new Date("2026-01-15T09:00:00"), method: "credit", ref: "VISA-9944" },
    { patientIdx: 7, productIdx: 5, date: new Date("2026-01-20T10:30:00"), method: "credit", ref: "AMEX-3310" },
    { patientIdx: 4, productIdx: 0, date: new Date("2025-12-18T15:00:00"), method: "credit", ref: "MC-4466" },
    { patientIdx: 11, productIdx: 1, date: new Date("2026-01-22T11:00:00"), method: "cash", ref: "" },
  ];

  for (const sale of productSales) {
    const product = products[sale.productIdx];
    const invNum = `INV-${String(invoiceCounter++).padStart(5, "0")}`;
    await prisma.invoice.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[sale.patientIdx].id,
        invoiceNumber: invNum,
        status: "Paid",
        subtotal: product.retailPrice,
        discountAmount: 0,
        taxAmount: 0,
        total: product.retailPrice,
        paidAt: sale.date,
        createdAt: sale.date,
        items: {
          create: [
            {
              clinicId: clinic.id,
              productId: product.id,
              description: product.name,
              quantity: 1,
              unitPrice: product.retailPrice,
              total: product.retailPrice,
            },
          ],
        },
        payments: {
          create: [
            {
              clinicId: clinic.id,
              amount: product.retailPrice,
              paymentMethod: sale.method,
              reference: sale.ref || null,
              createdAt: sale.date,
            },
          ],
        },
      },
    });
  }
  console.log(`Created ${productSales.length} product (retail) invoices`);

  // ===========================================
  // PATIENT MEMBERSHIPS
  // ===========================================
  await Promise.all([
    // Silver members
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[0].id,
        planId: membershipPlans[0].id,
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 4, 10),
        nextBillDate: new Date(today.getFullYear(), today.getMonth() + 1, 10),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[1].id,
        planId: membershipPlans[0].id,
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 3, 5),
        nextBillDate: new Date(today.getFullYear(), today.getMonth() + 1, 5),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[4].id,
        planId: membershipPlans[0].id,
        status: "Cancelled",
        startDate: new Date(today.getFullYear(), today.getMonth() - 6, 1),
        cancelledAt: new Date(today.getFullYear(), today.getMonth() - 1, 15),
      },
    }),
    // Gold members
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[2].id,
        planId: membershipPlans[1].id,
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 2, 1),
        nextBillDate: new Date(today.getFullYear(), today.getMonth() + 1, 1),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[3].id,
        planId: membershipPlans[1].id,
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 5, 20),
        nextBillDate: new Date(today.getFullYear(), today.getMonth() + 1, 20),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[0].id,
        planId: membershipPlans[1].id,
        status: "Paused",
        startDate: new Date(today.getFullYear(), today.getMonth() - 3, 12),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[4].id,
        planId: membershipPlans[1].id,
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 1, 8),
        nextBillDate: new Date(today.getFullYear(), today.getMonth() + 1, 8),
      },
    }),
    // Platinum members
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[4].id,
        planId: membershipPlans[2].id,
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 1, 15),
        nextBillDate: new Date(today.getFullYear(), today.getMonth(), 15),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[1].id,
        planId: membershipPlans[2].id,
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 2, 3),
        nextBillDate: new Date(today.getFullYear(), today.getMonth() + 1, 3),
      },
    }),
    // Additional members using patients 5-11
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[5].id,
        planId: membershipPlans[0].id, // Silver
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 2, 14),
        nextBillDate: new Date(today.getFullYear(), today.getMonth() + 1, 14),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[6].id,
        planId: membershipPlans[1].id, // Gold
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 1, 20),
        nextBillDate: new Date(today.getFullYear(), today.getMonth() + 1, 20),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[7].id,
        planId: membershipPlans[2].id, // Platinum
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 3, 1),
        nextBillDate: new Date(today.getFullYear(), today.getMonth() + 1, 1),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[8].id,
        planId: membershipPlans[0].id, // Silver
        status: "Paused",
        startDate: new Date(today.getFullYear(), today.getMonth() - 4, 5),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[9].id,
        planId: membershipPlans[1].id, // Gold
        status: "Cancelled",
        startDate: new Date(today.getFullYear(), today.getMonth() - 5, 10),
        cancelledAt: new Date(today.getFullYear(), today.getMonth() - 1, 10),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[10].id,
        planId: membershipPlans[2].id, // Platinum
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 1, 22),
        nextBillDate: new Date(today.getFullYear(), today.getMonth() + 1, 22),
      },
    }),
    prisma.patientMembership.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[11].id,
        planId: membershipPlans[0].id, // Silver
        status: "Active",
        startDate: new Date(today.getFullYear(), today.getMonth() - 2, 28),
        nextBillDate: new Date(today.getFullYear(), today.getMonth() + 1, 28),
      },
    }),
  ]);
  console.log("Created patient memberships");

  // ===========================================
  // AUDIT LOGS
  // ===========================================
  const auditLogs = await Promise.all([
    // Monday: NP provider signs chart, then MD co-signs
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: provider1.id,
        action: "ChartProviderSign",
        entityType: "Chart",
        entityId: chartMon1.id,
        details: JSON.stringify({ patientId: patients[0].id, providerName: provider1.name }),
        ipAddress: "192.168.1.100",
        createdAt: setTime(monday, 9, 30),
      },
    }),
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: medicalDirector.id,
        action: "MDCoSign",
        entityType: "Chart",
        entityId: chartMon1.id,
        details: JSON.stringify({
          patientId: patients[0].id,
          previousStatus: "NeedsSignOff",
          newStatus: "MDSigned",
          recordHash: chartMon1.recordHash,
        }),
        ipAddress: "192.168.1.50",
        createdAt: setTime(monday, 16, 0),
      },
    }),
    // Tuesday: NP provider signs pending-review charts
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: provider1.id,
        action: "ChartProviderSign",
        entityType: "Chart",
        entityId: chartTue1.id,
        details: JSON.stringify({ patientId: patients[1].id, providerName: provider1.name }),
        ipAddress: "192.168.1.100",
        createdAt: setTime(tuesday, 9, 30),
      },
    }),
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: provider1.id,
        action: "ChartProviderSign",
        entityType: "Chart",
        entityId: chartTue3.id,
        details: JSON.stringify({ patientId: patients[4].id, providerName: provider1.name }),
        ipAddress: "192.168.1.100",
        createdAt: setTime(tuesday, 14, 45),
      },
    }),
    // General audit entries
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: medicalDirector.id,
        action: "ChartView",
        entityType: "Chart",
        entityId: chartMon1.id,
        details: JSON.stringify({ patientId: patients[0].id }),
        ipAddress: "192.168.1.50",
        createdAt: setTime(monday, 15, 55),
      },
    }),
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: frontDesk.id,
        action: "PatientView",
        entityType: "Patient",
        entityId: patients[1].id,
        ipAddress: "192.168.1.200",
        createdAt: setTime(tuesday, 8, 45),
      },
    }),
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: owner.id,
        action: "Login",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        createdAt: setTime(wednesday, 7, 30),
      },
    }),
  ]);
  console.log(`Created ${auditLogs.length} audit log entries`);

  // ===========================================
  // PATIENT COMMUNICATION PREFERENCES
  // ===========================================
  const commPrefs = await Promise.all([
    prisma.patientCommunicationPreference.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[0].id, // Jennifer Williams
        phoneE164: "+15552345678",
        smsOptIn: true,
        smsOptInAt: new Date(today.getFullYear(), today.getMonth() - 2, 10),
        consentSource: "FrontDesk",
      },
    }),
    prisma.patientCommunicationPreference.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[2].id, // Lisa Chen
        phoneE164: "+15554567890",
        smsOptIn: true,
        smsOptInAt: new Date(today.getFullYear(), today.getMonth() - 1, 5),
        consentSource: "Portal",
      },
    }),
    prisma.patientCommunicationPreference.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[3].id, // David Martinez
        phoneE164: "+15555678901",
        smsOptIn: false,
        smsOptInAt: new Date(today.getFullYear(), today.getMonth() - 3, 1),
        smsOptOutAt: new Date(today.getFullYear(), today.getMonth() - 1, 15),
        consentSource: "FrontDesk",
      },
    }),
  ]);
  console.log(`Created ${commPrefs.length} communication preferences`);

  // ===========================================
  // CONVERSATIONS
  // ===========================================
  const conversations = await Promise.all([
    prisma.conversation.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[0].id, // Jennifer Williams
        lastMessageAt: new Date(today.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        lastMessagePreview: "Your appointment is confirmed for tomorrow at 10 AM.",
        unreadCount: 0,
      },
    }),
    prisma.conversation.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[2].id, // Lisa Chen
        lastMessageAt: new Date(today.getTime() - 24 * 60 * 60 * 1000), // yesterday
        lastMessagePreview: "Thank you! See you then.",
        unreadCount: 1,
      },
    }),
    prisma.conversation.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[3].id, // David Martinez
        lastMessageAt: new Date(today.getTime() - 48 * 60 * 60 * 1000), // 2 days ago
        lastMessagePreview: "Reminder: Your appointment is scheduled for...",
        unreadCount: 0,
      },
    }),
  ]);
  console.log(`Created ${conversations.length} conversations`);

  // ===========================================
  // MESSAGES
  // ===========================================
  const messages = await Promise.all([
    // Conversation 1 (Jennifer Williams): 2 outbound
    prisma.message.create({
      data: {
        clinicId: clinic.id,
        conversationId: conversations[0].id,
        direction: "Outbound",
        channel: "SMS",
        purpose: "Reminder",
        patientId: patients[0].id,
        bodyTextSnapshot: "Hi Jennifer, this is a reminder about your upcoming Botox appointment tomorrow at 10 AM. Reply CONFIRM to confirm.",
        bodyHash: "sha256:reminder1hash",
        status: "Delivered",
        sentAt: new Date(today.getTime() - 4 * 60 * 60 * 1000),
        deliveredAt: new Date(today.getTime() - 4 * 60 * 60 * 1000 + 5000),
        createdByUserId: frontDesk.id,
        createdAt: new Date(today.getTime() - 4 * 60 * 60 * 1000),
      },
    }),
    prisma.message.create({
      data: {
        clinicId: clinic.id,
        conversationId: conversations[0].id,
        direction: "Outbound",
        channel: "SMS",
        purpose: "AppointmentConfirmation",
        patientId: patients[0].id,
        bodyTextSnapshot: "Your appointment is confirmed for tomorrow at 10 AM. Please arrive 10 minutes early. See you soon!",
        bodyHash: "sha256:confirm1hash",
        status: "Delivered",
        sentAt: new Date(today.getTime() - 2 * 60 * 60 * 1000),
        deliveredAt: new Date(today.getTime() - 2 * 60 * 60 * 1000 + 3000),
        createdByUserId: frontDesk.id,
        createdAt: new Date(today.getTime() - 2 * 60 * 60 * 1000),
      },
    }),
    // Conversation 2 (Lisa Chen): 1 outbound + 1 inbound
    prisma.message.create({
      data: {
        clinicId: clinic.id,
        conversationId: conversations[1].id,
        direction: "Outbound",
        channel: "SMS",
        purpose: "FollowUp",
        patientId: patients[2].id,
        bodyTextSnapshot: "Hi Lisa, how are you feeling after your lip filler treatment? Please let us know if you have any questions.",
        bodyHash: "sha256:followup1hash",
        status: "Delivered",
        sentAt: new Date(today.getTime() - 26 * 60 * 60 * 1000),
        deliveredAt: new Date(today.getTime() - 26 * 60 * 60 * 1000 + 4000),
        createdByUserId: provider1.id,
        createdAt: new Date(today.getTime() - 26 * 60 * 60 * 1000),
      },
    }),
    prisma.message.create({
      data: {
        clinicId: clinic.id,
        conversationId: conversations[1].id,
        direction: "Inbound",
        channel: "SMS",
        purpose: "Generic",
        patientId: patients[2].id,
        bodyTextSnapshot: "Thank you! See you then.",
        bodyHash: "sha256:inbound1hash",
        status: "Delivered",
        deliveredAt: new Date(today.getTime() - 24 * 60 * 60 * 1000),
        createdAt: new Date(today.getTime() - 24 * 60 * 60 * 1000),
      },
    }),
    // Conversation 3 (David Martinez): 1 outbound before opt-out
    prisma.message.create({
      data: {
        clinicId: clinic.id,
        conversationId: conversations[2].id,
        direction: "Outbound",
        channel: "SMS",
        purpose: "Reminder",
        patientId: patients[3].id,
        bodyTextSnapshot: "Reminder: Your appointment is scheduled for next week. Please confirm your attendance.",
        bodyHash: "sha256:reminder2hash",
        status: "Delivered",
        sentAt: new Date(today.getTime() - 48 * 60 * 60 * 1000),
        deliveredAt: new Date(today.getTime() - 48 * 60 * 60 * 1000 + 6000),
        createdByUserId: frontDesk.id,
        createdAt: new Date(today.getTime() - 48 * 60 * 60 * 1000),
      },
    }),
  ]);
  console.log(`Created ${messages.length} messages`);

  // ===========================================
  // MESSAGE TEMPLATES
  // ===========================================
  const messageTemplates = await Promise.all([
    prisma.messageTemplate.create({
      data: {
        clinicId: clinic.id,
        key: "appointment-reminder",
        purpose: "Reminder",
        bodyText: "Hi {{firstName}}, this is a reminder about your upcoming appointment at Radiance MedSpa. Please reply CONFIRM to confirm your attendance.",
      },
    }),
    prisma.messageTemplate.create({
      data: {
        clinicId: clinic.id,
        key: "appointment-confirmation",
        purpose: "AppointmentConfirmation",
        bodyText: "Hi {{firstName}}, your appointment at Radiance MedSpa is confirmed. Please arrive 10 minutes early. See you soon!",
      },
    }),
    prisma.messageTemplate.create({
      data: {
        clinicId: clinic.id,
        key: "post-treatment-followup",
        purpose: "FollowUp",
        bodyText: "Hi {{firstName}}, how are you feeling after your treatment? If you have any questions or concerns, please don't hesitate to reach out. - Radiance MedSpa",
      },
    }),
    prisma.messageTemplate.create({
      data: {
        clinicId: clinic.id,
        key: "arrival-instructions",
        purpose: "Arrival",
        bodyText: "Hi {{firstName}}, we're looking forward to seeing you! When you arrive, please check in at the front desk. Parking is available in the lot behind our building.",
      },
    }),
  ]);
  console.log(`Created ${messageTemplates.length} message templates`);

  // ===========================================
  // NOTIFICATION TEMPLATES
  // ===========================================
  const notificationTemplates = await Promise.all([
    prisma.notificationTemplate.create({
      data: {
        clinicId: clinic.id,
        key: "booking-confirmation",
        name: "Appointment Confirmation",
        description: "Confirmation sent to patients after a booking.",
        trigger: "PreAppointment",
        offsetValue: 0,
        offsetUnit: "Minutes",
        bodyText:
          "Hi {{firstName}}, your appointment at {{clinicName}} is confirmed for {{appointmentDate}} at {{appointmentTime}}. Reply CONFIRM to confirm or call us to reschedule.",
        isSystem: true,
      },
    }),
    prisma.notificationTemplate.create({
      data: {
        clinicId: clinic.id,
        key: "appointment-reminder",
        name: "Appointment Reminder",
        description: "Reminds the patient about their upcoming appointment.",
        trigger: "PreAppointment",
        offsetValue: 2,
        offsetUnit: "Days",
        bodyText:
          "Hi {{firstName}}, this is a reminder about your appointment at {{clinicName}} on {{appointmentDate}} at {{appointmentTime}}. We look forward to seeing you!",
        isSystem: true,
      },
    }),
    prisma.notificationTemplate.create({
      data: {
        clinicId: clinic.id,
        key: "services-receipt",
        name: "Services Receipt",
        description: "Services and products receipt sent after checkout.",
        trigger: "PostAppointment",
        offsetValue: 0,
        offsetUnit: "Minutes",
        bodyText:
          "Hi {{firstName}}, here is your receipt from {{clinicName}} for your visit on {{appointmentDate}}. Thank you for choosing us!",
        isSystem: true,
      },
    }),
    prisma.notificationTemplate.create({
      data: {
        clinicId: clinic.id,
        key: "review-request",
        name: "Review Reminder",
        description: "Reminds patients to leave a review after their visit.",
        trigger: "PostAppointment",
        offsetValue: 2,
        offsetUnit: "Hours",
        bodyText:
          "Hi {{firstName}}, thank you for visiting {{clinicName}}! We'd love to hear about your experience. Leave us a review here: {{reviewLink}}",
        isSystem: true,
      },
    }),
  ]);
  console.log(
    `Created ${notificationTemplates.length} notification templates`
  );

  console.log("\nDatabase seeding completed successfully!");
  console.log("\n=== Demo Week: Feb 16–20, 2026 ===");
  console.log("\nSummary:");
  console.log("- 1 Clinic, 3 Rooms");
  console.log("- 6 Users (Owner, MedicalDirector, 2 Providers [1 NP w/ MD supervision], FrontDesk, Billing)");
  console.log("- 12 Services, 6 Products, 12 Patients");
  console.log("- 3 Consent Templates, 3 Chart Templates, 3 Membership Plans");
  console.log("- 22 Appointments across Mon–Fri:");
  console.log("  Mon: 3 Completed+CheckedOut | Tue: 3 (1 CheckedOut, 2 pending MD review)");
  console.log("  Wed: 11 (2 done, 2 InProgress, 2 CheckedIn, 2 Confirmed, 3 Scheduled)");
  console.log("  Thu: 3 Scheduled | Fri: 2 Scheduled");
  console.log("- 10 Charts: 4 MDSigned, 2 NeedsSignOff (MD Review queue), 3 Draft, 1 standalone Draft");
  console.log("- Treatment cards on all charts (filled for completed, empty for in-progress)");
  console.log("- MD Review queue: 2 charts awaiting co-sign (Michael J + Amanda T from Tuesday)");
  console.log("- 5 Weekly invoices + historical Nov 2025–Jan 2026 sales data");
  console.log("- 7 Audit log entries (provider signs, MD co-sign, views, login)");
  console.log("- 3 Communication Preferences, 3 Conversations, 5 Messages");
  console.log("- 4 Message Templates, 4 Notification Templates");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
