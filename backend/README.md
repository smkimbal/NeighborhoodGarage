# Live backend implementation contract

This directory is a scaffold, not an operating backend. The demo includes no real payments, coverage, image recognition, background removal, identity checks or remote messaging. GitHub Pages cannot run a server. Host the API separately, then set the public HTTPS base URL in config.js. No frontend refactor is required: DemoEngine and LiveEngine expose identical methods.

## Endpoints

All endpoints return JSON. Amounts in the frontend state are dollar numbers; persist and calculate amounts using integer cents on the server. Map the database model to the frontend state contract in src/engine.js.

| Method / path | Request | Response / required enforcement |
| --- | --- | --- |
| GET /state | Session cookie | {credits, tools, rentals, messages, reviews}; only authorized data, photos as short-lived signed URLs |
| POST /tools | title, category, description, condition, rate, deposit, photo | Tool; owner from session; validate photo, prices and text |
| POST /scans | photo, scenario | {title, category, deposit, condition, damage, part, serial, background}; ignore demo scenario in live mode; compare baseline for authenticated rental; extend with rentalId before production |
| POST /rentals | toolId, days, idempotencyKey | Rental; lock tool, check availability, compute authoritative quote, charge/authorize using provider, append debit ledger |
| POST /rentals/:id/pickup | code | Rental; renter-only, reserved -> out, validate label |
| POST /rentals/:id/return | code, method, photo, assessment | Rental; renter-only, out -> review; disregard client assessment and compute on server |
| POST /rentals/:id/approve | {} | Rental; owner-only, review -> complete; transactional, idempotent deposit ledger entry |
| POST /rentals/:id/dispute | {} | Rental; owner-only, review -> disputed; retain escrow |
| POST /messages | peer, text | Result; resolve peer to authorized user ID on server; encrypt and authorize conversation |
| POST /rentals/:id/reviews | rating, text | Result; renter-only, one review per completed rental |

Production integration should replace display-name peer addressing with server-issued stable user IDs and supply authenticated profile data instead of the demo profile. Add availability dates, actual provider-backed payments, support resolution, consented pickup addresses, identity onboarding, configurable insurance terms and cancellation/refund rules before real operation.

## Security architecture

Use PostgreSQL with a Node API, or Supabase with server functions. schema.sql enables RLS and intentionally supplies no permissive policies. Add tested policies allowing owners to manage only their tools, renters/owners to see their own rentals, chat participants to read their conversations, and users to see only their own credit ledger. The public catalog must expose approximate locations only. Never expose a service-role key to Pages.

Authenticate using Secure, HttpOnly cookies with a deliberate SameSite configuration. Restrict CORS to https://smkimbal.github.io, check Origin and CSRF tokens/custom-header preflight, rate-limit writes and bound request sizes. Use TLS. Third-party cookie restrictions may require a same-site custom domain or a reviewed PKCE token approach with tokens held in memory, not localStorage.

Envelope-encrypt profile/contact fields and chat bodies with authenticated encryption and per-record nonces, backed by a KMS-held key. The ciphertext columns are placeholders, not encryption by themselves. Keep original and processed photos in private object storage, strip EXIF, validate decoded image types and size, and use short-lived signed URLs. Production uploads should use signed upload endpoints with server-side validation; the adapter currently sends compressed data URLs for a simple integration contract.

Payments and credits must be authoritative, transactional, auditable and idempotent. Never trust client prices, scan results, owner identity, credit balances or return approval. Lock the rental and ledger within one transaction. Unique refund keys and one-active-rental index prevent duplicate refunds and double booking. Verify payment webhooks before applying credit. Do not permit the database owner to bypass application authorization accidentally.

Realtime: use authenticated WebSocket/SSE or Supabase Realtime with participant-scoped authorization. The current UI refreshes on navigation/send; add a service subscription method and event callback for pushed remote messages. Demo storage events sync open tabs only. Offline demo mutations are single-browser simulation, not a secure multi-user ledger.

Real wear verification needs baseline and return image capture, tool identity checks, a validated comparison model, confidence/uncertainty reporting, human owner concurrence and an appeal process. Do not automatically charge for suspected damage. Disputed deposits require an authenticated support resolution endpoint, deliberately not implemented here.
