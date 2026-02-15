"use client";

import { X } from "lucide-react";
import type { ClinicInfo } from "@/lib/actions/invoices";

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

type Props = {
  clinic: ClinicInfo;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  items: LineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  onClose: () => void;
};

// All styles are inline so the invoice renders identically in print
const font = "Georgia, 'Times New Roman', serif";

export function InvoicePreview({
  clinic,
  invoiceNumber,
  date,
  patientName,
  patientEmail,
  patientPhone,
  items,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  onClose,
}: Props) {
  const clinicAddress = [clinic.address, clinic.city, clinic.state, clinic.zipCode]
    .filter(Boolean)
    .join(", ");

  const initials = clinic.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handlePrint() {
    const el = document.getElementById("invoice-print-area");
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoiceNumber}</title><style>@media print { @page { margin: 0.5in; } body { margin: 0; } }</style></head><body>${el.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16, overflowY: "auto" }}>
      <div style={{ position: "relative", margin: "32px 0", width: "100%", maxWidth: 816 }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{ position: "absolute", top: -12, right: -12, zIndex: 10, width: 32, height: 32, borderRadius: "50%", background: "#fff", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
        >
          <X size={16} color="#6b7280" />
        </button>

        {/* Printable invoice */}
        <div id="invoice-print-area" style={{ fontFamily: font, background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", color: "#1f2937" }}>
          {/* Top accent */}
          <div style={{ height: 3, background: "linear-gradient(to right, #e5e7eb, #d1d5db, #e5e7eb)" }} />

          <div style={{ padding: "48px 64px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 48 }}>
              <div>
                <h1 style={{ fontSize: 36, fontWeight: 300, fontStyle: "italic", color: "#374151", letterSpacing: "0.05em", margin: 0 }}>Invoice</h1>
              </div>
              <div style={{ textAlign: "right" }}>
                {clinic.logoUrl ? (
                  <img src={clinic.logoUrl} alt={clinic.name} style={{ height: 64, width: "auto", marginLeft: "auto", marginBottom: 8, objectFit: "contain", display: "block" }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto", marginBottom: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: "#6b7280", letterSpacing: "0.1em" }}>{initials}</span>
                  </div>
                )}
                <p style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>{clinic.name}</p>
              </div>
            </div>

            {/* Issued To + Details */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8, margin: "0 0 8px 0" }}>Issued To</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", margin: "0 0 2px 0" }}>{patientName || "—"}</p>
                {patientEmail && <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 2px 0" }}>{patientEmail}</p>}
                {patientPhone && <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{patientPhone}</p>}
              </div>
              <div style={{ textAlign: "right", fontSize: 13, color: "#4b5563" }}>
                <p style={{ margin: "0 0 4px 0" }}><span style={{ color: "#9ca3af" }}>Number:</span> {invoiceNumber}</p>
                <p style={{ margin: 0 }}><span style={{ color: "#9ca3af" }}>Date:</span> {date}</p>
              </div>
            </div>

            {/* Line items */}
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginBottom: 32 }}>
              <thead>
                <tr style={{ borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.15em", textTransform: "uppercase", width: 56 }}>Qty</th>
                  <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.15em", textTransform: "uppercase" }}>Description</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.15em", textTransform: "uppercase", width: 100 }}>Price</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.15em", textTransform: "uppercase", width: 100 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={`item-${item.description}-${i}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px", color: "#4b5563" }}>{item.quantity}</td>
                    <td style={{ padding: "12px 16px", color: "#1f2937" }}>{item.description}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#4b5563" }}>${item.unitPrice.toFixed(2)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#1f2937" }}>${(item.quantity * item.unitPrice).toFixed(2)}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No items</td>
                  </tr>
                )}
                {items.length > 0 && items.length < 4 && (
                  <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td colSpan={4} style={{ padding: "12px 16px" }}>&nbsp;</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 48 }}>
              <div style={{ width: 256, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#6b7280" }}>
                  <span>Sub total</span>
                  <span style={{ color: "#1f2937" }}>${subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#6b7280" }}>
                  <span>Discount</span>
                  <span style={{ color: "#1f2937" }}>${discountAmount.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#6b7280" }}>
                  <span>Taxes</span>
                  <span style={{ color: "#1f2937" }}>${taxAmount.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                  <span style={{ fontWeight: 700, color: "#1f2937", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Total Amount</span>
                  <span style={{ fontWeight: 700, color: "#111827", fontSize: 16 }}>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Thank you */}
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 28, fontStyle: "italic", color: "#9ca3af", fontWeight: 300, margin: 0 }}>Thank you!</p>
            </div>

            {/* Footer */}
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, textAlign: "center", fontSize: 11, color: "#9ca3af" }}>
              <p style={{ margin: "0 0 2px 0" }}>
                {clinic.name}
                {clinicAddress && ` — ${clinicAddress}`}
                {clinic.phone && ` — ${clinic.phone}`}
              </p>
              {clinic.email && <p style={{ margin: "0 0 2px 0" }}>{clinic.email}</p>}
              {clinic.website && <p style={{ margin: 0 }}>{clinic.website}</p>}
            </div>
          </div>
        </div>

        {/* Print button */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button
            onClick={handlePrint}
            style={{ borderRadius: 8, background: "#111827", padding: "8px 24px", fontSize: 14, fontWeight: 500, color: "#fff", border: "none", cursor: "pointer" }}
          >
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
