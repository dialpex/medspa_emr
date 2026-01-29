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
        name: "Bronze Membership",
        description: "Basic membership with 10 credits per year",
        price: 500,
        credits: 10,
        validityDays: 365,
      },
    }),
    prisma.membershipPlan.create({
      data: {
        clinicId: clinic.id,
        name: "Silver Membership",
        description: "Standard membership with 25 credits per year",
        price: 1000,
        credits: 25,
        validityDays: 365,
      },
    }),
    prisma.membershipPlan.create({
      data: {
        clinicId: clinic.id,
        name: "Gold Membership",
        description: "Premium membership with 50 credits per year",
        price: 1800,
        credits: 50,
        validityDays: 365,
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
    // Today's appointments
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
      },
    }),
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
  // MEMBERSHIP CREDITS
  // ===========================================
  const membershipCredit = await prisma.membershipCredit.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[2].id,
      planId: membershipPlans[1].id, // Silver
      totalCredits: 25,
      usedCredits: 5,
      expiresAt: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()),
      ledger: {
        create: [
          {
            clinicId: clinic.id,
            change: 25,
            balance: 25,
            description: "Initial membership purchase",
          },
          {
            clinicId: clinic.id,
            change: -3,
            balance: 22,
            description: "Botox treatment credit redemption",
          },
          {
            clinicId: clinic.id,
            change: -2,
            balance: 20,
            description: "Chemical peel credit redemption",
          },
        ],
      },
    },
  });

  const membershipCredit2 = await prisma.membershipCredit.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[4].id,
      planId: membershipPlans[2].id, // Gold
      totalCredits: 50,
      usedCredits: 12,
      expiresAt: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()),
      ledger: {
        create: [
          {
            clinicId: clinic.id,
            change: 50,
            balance: 50,
            description: "Initial membership purchase",
          },
          {
            clinicId: clinic.id,
            change: -8,
            balance: 42,
            description: "Sculptra session 1 credit redemption",
          },
          {
            clinicId: clinic.id,
            change: -4,
            balance: 38,
            description: "Botox full face credit redemption",
          },
        ],
      },
    },
  });
  console.log("Created 2 membership credits with ledger entries");

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

  console.log("\nDatabase seeding completed successfully!");
  console.log("\nSummary:");
  console.log("- 1 Clinic");
  console.log("- 3 Rooms");
  console.log("- 6 Users (Owner, MedicalDirector, 2 Providers, FrontDesk, Billing)");
  console.log("- 10 Services");
  console.log("- 5 Patients");
  console.log("- 3 Consent Templates");
  console.log("- 3 Chart Templates (Neurotoxin, Dermal Filler, IV Drip)");
  console.log("- 3 Membership Plans");
  console.log("- 8 Appointments");
  console.log("- 4 Charts (1 MDSigned, 2 NeedsSignOff, 1 Draft)");
  console.log("- 2 Patient Consents");
  console.log("- 2 Invoices");
  console.log("- 2 Membership Credits with Ledger");
  console.log("- 6 Audit Log Entries");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
