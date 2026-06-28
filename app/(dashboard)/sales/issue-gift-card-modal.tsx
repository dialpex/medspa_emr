"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { issueGiftCardAction } from "@/lib/actions/gift-cards";
import { searchPatients } from "@/lib/actions/invoices";

type Denomination = { id: string; amount: number };

type Props = {
  denominations: Denomination[];
  onClose: () => void;
};

export function IssueGiftCardModal({ denominations, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ formattedCode: string } | null>(null);

  // Amount
  const [amount, setAmount] = useState<number>(denominations[0]?.amount || 50);
  const [customAmount, setCustomAmount] = useState(false);

  // Type
  const [isGift, setIsGift] = useState(false);

  // Patient search (for self-purchase)
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);

  // Gift fields
  const [buyerName, setBuyerName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [giftMessage, setGiftMessage] = useState("");

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setPatientResults([]); return; }
    const results = await searchPatients(q);
    setPatientResults(results);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(patientSearch), 300);
    return () => clearTimeout(timer);
  }, [patientSearch, doSearch]);

  function handleSubmit() {
    setError(null);
    if (amount <= 0) { setError("Amount must be positive"); return; }
    if (!isGift && !selectedPatient) { setError("Please select a patient"); return; }
    if (isGift && !recipientName.trim()) { setError("Recipient name is required"); return; }

    startTransition(async () => {
      const result = await issueGiftCardAction({
        amount,
        isGift,
        buyerPatientId: !isGift ? selectedPatient?.id : undefined,
        buyerName: isGift ? buyerName : undefined,
        recipientName: isGift ? recipientName : undefined,
        recipientEmail: isGift ? recipientEmail || undefined : undefined,
        giftMessage: isGift ? giftMessage || undefined : undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess({ formattedCode: result.data!.formattedCode });
    });
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 text-center">
          <div className="text-4xl mb-4">&#127873;</div>
          <h3 className="text-lg font-semibold mb-2">Gift Card Issued!</h3>
          <div className="font-mono text-2xl font-bold text-purple-700 mb-4">{success.formattedCode}</div>
          <p className="text-sm text-gray-500 mb-6">${amount.toFixed(2)} gift card has been created.</p>
          <button
            onClick={onClose}
            className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Issue Gift Card</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
            <div className="flex flex-wrap items-center gap-2">
              {denominations.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setAmount(d.amount); setCustomAmount(false); }}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                    !customAmount && amount === d.amount
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  )}
                >
                  ${d.amount}
                </button>
              ))}
              <button
                onClick={() => { setCustomAmount(true); setAmount(0); }}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  customAmount
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                Custom
              </button>
              {customAmount && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={amount || ""}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>

          {/* Type toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsGift(false)}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  !isGift ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                For a Patient
              </button>
              <button
                onClick={() => setIsGift(true)}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  isGift ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                Gift to Someone
              </button>
            </div>
          </div>

          {/* Patient search (self-purchase) */}
          {!isGift && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                  <span className="text-sm font-medium">{selectedPatient.name}</span>
                  <button onClick={() => setSelectedPatient(null)} className="text-xs text-purple-600 hover:underline">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => { setPatientSearch(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search patient by name..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                  {showDropdown && patientSearch.length >= 2 && patientResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {patientResults.map((p) => (
                        <li key={p.id}>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            onClick={() => {
                              setSelectedPatient({ id: p.id, name: `${p.firstName} ${p.lastName}` });
                              setPatientSearch("");
                              setShowDropdown(false);
                            }}
                          >
                            {p.firstName} {p.lastName}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Gift fields */}
          {isGift && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From (buyer name)</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To (recipient name) *</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message <span className="text-gray-400 font-normal">(optional, max 500)</span>
                </label>
                <textarea
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value.slice(0, 500))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Happy birthday! Enjoy a treatment on me."
                />
                <div className="text-right text-xs text-gray-400 mt-1">{giftMessage.length}/500</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {isPending ? "Creating..." : `Issue $${amount.toFixed(2)} Gift Card`}
          </button>
        </div>
      </div>
    </div>
  );
}
