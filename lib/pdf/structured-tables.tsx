/**
 * React-PDF table components for each treatment card type.
 */
import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { styles } from "./pdf-styles";
import {
  parseStructuredData,
  type InjectableData,
  type LaserData,
  type EstheticsData,
} from "@/lib/templates/schemas";

interface TableProps {
  structuredData: string;
}

function TableRow({
  label,
  value,
  alt,
}: {
  label: string;
  value: string;
  alt?: boolean;
}) {
  return (
    <View style={alt ? styles.tableRowAlt : styles.tableRow}>
      <Text style={[styles.tableHeaderCell, { width: "35%" }]}>{label}</Text>
      <Text style={[styles.tableCell, { width: "65%" }]}>{value || "—"}</Text>
    </View>
  );
}

export function InjectableTable({ structuredData }: TableProps) {
  const data = parseStructuredData<InjectableData>("Injectable", structuredData);

  const areasText =
    data.areas?.length > 0
      ? data.areas.map((a) => `${a.areaLabel} (${a.units}u)`).join(", ")
      : "—";

  const lotText =
    data.lotEntries?.length > 0
      ? data.lotEntries
          .map((l) => `${l.lotNumber} (exp: ${l.expirationDate})`)
          .join(", ")
      : "—";

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: "35%" }]}>Field</Text>
        <Text style={[styles.tableHeaderCell, { width: "65%" }]}>Detail</Text>
      </View>
      <TableRow label="Product" value={data.productName} />
      <TableRow label="Areas" value={areasText} alt />
      <TableRow
        label="Total Units"
        value={data.totalUnits ? String(data.totalUnits) : "—"}
      />
      <TableRow label="Lot Info" value={lotText} alt />
      <TableRow label="Outcome" value={data.outcome} />
      <TableRow label="Follow-up" value={data.followUpPlan} alt />
      <TableRow label="Aftercare" value={data.aftercare} />
    </View>
  );
}

export function LaserTable({ structuredData }: TableProps) {
  const data = parseStructuredData<LaserData>("Laser", structuredData);

  const areasText = data.areasTreated?.length
    ? data.areasTreated.join(", ")
    : "—";

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: "35%" }]}>Field</Text>
        <Text style={[styles.tableHeaderCell, { width: "65%" }]}>Detail</Text>
      </View>
      <TableRow label="Device" value={data.deviceName} />
      <TableRow label="Areas" value={areasText} alt />
      <TableRow label="Energy" value={data.parameters?.energy || "—"} />
      <TableRow
        label="Pulse Duration"
        value={data.parameters?.pulseDuration || "—"}
        alt
      />
      <TableRow
        label="Passes"
        value={data.parameters?.passes ? String(data.parameters.passes) : "—"}
      />
      <TableRow label="Outcome" value={data.outcome} alt />
      <TableRow label="Aftercare" value={data.aftercare} />
    </View>
  );
}

export function EstheticsTable({ structuredData }: TableProps) {
  const data = parseStructuredData<EstheticsData>("Esthetics", structuredData);

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: "35%" }]}>Field</Text>
        <Text style={[styles.tableHeaderCell, { width: "65%" }]}>Detail</Text>
      </View>
      <TableRow label="Areas" value={data.areasTreated} />
      <TableRow label="Products" value={data.productsUsed} alt />
      <TableRow label="Skin Response" value={data.skinResponse} />
      <TableRow label="Outcome" value={data.outcome} alt />
      <TableRow label="Aftercare" value={data.aftercare} />
    </View>
  );
}

export function StructuredTable({
  templateType,
  structuredData,
}: {
  templateType: string;
  structuredData: string;
}) {
  switch (templateType) {
    case "Injectable":
      return <InjectableTable structuredData={structuredData} />;
    case "Laser":
      return <LaserTable structuredData={structuredData} />;
    case "Esthetics":
      return <EstheticsTable structuredData={structuredData} />;
    default:
      return null;
  }
}
