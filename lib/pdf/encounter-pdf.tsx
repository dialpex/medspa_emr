/**
 * Main EncounterDocument component for PDF rendering via @react-pdf/renderer.
 */
import React from "react";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { styles } from "./pdf-styles";
import { StructuredTable } from "./structured-tables";

interface PhotoBuffer {
  id: string;
  buffer: Buffer;
  caption: string | null;
  category: string | null;
}

interface TreatmentCardData {
  id: string;
  title: string;
  templateType: string;
  narrativeText: string;
  structuredData: string;
  photos: PhotoBuffer[];
}

interface AddendumData {
  id: string;
  text: string;
  createdAt: string;
  authorName: string;
}

interface EncounterPdfData {
  encounterId: string;
  patientName: string;
  patientDob: string | null;
  providerName: string;
  clinicName: string;
  appointmentDate: string;
  encounterStartedAt: string;
  finalizedAt: string | null;
  chiefComplaint: string | null;
  additionalNotes: string | null;
  treatmentCards: TreatmentCardData[];
  chartPhotos: PhotoBuffer[];
  providerSignedBy: string | null;
  providerSignedAt: string | null;
  signedByName: string | null;
  signedAt: string | null;
  addenda: AddendumData[];
  generatedAt: string;
}

export function EncounterDocument({ data }: { data: EncounterPdfData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>{data.clinicName}</Text>
              <Text style={styles.headerSubtitle}>
                Patient: {data.patientName}
                {data.patientDob ? ` | DOB: ${data.patientDob}` : ""}
              </Text>
              <Text style={styles.headerSubtitle}>
                Provider: {data.providerName} | Date: {data.appointmentDate}
              </Text>
              <Text style={styles.headerSubtitle}>
                Encounter ID: {data.encounterId}
              </Text>
            </View>
            <Text style={styles.headerBadge}>FINALIZED</Text>
          </View>
        </View>

        {/* Section 1: Encounter Summary */}
        <Text style={styles.sectionTitle}>Encounter Summary</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Appointment Date</Text>
            <Text style={styles.value}>{data.appointmentDate}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Provider</Text>
            <Text style={styles.value}>{data.providerName}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Clinic</Text>
            <Text style={styles.value}>{data.clinicName}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Started</Text>
            <Text style={styles.value}>{data.encounterStartedAt}</Text>
          </View>
        </View>
        {data.chiefComplaint && (
          <View>
            <Text style={styles.label}>Chief Complaint</Text>
            <Text style={styles.narrative}>{data.chiefComplaint}</Text>
          </View>
        )}
        {data.additionalNotes && (
          <View>
            <Text style={styles.label}>Additional Notes</Text>
            <Text style={styles.narrative}>{data.additionalNotes}</Text>
          </View>
        )}

        {/* Section 2: Treatment Cards */}
        {data.treatmentCards.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Treatment Cards</Text>
            {data.treatmentCards.map((card) => (
              <View key={card.id} style={{ marginBottom: 12 }} wrap={false}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Helvetica-Bold",
                    }}
                  >
                    {card.title}
                  </Text>
                  <Text
                    style={[
                      styles.badge,
                      {
                        backgroundColor: "#ede9fe",
                        color: "#6d28d9",
                      },
                    ]}
                  >
                    {card.templateType}
                  </Text>
                </View>

                {card.narrativeText && (
                  <Text style={styles.narrative}>{card.narrativeText}</Text>
                )}

                <StructuredTable
                  templateType={card.templateType}
                  structuredData={card.structuredData}
                />

                {card.photos.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    {card.photos.map((photo) => (
                      <View key={photo.id} style={styles.photoContainer}>
                        <Image
                          src={{ data: photo.buffer, format: "png" }}
                          style={styles.photo}
                        />
                        {photo.caption && (
                          <Text style={styles.photoCaption}>
                            {photo.caption}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Section 3: Chart-level photos */}
        {data.chartPhotos.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Clinical Photos</Text>
            {data.chartPhotos.map((photo) => (
              <View key={photo.id} style={styles.photoContainer} wrap={false}>
                <Image
                  src={{ data: photo.buffer, format: "png" }}
                  style={styles.photo}
                />
                {(photo.caption || photo.category) && (
                  <Text style={styles.photoCaption}>
                    {[photo.category, photo.caption].filter(Boolean).join(" — ")}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Section 4: Signatures */}
        <View style={styles.signatureBlock}>
          <Text style={styles.sectionTitle}>Signatures</Text>

          {data.providerSignedBy && (
            <View style={{ marginBottom: 16 }}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>
                {data.providerSignedBy} (Provider)
              </Text>
              {data.providerSignedAt && (
                <Text style={styles.signatureTimestamp}>
                  Signed: {data.providerSignedAt}
                </Text>
              )}
            </View>
          )}

          {data.signedByName && (
            <View style={{ marginBottom: 16 }}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>
                {data.signedByName} (Medical Director / Supervising Physician)
              </Text>
              {data.signedAt && (
                <Text style={styles.signatureTimestamp}>
                  Co-signed: {data.signedAt}
                </Text>
              )}
            </View>
          )}

          {!data.providerSignedBy && !data.signedByName && (
            <View>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>
                {data.providerName} (Provider)
              </Text>
              <Text style={styles.signatureTimestamp}>
                Finalized: {data.finalizedAt || data.encounterStartedAt}
              </Text>
            </View>
          )}
        </View>

        {/* Section 5: Addenda */}
        <View>
          <Text style={styles.sectionTitle}>Addenda</Text>
          {data.addenda.length === 0 ? (
            <Text style={styles.addendumPlaceholder}>
              No addenda recorded.
            </Text>
          ) : (
            data.addenda.map((entry) => (
              <View key={entry.id} style={{ marginBottom: 8, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" }}>
                <Text style={{ fontSize: 8, color: "#6b7280", marginBottom: 2 }}>
                  {entry.createdAt} — {entry.authorName}
                </Text>
                <Text style={styles.narrative}>{entry.text}</Text>
              </View>
            ))
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
          <Text>Generated: {data.generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
