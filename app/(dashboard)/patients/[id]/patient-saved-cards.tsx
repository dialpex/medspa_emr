"use client";

import { useState, useEffect, useCallback } from "react";
import { CreditCard, Plus, Trash2, Loader2 } from "lucide-react";
import { SaveCardForm } from "@/components/stripe/save-card-form";

type SavedCard = {
  id: string;
  stripePaymentMethodId: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  isDefault: boolean;
};

type Props = {
  patientId: string;
  stripeAccountId: string;
};

const BRAND_DISPLAY: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  diners: "Diners",
  jcb: "JCB",
  unionpay: "UnionPay",
};

export function PatientSavedCards({ patientId, stripeAccountId }: Props) {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch(`/api/billing/stripe/payment-methods?patientId=${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setCards(data);
      }
    } catch {
      // Silently fail — cards section is non-critical
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  async function handleRemove(cardId: string) {
    setRemovingId(cardId);
    try {
      const res = await fetch(`/api/billing/stripe/payment-methods/${cardId}`, { method: "DELETE" });
      if (res.ok) {
        setCards((prev) => prev.filter((c) => c.id !== cardId));
      }
    } catch {
      // Silently fail
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-4 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Saved Cards</h4>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
        >
          <Plus className="size-3.5" /> Add Card
        </button>
      </div>

      {cards.length === 0 && !showAddForm && (
        <p className="text-sm text-gray-400">No saved cards</p>
      )}

      {cards.map((card) => (
        <div key={card.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <CreditCard className="size-5 text-gray-400" />
            <div>
              <div className="text-sm font-medium text-gray-900">
                {BRAND_DISPLAY[card.cardBrand || ""] || card.cardBrand || "Card"} **** {card.cardLast4}
              </div>
              {card.cardExpMonth && card.cardExpYear && (
                <div className="text-xs text-gray-500">
                  Expires {String(card.cardExpMonth).padStart(2, "0")}/{card.cardExpYear}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => handleRemove(card.id)}
            disabled={removingId === card.id}
            className="text-gray-400 hover:text-red-500 disabled:opacity-50"
          >
            {removingId === card.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </button>
        </div>
      ))}

      {showAddForm && (
        <div className="rounded-lg border border-gray-200 p-4">
          <SaveCardForm
            patientId={patientId}
            stripeAccountId={stripeAccountId}
            onSuccess={() => {
              setShowAddForm(false);
              fetchCards();
            }}
            onError={() => {}}
          />
        </div>
      )}
    </div>
  );
}
