"use client";

import { useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  clientSecret: string;
  stripeAccountId: string;
};

export function StripeProvider({ children, clientSecret, stripeAccountId }: Props) {
  const stripePromise = useMemo(
    () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "", { stripeAccount: stripeAccountId }),
    [stripeAccountId]
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#7c3aed",
            borderRadius: "8px",
          },
        },
      }}
      key={clientSecret}
    >
      {children}
    </Elements>
  );
}
