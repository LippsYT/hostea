# HOSTEA Implementation Backlog (Execution-Oriented)

## 1) Delivery Strategy

Delivery style: vertical slices by business impact, not by technical layer.

Priority order:
1. Discovery/search correctness
2. Booking and payment reliability
3. Messaging conversion and context
4. Support operations
5. Analytics and optimization

## 2) Epics and Stories

## Epic A - Intelligent Homepage

### A1 - Destination shelves
- Build destination cards with listing/activity counts.
- Route click to filtered search by destination.

Acceptance:
- destination card shows image, name, listing count, activity count
- click always lands on filtered result set

### A2 - Dynamic and curated shelves
- Implement shelf sources:
  - top-rated
  - most-booked
  - new
  - trend
  - hostea picks

Acceptance:
- shelves are deterministic and stable
- admin can pin curated items

## Epic B - Split Search and Occupancy

### B1 - Lodging search
- Inputs: destination, check-in, check-out, occupants.

### B2 - Activity search
- Inputs: destination, date, participants.
- Remove check-out semantics.

### B3 - Participant selector
- adults/children/infants
- compact summary string

Acceptance:
- activity screens never show check-out
- participant split persists across flow

## Epic C - Publication Model (Global)

### C1 - Structured location
- Enforce fields:
  - country
  - region
  - city
  - zone
  - exact address

### C2 - Lodging publish flow validation
- No publish without structured location and required media/pricing.

### C3 - Activity publish flow validation
- Add activity-specific fields and age rules.

Acceptance:
- no free-text-only city publish
- all published objects have location hierarchy

## Epic D - Activity Commerce

### D1 - Reservation mode support
- `instant` and `inquiry` modes per activity.

### D2 - Activity booking flow
- date + time + participants + quote + payment.

### D3 - Inquiry flow to message thread
- thread is contextual to activity and user pair.

Acceptance:
- `inquiry` mode never opens direct charge
- `instant` mode supports direct payment and confirmation

## Epic E - Messaging Conversion Engine

### E1 - Contextual threads
- Thread must expose:
  - source type
  - source object name
  - booking/payment state

### E2 - Inbox filters
- all, lodgings, activities, unread, inquiries, confirmed, pending payment, risk, unanswered.

### E3 - Offers by context
- lodging offer:
  - check-in/out
  - guests
- activity offer:
  - date/time
  - participants

Acceptance:
- no check-out fields in activity thread context
- all threads can be traced to source publication

## Epic F - Support Operations

### F1 - User support center
- ticket creation with guided categories
- attachments support
- state tracking

### F2 - Agent console
- queue
- filters
- timeline
- notes
- escalation actions

### F3 - Linked context
- ticket can be linked to reservation/payment/thread/listing/experience.

Acceptance:
- opening ticket from booking auto-populates context
- ticket timeline preserves actor + timestamp + action trail

## Epic G - Financial and Dispute Actions

### G1 - Refund operations
- full/partial refund action with reason logging.

### G2 - Payout hold during dispute
- admin can pause payout when an active dispute exists.

### G3 - Auditability
- write audit events for all financial/support decisions.

Acceptance:
- all sensitive actions produce auditable event records

## Epic H - Metrics and SLA

### H1 - Support metrics
- first response time
- resolution time
- by category/priority

### H2 - Marketplace metrics
- conversion rates
- issue rates by listing/experience/host

Acceptance:
- dashboard reflects near-real-time operational states

## 3) API Boundaries (Recommended)

Public:
- `GET /api/search/lodgings`
- `GET /api/search/activities`
- `GET /api/destinations/featured`
- `GET /api/shelves/:slug`

Host:
- `POST /api/host/listings`
- `POST /api/host/experiences`
- `PUT /api/host/experiences/:id/mode`
- `POST /api/host/offers`
- `GET /api/host/messages/threads`

Client:
- `POST /api/reservations/lodgings/checkout`
- `POST /api/reservations/activities/checkout`
- `POST /api/inquiries`
- `GET /api/client/bookings`
- `POST /api/support/tickets`

Support/Admin:
- `GET /api/admin/support/tickets`
- `POST /api/admin/support/tickets/:id/escalate`
- `POST /api/admin/payments/:id/refund`
- `POST /api/admin/payouts/:id/hold`
- `POST /api/admin/featured/:type`

## 4) Database Changes (Suggested)

New/extended fields:
- `Listing`: structured location ids/slugs
- `Experience`: structured location ids/slugs + mode + age rules
- `MessageThread`: `sourceType`, `listingId`, `experienceId`, `reservationId`, `experienceBookingId`, `riskScore`
- `Ticket`: contextual linkage fields + SLA fields
- `Offer`: separate lodging/activity context fields
- `FeaturedPlacement`: curation metadata

Performance indexes:
- location slugs
- booking status + date
- message thread status + unread
- ticket priority + status + sla_due_at

## 5) Acceptance Gates

Release gate 1:
- search split by vertical complete
- no check-out in activity flows
- structured location mandatory

Release gate 2:
- inquiry and instant activity modes complete
- contextual messaging complete

Release gate 3:
- support queue with escalations and evidence complete
- financial dispute controls complete

Release gate 4:
- curated homepage shelves complete
- support and marketplace KPI dashboards complete

## 6) Operational Safety

Must-have controls:
- strict RBAC for support/finance actions
- RLS enforced for client-facing access
- service role only for privileged operations
- idempotent payment confirmation handlers
- deduplicated automation dispatching

## 7) Recommended Sprint Sequence

Sprint 1:
- structured location model
- search split
- participant selector

Sprint 2:
- homepage shelf engine + curated module
- activity mode split

Sprint 3:
- contextual messaging + offer adaptations
- inquiry-to-booking flow hardening

Sprint 4:
- support center + agent queue + ticket links
- evidence and SLA

Sprint 5:
- financial dispute actions + audit coverage
- KPI dashboards

