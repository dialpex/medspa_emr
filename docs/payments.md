# Neuvvia Payments

## Architecture

```
Browser (Stripe.js) → Neuvvia API → Stripe Connect (Direct Charges) → Clinic Bank Account
```

- **Direct charges pattern**: Clinic is merchant of record. All PaymentIntents are created with `{ stripeAccount: clinic.stripeAccountId }`.
- Platform collects application fees via `application_fee_amount` on each charge.
- Stripe is invisible infrastructure — UI says "Neuvvia Payments" and "Card", never raw "Stripe".

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Platform's Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Platform's publishable key (client-side) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `APP_URL` | Base URL for return URLs (e.g. `http://localhost:3000`) |
| `PLATFORM_FEE_PERCENT` | Default platform fee % (e.g. `2.5`) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Optional: separate secret for Connect webhooks |

## Local Testing

### Start the dev server
```bash
npm run dev
```

### Forward webhooks with Stripe CLI
```bash
stripe listen --forward-to localhost:3000/api/billing/stripe/webhook
```

Copy the webhook signing secret and set `STRIPE_WEBHOOK_SECRET` in `.env`.

### Test Cards
| Card Number | Behavior |
|-------------|----------|
| `4242424242424242` | Success |
| `4000002500003155` | Requires 3D Secure |
| `4000000000000002` | Decline |
| `4000000000009995` | Insufficient funds |

Use any future expiry date, any 3-digit CVC, any postal code.

## Payment Flow

1. User opens Invoice Modal, selects "Card" payment method
2. Frontend calls `POST /api/billing/stripe/payment-intent` with `{ invoiceId, amount }`
3. Backend creates Stripe PaymentIntent (with connected account), then creates Payment record
4. Frontend renders Stripe Elements form (via `StripeProvider` with `stripeAccount`)
5. User submits card → `stripe.confirmPayment()` → Stripe processes
6. Webhook `payment_intent.succeeded` → updates Payment status, Invoice status
7. If 3DS required: `requires_action` → Stripe handles challenge → webhook on completion

## Saved Cards Flow

1. Patient > Wallet tab > "Add Card" → `POST /api/billing/stripe/setup-intent`
2. Stripe SetupIntent created on connected account
3. User enters card via Stripe Elements → `stripe.confirmSetup()`
4. Webhook `setup_intent.succeeded` → saves card details to `StripePaymentMethod` table
5. On next payment, user selects saved card → `POST /api/billing/stripe/charge-saved`
6. Backend creates PaymentIntent with `payment_method` and `confirm: true`

## Deposit Lifecycle

```
Enable Deposits → Collect Deposit → [Appointment] → Apply to Invoice OR Refund OR Forfeit
```

1. **Enable**: Settings > Billing > Deposits — toggle on, set default amount and policy
2. **Collect**: `POST /api/billing/stripe/deposit` with `{ appointmentId }` — creates PaymentIntent
3. **Apply**: `applyDepositToInvoice(clinicId, depositPaymentId, invoiceId)` — creates offsetting records
4. **Refund**: `refundDeposit(clinicId, depositPaymentId)` — Stripe refund + DB records
5. **Forfeit**: `forfeitDeposit(clinicId, depositPaymentId)` — marks as forfeited (no-show)

Deposit records have `paymentType: "deposit"` and `invoiceId: null` (until applied).

## Webhook Event Matrix

| Event | Handler | DB Updates |
|-------|---------|------------|
| `payment_intent.succeeded` | `handlePaymentIntentSucceeded` | Payment.stripeStatus→succeeded, Invoice status recalc |
| `payment_intent.payment_failed` | `handlePaymentIntentFailed` | Payment.stripeStatus→failed, Payment.failureReason |
| `payment_intent.canceled` | `handlePaymentIntentCanceled` | Payment.stripeStatus→canceled |
| `charge.refunded` | `handleChargeRefunded` | Payment.stripeStatus→refunded/partially_refunded, Invoice status recalc |
| `account.updated` | `handleAccountUpdated` | Clinic stripe fields synced |
| `setup_intent.succeeded` | `handleSetupIntentSucceeded` | StripePaymentMethod created |

All events are idempotent — `StripeWebhookEvent` table tracks processed event IDs.

## Key Files

| File | Purpose |
|------|---------|
| `lib/services/stripe-connect.ts` | Connect onboarding, account sync, customer creation |
| `lib/services/stripe-payments.ts` | PaymentIntent, charge saved card, refund |
| `lib/services/stripe-deposits.ts` | Deposit collection, application, refund, forfeit |
| `lib/services/stripe-webhooks.ts` | Webhook event processing (pure, no Next.js deps) |
| `lib/actions/stripe.ts` | Server Actions for Connect + deposit settings |
| `lib/stripe/validation.ts` | Zod schemas for API input validation |
| `lib/stripe/client.ts` | Stripe SDK singleton |
| `components/stripe/stripe-provider.tsx` | Stripe Elements provider with connected account |
| `components/stripe/checkout-form.tsx` | Payment Element form |
| `components/stripe/save-card-form.tsx` | Save card form (SetupIntent) |

## Known Limitations

- No Stripe Terminal (in-person card readers) support
- No recurring billing / Subscriptions
- No patient self-pay portal (all payments are staff-initiated)
- No multi-currency support (USD only)
- Deposits are manual (no automatic collection at booking time)
