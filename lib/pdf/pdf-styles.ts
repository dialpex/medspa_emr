/**
 * @react-pdf/renderer StyleSheet definitions for encounter PDF export.
 */
import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
  },

  // Header
  header: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d8",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 10,
    color: "#6b7280",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  headerBadge: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },

  // Sections
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  // Tables
  table: {
    marginVertical: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: "#fafafa",
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tableCell: {
    fontSize: 9,
  },

  // Narrative
  narrative: {
    fontSize: 10,
    lineHeight: 1.5,
    marginVertical: 4,
    color: "#374151",
  },

  // Photos
  photoContainer: {
    marginVertical: 8,
  },
  photo: {
    maxWidth: 400,
    objectFit: "contain",
  },
  photoCaption: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 2,
  },

  // Signatures
  signatureBlock: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#d4d4d8",
  },
  signatureLine: {
    width: 250,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    marginTop: 30,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  signatureTimestamp: {
    fontSize: 8,
    color: "#6b7280",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9ca3af",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },

  // Utility
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  label: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    marginBottom: 1,
  },
  value: {
    fontSize: 10,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    gap: 20,
  },
  col: {
    flex: 1,
  },
  addendumPlaceholder: {
    fontSize: 10,
    color: "#9ca3af",
    fontStyle: "italic",
    marginTop: 4,
  },
});
