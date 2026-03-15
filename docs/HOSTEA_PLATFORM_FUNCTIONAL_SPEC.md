# HOSTEA Platform Functional Specification

## 1) Product Architecture (Functional)

HOSTEA is a multi-vertical travel platform with two core marketplaces:
- Lodgings (`Alojamientos`)
- Activities (`Actividades`)

The platform is organized into 6 domains:

1. Discovery
- Homepage, destination pages, featured shelves, search, SEO landing pages.

2. Inventory
- Listing and activity publication, media, availability, booking rules, age rules, location model.

3. Commerce
- Quotes, reservation flows, offers, payment orchestration, cancellation/refund policy execution, payouts.

4. Messaging
- Contextual threads, quick replies, automations, risk detection, inquiry-to-booking conversion.

5. Support
- Ticketing, evidence, SLA, escalation, dispute handling, resolution timeline.

6. Operations/Admin
- User governance, moderation, curation, finance oversight, analytics, audit controls.

Core platform principle:
- Lodging and Activity share identity, messaging, support, and payment orchestration.
- Lodging and Activity keep separate reservation semantics and UI language.

## 2) System Modules

1. Intelligent Homepage
2. Lodging Search
3. Activity Search
4. Lodging Publication
5. Activity Publication
6. Reservation Engine
7. Checkout/Payment Engine
8. Messaging & Offer Engine
9. Support/Ticketing Engine
10. Host Workspace
11. Client Workspace
12. Admin Workspace
13. Curation/Featured Engine
14. Notification/Automation Engine
15. Analytics & Reporting

## 3) Screens by User Type

### Public (Unauthenticated)
- Home (`/`)
- Lodging search results (`/search`)
- Activity search results (`/explorar`)
- Lodging detail (`/listings/:id`)
- Activity detail (`/explorar/:id`)
- Legal pages
- Help center / FAQ

### Client
- Dashboard summary
- Active reservations
- Reservation history
- Activity bookings
- Messages
- Payments/invoices
- Support tickets
- Profile/security

### Host
- Host dashboard (KPI + conversion + operational queue)
- Listings: create/edit/pause/delete
- Activities: create/edit/pause/delete
- Calendar: lodgings
- Calendar: activities
- Reservations queue
- Message inbox + quick replies + automations
- Offers
- Payouts/finance
- Metrics
- Support

### Admin/Support Agent
- Operational cockpit
- User management
- Listing/activity moderation
- Featured curation
- Reservation/payment oversight
- Support inbox with SLA and escalation
- Dispute/refund control
- Financial operations and payout controls
- Audit logs

## 4) Primary User Flows

### 4.1 Lodging Instant Booking
1. Search with destination + check-in/out + guests.
2. Open listing detail.
3. Quote breakdown.
4. Checkout.
5. Payment success via webhook.
6. Reservation confirmed.
7. Confirmation email + invoice.
8. Reservation appears in client/host dashboards.

### 4.2 Lodging Inquiry / Approval Mode
1. User sends booking request.
2. Host receives thread + request card.
3. Host approves/rejects.
4. On approve, payment window is opened.
5. Payment confirms reservation.

### 4.3 Activity Instant Booking
1. Search by destination + date + participants.
2. Open activity detail.
3. Select date/time + participant split.
4. Checkout.
5. Payment success via webhook.
6. Activity booking confirmed.

### 4.4 Activity Inquiry-Only
1. User opens inquiry from activity detail.
2. Contextual message thread is created.
3. Host responds and may send an offer.
4. User accepts and pays.
5. Booking confirmed.

### 4.5 Support Case Lifecycle
1. User opens ticket from reservation, activity booking, or generic support.
2. System classifies category + priority.
3. Agent responds and gathers evidence.
4. If needed, escalates and executes financial/operational action.
5. Case resolved and closed with reason summary.

## 5) Data Model (Suggested)

## 5.1 Core Entities
- `User`
- `Profile`
- `Role`, `Permission`, `UserRole`
- `Listing`
- `ListingPhoto`
- `Experience` (Activity)
- `ExperiencePhoto`
- `Reservation` (lodging booking)
- `ExperienceBooking` (activity booking)
- `Payment`
- `Payout`
- `Review`

### 5.2 Messaging Entities
- `MessageThread`
- `MessageThreadParticipant`
- `Message`
- `Offer`
- `HostQuickReply`
- `HostMessageAutomation`
- `MessageRiskFlag`

### 5.3 Support Entities
- `Ticket`
- `TicketMessage`
- `TicketAttachment`
- `TicketInternalNote`
- `TicketEscalation`
- `SupportTemplate`

### 5.4 Discovery/Curation
- `Destination`
- `FeaturedPlacement`
- `RankingSnapshot`

### 5.5 Geography
- `Country`
- `Region`
- `City`
- `Zone`

### 5.6 Availability
- `CalendarBlock`
- `CalendarHold`
- `ExperienceScheduleSlot`
- `ExperienceAvailabilitySlot`

## 6) Key Relationships

- A `User` can be guest, lodging host, activity host, support agent, admin (via role mapping).
- `Listing` belongs to one host.
- `Experience` belongs to one host.
- `Reservation` belongs to one listing + one guest.
- `ExperienceBooking` belongs to one experience + one guest.
- `Payment` belongs to one reservation or one experience booking.
- `MessageThread` always carries one context:
  - lodging
  - activity
  - support
- `Ticket` can link to reservation, activity booking, listing, experience, payment, and message thread.

## 7) Business Logic Rules

1. Reservation confirmation never depends on success page rendering.
2. Payment confirmation must happen server-side (webhook or equivalent trusted backend event).
3. Offer expiration is mandatory.
4. Holds expire automatically.
5. Activity flow never uses `check-out`.
6. Location model is mandatory and structured:
  - country
  - region
  - city
  - zone
  - exact address
7. Age filtering applies both at search time and at booking validation.
8. Risk signals in messaging must not auto-ban users; they must create operational flags.

## 8) Validation Matrix

### Lodgings
- check-in cannot be in the past
- check-out must be after check-in
- guests <= capacity
- booking blocked if conflicting confirmed booking or hold

### Activities
- date cannot be in the past
- selected slot must exist and have capacity
- participant ages must satisfy activity rules
- no check-out fields rendered or persisted

### Publication
- location hierarchy required
- at least one image
- pricing required
- availability mode required

### Messaging
- thread must carry source context and object id
- one active inquiry thread per same guest+host+object unless explicitly archived

### Support
- ticket category and priority required
- linked context should auto-populate when opened from reservation/booking

## 9) Automation Recommendations

1. Featured/ranking generation jobs (hourly/daily).
2. Auto-priority for support cases near check-in.
3. Keyword risk scoring in messages:
  - "pagar directo"
  - "por fuera"
  - "transferencia"
  - "whatsapp"
4. Auto-reminders for host response SLA.
5. Auto-escalation when SLA threshold is exceeded.
6. Offer expiration and hold cleanup jobs.
7. Lifecycle notifications:
  - inquiry received
  - booking confirmed
  - pre check-in reminder
  - post check-out follow-up

## 10) UX Requirements

1. Clear visual differentiation:
- Lodging cards and booking widgets
- Activity cards and booking widgets

2. Homepage shelves:
- consistent card sizing
- editorial sections
- no random list behavior

3. Messaging:
- fixed context header
- status chips
- risk indicators
- fast insert of quick replies via modal

4. Support:
- urgency badges
- case timeline
- participant and action attribution (who did what and when)
- one-screen agent workflow (queue + details + actions)

## 11) Risks / Sensitive Areas

1. Mixing `Reservation` and `ExperienceBooking` into one model will introduce high complexity and regressions.
2. Activity subtype `Shows` requires dedicated inventory strategy (sector/seat/table).
3. Unstructured location text breaks search quality and upsell matching.
4. Support actions that affect payouts/refunds require strong audit and RBAC controls.
5. Over-aggressive risk keyword automation can produce false positives.

## 12) Scalability Considerations

1. Use materialized ranking tables for homepage shelves.
2. Use denormalized location slugs for fast filtering.
3. Keep write model normalized; expose read models for high-traffic pages.
4. Queue automations and non-critical notifications.
5. Add observability for:
- conversion funnel by vertical
- support SLA
- payment reconciliation

## 13) Phased Roadmap

### Phase 1 - Foundation
- location hierarchy
- split search flows
- participant selector by age groups
- homepage shelf engine + curated featured

### Phase 2 - Activity Commerce
- full activity publication model
- instant vs inquiry mode
- activity booking checkout
- messaging context hardening

### Phase 3 - Support Operations
- full support inbox
- SLA, escalation, templates, evidence
- reservation/payment-linked tickets

### Phase 4 - Host/Client Maturity
- host analytics and operational dashboard
- client unified reservation/booking timeline
- better conversion tools (offers, reminders, templates)

### Phase 5 - Advanced Inventory & Scale
- show/seat inventory model
- advanced recommendation
- global expansion hardening
- performance and reliability tuning

