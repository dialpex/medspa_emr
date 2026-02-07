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
      passwordHash: passwordHash,
    },
  });

  const provider1 = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      email: "jessica.np@radiancemedspa.com",
      name: "Jessica Adams, NP",
      role: "Provider",
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

  console.log("Created 6 users");

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
        category: "Skin Treatments",
      },
    }),
    prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: "Microneedling",
        description: "Collagen induction therapy",
        duration: 60,
        price: 350,
        category: "Skin Treatments",
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
  // APPOINTMENTS (Various statuses)
  // ===========================================
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  // Helper to create appointment times
  const setTime = (date: Date, hours: number, minutes: number): Date => {
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const appointments = await Promise.all([
    // Completed appointment from last week
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[0].id,
        providerId: provider1.id,
        serviceId: services[0].id, // Botox Forehead
        roomId: rooms[0].id,
        startTime: setTime(lastWeek, 10, 0),
        endTime: setTime(lastWeek, 10, 30),
        status: "Completed",
        notes: "Patient tolerated procedure well",
      },
    }),
    // Completed appointment from yesterday
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[2].id,
        providerId: provider1.id,
        serviceId: services[3].id, // Juvederm Lips
        roomId: rooms[0].id,
        startTime: setTime(yesterday, 14, 0),
        endTime: setTime(yesterday, 14, 45),
        status: "Completed",
        notes: "1 syringe used. Patient happy with results.",
      },
    }),
    // Completed appointment from yesterday (needs sign-off)
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[4].id,
        providerId: provider2.id,
        serviceId: services[5].id, // Sculptra
        roomId: rooms[1].id,
        startTime: setTime(yesterday, 11, 0),
        endTime: setTime(yesterday, 12, 0),
        status: "Completed",
        notes: "Full face Sculptra session 2 of 3",
      },
    }),
    // Today's appointments — covering all journey phases
    // 1. Upcoming (Scheduled) — no timestamps
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[0].id,
        providerId: provider1.id,
        serviceId: services[1].id, // Botox Crow's feet
        roomId: rooms[0].id,
        startTime: setTime(today, 10, 0),
        endTime: setTime(today, 10, 20),
        status: "Scheduled",
      },
    }),
    // 2. Upcoming (Confirmed) — no timestamps
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[3].id,
        providerId: provider2.id,
        serviceId: services[7].id, // Microneedling
        roomId: rooms[1].id,
        startTime: setTime(today, 11, 0),
        endTime: setTime(today, 12, 0),
        status: "Confirmed",
      },
    }),
    // 3. Here (CheckedIn) — checkedInAt set
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[1].id,
        providerId: provider1.id,
        serviceId: services[8].id, // Consultation
        roomId: rooms[2].id,
        startTime: setTime(today, 9, 0),
        endTime: setTime(today, 9, 30),
        status: "CheckedIn",
        notes: "New patient consultation",
        checkedInAt: setTime(today, 8, 52),
      },
    }),
    // 4. With Provider (InProgress) — checkedInAt + startedAt set
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[5].id,
        providerId: provider2.id,
        serviceId: services[0].id, // Botox Forehead
        roomId: rooms[1].id,
        startTime: setTime(today, 9, 30),
        endTime: setTime(today, 10, 0),
        status: "InProgress",
        notes: "Returning patient, forehead touch-up",
        checkedInAt: setTime(today, 9, 20),
        startedAt: setTime(today, 9, 32),
      },
    }),
    // 5. Done — checkout pending (Completed, no checkedOutAt)
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[6].id,
        providerId: provider1.id,
        serviceId: services[6].id, // Chemical Peel
        roomId: rooms[0].id,
        startTime: setTime(today, 8, 0),
        endTime: setTime(today, 8, 30),
        status: "Completed",
        notes: "Light peel completed, good tolerance",
        checkedInAt: setTime(today, 7, 50),
        startedAt: setTime(today, 8, 2),
        completedAt: setTime(today, 8, 28),
      },
    }),
    // 6. Done — checked out (Completed, all 4 timestamps)
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[7].id,
        providerId: provider2.id,
        serviceId: services[9].id, // Follow-Up Visit
        roomId: rooms[2].id,
        startTime: setTime(today, 8, 30),
        endTime: setTime(today, 8, 45),
        status: "Completed",
        notes: "2-week follow-up, healing well",
        checkedInAt: setTime(today, 8, 22),
        startedAt: setTime(today, 8, 30),
        completedAt: setTime(today, 8, 42),
        checkedOutAt: setTime(today, 8, 48),
      },
    }),
    // 7. Afternoon Upcoming (Scheduled)
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[4].id,
        providerId: provider1.id,
        serviceId: services[4].id, // Juvederm Voluma Cheeks
        roomId: rooms[0].id,
        startTime: setTime(today, 14, 0),
        endTime: setTime(today, 14, 45),
        status: "Scheduled",
      },
    }),
    // Tomorrow's appointments
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[2].id,
        providerId: provider1.id,
        serviceId: services[9].id, // Follow-up
        roomId: rooms[2].id,
        startTime: setTime(tomorrow, 9, 0),
        endTime: setTime(tomorrow, 9, 15),
        status: "Scheduled",
        notes: "2-week follow-up from lip filler",
      },
    }),
    prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[4].id,
        providerId: provider2.id,
        serviceId: services[4].id, // Voluma Cheeks
        roomId: rooms[0].id,
        startTime: setTime(tomorrow, 14, 0),
        endTime: setTime(tomorrow, 14, 45),
        status: "Scheduled",
      },
    }),
  ]);
  console.log(`Created ${appointments.length} appointments`);

  // ===========================================
  // CHARTS (Various statuses showing lifecycle)
  // ===========================================

  // Chart 1: MDSigned - from last week's appointment
  const chart1 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[0].id,
      appointmentId: appointments[0].id,
      createdById: provider1.id,
      status: "MDSigned",
      chiefComplaint: "Forehead lines and wrinkles",
      areasTreated: JSON.stringify(["Forehead", "Glabella"]),
      productsUsed: JSON.stringify([
        {
          name: "Botox",
          lot: "C3456A",
          expiration: "2025-06-15",
          units: 20,
        },
      ]),
      dosageUnits: "20 units",
      technique: "Standard injection technique, 5 injection points across forehead",
      aftercareNotes: "Avoid lying down for 4 hours. No strenuous exercise for 24 hours.",
      additionalNotes: "Patient tolerated well. No immediate adverse reactions.",
      signedById: medicalDirector.id,
      signedByName: medicalDirector.name,
      signedAt: new Date(lastWeek.getTime() + 24 * 60 * 60 * 1000), // Day after appointment
      recordHash: "sha256:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
    },
  });

  // Chart 2: NeedsSignOff - from yesterday's lip filler
  const chart2 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[2].id,
      appointmentId: appointments[1].id,
      createdById: provider1.id,
      status: "NeedsSignOff",
      chiefComplaint: "Lip enhancement - desires fuller lips",
      areasTreated: JSON.stringify(["Upper lip", "Lower lip", "Vermillion border"]),
      productsUsed: JSON.stringify([
        {
          name: "Juvederm Ultra XC",
          lot: "J7890B",
          expiration: "2025-08-20",
          syringes: 1,
        },
      ]),
      dosageUnits: "1 syringe (1.0mL)",
      technique: "Serial puncture and linear threading technique",
      aftercareNotes: "Ice as needed. Avoid hot beverages for 24 hours. Arnica gel recommended.",
      additionalNotes: "Achieved natural enhancement per patient preference. Symmetry achieved.",
    },
  });

  // Chart 3: NeedsSignOff - from yesterday's Sculptra
  const chart3 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[4].id,
      appointmentId: appointments[2].id,
      createdById: provider2.id,
      status: "NeedsSignOff",
      chiefComplaint: "Volume loss in cheeks and temples - session 2 of 3",
      areasTreated: JSON.stringify(["Cheeks", "Temples", "Jawline"]),
      productsUsed: JSON.stringify([
        {
          name: "Sculptra",
          lot: "S2345C",
          expiration: "2025-12-01",
          vials: 2,
        },
      ]),
      dosageUnits: "2 vials reconstituted with 8mL sterile water each",
      technique: "Deep dermal/subcutaneous injection with fanning technique",
      aftercareNotes: "Massage treated areas 5 minutes, 5 times daily for 5 days. Follow-up in 6 weeks.",
      additionalNotes: "Good volume distribution achieved. Schedule session 3 in 6 weeks.",
    },
  });

  // Chart 4: Draft - started but not complete
  const chart4 = await prisma.chart.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[1].id,
      createdById: provider1.id,
      status: "Draft",
      chiefComplaint: "Initial consultation for preventative Botox",
      additionalNotes: "Patient interested in starting preventative treatments. Discussed options.",
    },
  });

  console.log("Created 4 charts (1 MDSigned, 2 NeedsSignOff, 1 Draft)");

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
        signedAt: lastWeek,
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
        signedAt: yesterday,
        ipAddress: "192.168.1.101",
        userAgent: "Mozilla/5.0 (iPhone)",
        templateSnapshot: consentTemplates[1].content,
      },
    }),
  ]);
  console.log(`Created ${consents.length} patient consents`);

  // ===========================================
  // INVOICES
  // ===========================================
  const invoice1 = await prisma.invoice.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[0].id,
      appointmentId: appointments[0].id,
      invoiceNumber: "INV-2025-0001",
      status: "Paid",
      subtotal: 350,
      discountAmount: 0,
      taxAmount: 0,
      total: 350,
      paidAt: lastWeek,
      items: {
        create: [
          {
            clinicId: clinic.id,
            serviceId: services[0].id,
            description: "Botox - Forehead (20 units)",
            quantity: 1,
            unitPrice: 350,
            total: 350,
          },
        ],
      },
      payments: {
        create: [
          {
            clinicId: clinic.id,
            amount: 350,
            paymentMethod: "credit",
            reference: "VISA-4242",
          },
        ],
      },
    },
  });

  const invoice2 = await prisma.invoice.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[2].id,
      appointmentId: appointments[1].id,
      invoiceNumber: "INV-2025-0002",
      status: "Sent",
      subtotal: 650,
      discountAmount: 65,
      discountPercent: 10,
      taxAmount: 0,
      total: 585,
      notes: "10% membership discount applied",
      items: {
        create: [
          {
            clinicId: clinic.id,
            serviceId: services[3].id,
            description: "Juvederm Ultra - Lips (1 syringe)",
            quantity: 1,
            unitPrice: 650,
            total: 650,
          },
        ],
      },
    },
  });

  console.log("Created 2 invoices");

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
    // Chart view events
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: medicalDirector.id,
        action: "ChartView",
        entityType: "Chart",
        entityId: chart1.id,
        details: JSON.stringify({ patientId: patients[0].id }),
        ipAddress: "192.168.1.50",
      },
    }),
    // Chart sign event
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: medicalDirector.id,
        action: "ChartSign",
        entityType: "Chart",
        entityId: chart1.id,
        details: JSON.stringify({
          patientId: patients[0].id,
          previousStatus: "NeedsSignOff",
          newStatus: "MDSigned",
          recordHash: chart1.recordHash,
        }),
        ipAddress: "192.168.1.50",
      },
    }),
    // Chart create events
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: provider1.id,
        action: "ChartCreate",
        entityType: "Chart",
        entityId: chart2.id,
        details: JSON.stringify({ patientId: patients[2].id }),
        ipAddress: "192.168.1.100",
      },
    }),
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: provider2.id,
        action: "ChartCreate",
        entityType: "Chart",
        entityId: chart3.id,
        details: JSON.stringify({ patientId: patients[4].id }),
        ipAddress: "192.168.1.101",
      },
    }),
    // Patient view events
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: frontDesk.id,
        action: "PatientView",
        entityType: "Patient",
        entityId: patients[1].id,
        ipAddress: "192.168.1.200",
      },
    }),
    // Login events
    prisma.auditLog.create({
      data: {
        clinicId: clinic.id,
        userId: owner.id,
        action: "Login",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
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

  console.log("\nDatabase seeding completed successfully!");
  console.log("\nSummary:");
  console.log("- 1 Clinic");
  console.log("- 3 Rooms");
  console.log("- 6 Users (Owner, MedicalDirector, 2 Providers, FrontDesk, Billing)");
  console.log("- 10 Services");
  console.log("- 12 Patients");
  console.log("- 3 Consent Templates");
  console.log("- 3 Chart Templates (Neurotoxin, Dermal Filler, IV Drip)");
  console.log("- 3 Membership Plans");
  console.log("- 12 Appointments");
  console.log("- 4 Charts (1 MDSigned, 2 NeedsSignOff, 1 Draft)");
  console.log("- 2 Patient Consents");
  console.log("- 2 Invoices");
  console.log("- 2 Patient Memberships");
  console.log("- 6 Audit Log Entries");
  console.log("- 3 Communication Preferences");
  console.log("- 3 Conversations with 5 Messages");
  console.log("- 4 Message Templates");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
