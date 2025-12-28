# System Architecture — Real-Time Incident Reporting & Resource Coordination Platform

This document describes the **system architecture and design decisions** behind the real-time incident reporting and coordination platform built for the PROMETEO 2026 Hackathon.

The focus of the system is **signal quality, real-time visibility, and prioritization**, not just raw reporting.

---

## 1. Problem Statement (Architectural View)

During emergencies, time is lost due to:
- Fragmented incident reporting
- Duplicate and false reports
- Poor prioritization of incidents
- Lack of real-time coordination

The goal of this system is to **aggregate incident signals, reduce noise, and surface high-priority incidents in real time** for responders.

---

## 2. Design Principles

- **Signal over noise**: Every report is treated as a signal, not absolute truth
- **Explainable logic**: No black-box decision-making
- **Real-time first**: Push-based updates instead of polling
- **Scalable by design**: Stateless services and horizontal scalability
- **Hackathon-feasible**: Built with proven, reliable technologies

---

## 3. High-Level Architecture

Citizen App ─┐
├──► API Layer ──► Core Services ──► Database
Responder UI ─┘ │ │
└──► WebSocket / Events ◄──┘

yaml
Copy code

The system follows an **event-driven architecture** where every meaningful state change emits a real-time event.

---

## 4. Client Layer

### 4.1 Citizen Application
Responsibilities:
- Submit incident reports
- View nearby incidents
- Confirm or deny incidents

Characteristics:
- Anonymous-first (optional authentication)
- Rate-limited to prevent abuse
- Read-only access to public incident data

### 4.2 Responder / Admin Dashboard
Responsibilities:
- View live incident feed
- Sort incidents by priority
- Update incident status
- Add internal notes

This dashboard is the **primary operational interface**.

---

## 5. API Layer

The backend exposes **stateless HTTP APIs** and **WebSocket connections**.

### API Categories

#### Incident APIs
- `POST /incidents`
- `GET /incidents`
- `PATCH /incidents/:id/status`

#### Verification APIs
- `POST /incidents/:id/vote`

#### Admin APIs
- `PATCH /incidents/:id/verify`
- `POST /incidents/:id/notes`

Each API performs minimal logic and delegates business rules to core services.

---

## 6. Core Backend Services (Logical Separation)

Although implemented in a single backend during the hackathon, services are **logically separated**.

---

### 6.1 Incident Service
Responsibilities:
- Create incidents
- Manage incident lifecycle
- Persist incident data

Flow:
1. Validate request
2. Invoke de-duplication service
3. Persist data
4. Emit real-time event

---

### 6.2 De-duplication & Clustering Service
Purpose:
Reduce duplicate and noisy reports.

Logic:
- Same incident type
- Within a geographic radius (e.g., 300 meters)
- Within a temporal window (e.g., 10 minutes)

Outcome:
- Attach report to an existing incident cluster
- Or create a new incident

---

### 6.3 Verification & Scoring Service
Responsibilities:
- Maintain confidence score
- Process user and admin votes
- Transition incident states

Confidence logic example:
- +10 per confirmation
- -15 per denial
- +5 per additional report

Thresholds:
- Confidence > 60 → VERIFIED
- Confidence < 10 → FALSE

---

### 6.4 Priority Engine
This component determines **which incidents matter most**.

Inputs:
- Severity (1–5)
- Confidence score (0–100)
- Proximity to responders
- Recency

Priority formula:
priority_score = severity × confidence × proximity_factor

yaml
Copy code

The priority score is **computed dynamically**, not stored.

---

## 7. Data Model

### 7.1 Incident Table
Incident
id (UUID)
type
description
latitude
longitude
status (unverified, verified, resolved, false)
severity
confidence_score
report_count
created_at
updated_at

shell
Copy code

### 7.2 Incident Report Table
IncidentReport
id
incident_id
user_id (optional)
media_url (optional)
vote (confirm / deny / neutral)
created_at

markdown
Copy code

This separation allows:
- Auditability
- Multiple reports per incident
- Better false-report handling

---

## 8. Real-Time Event Layer

### Event Types
- `incident_created`
- `incident_updated`
- `incident_verified`
- `incident_resolved`

### Flow
State Change
↓
Event Publisher
↓
WebSocket Server
↓
Subscribed Clients

yaml
Copy code

Failure handling:
- WebSocket reconnect triggers snapshot fetch
- Database remains the source of truth

---

## 9. Scalability Considerations

- Stateless backend services
- Horizontal scaling supported
- WebSocket rooms by region/city
- Read-heavy optimization

### Indexing Strategy
- `(latitude, longitude)` for spatial queries
- `(status, created_at)` for dashboard filtering
- `(type, created_at)` for de-duplication

---

## 10. Caching Layer (Optional)

Redis can be used for:
- Active incident clusters
- Hot incident feeds
- Rate limiting counters

Cache failures do not impact correctness.

---

## 11. Fault Tolerance & Abuse Prevention

- Rate limiting per IP / user
- CAPTCHA for anonymous reports
- Admin-only verification controls
- Graceful degradation if real-time fails

---

## 12. Deployment Architecture

[ CDN ]
↓
[ Frontend (Vercel) ]
↓
[ Backend (Render / Fly.io) ]
↓
[ PostgreSQL ]
↓
[ Redis (optional) ]

yaml
Copy code

The backend remains stateless to allow rapid redeployments and scaling.

---

## 13. Out of Scope (By Design)

- Automated emergency dispatch
- Direct emergency calling
- Machine learning-based classification

These are explicitly deferred to keep the system reliable and explainable.

---

## 14. Summary

This architecture provides:
- Real-time incident visibility
- Noise-resistant reporting
- Explainable prioritization
- Production-style system design
- Hackathon-feasible implementation

The system is intentionally designed to balance **speed, reliability, and clarity** under emergency conditions.
Next strong additions (optional)
If you want, next we can:

Add sequence diagrams (Mermaid) to this markdown

Write API_SPEC.md

Write a judge-friendly README

Convert this into PPT talking points

Just tell me what to tackle next.







