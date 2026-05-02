# AURA Fitness Club — Hour-by-Hour Replit Prompts

## Usage Notes
- Paste one prompt at a time.
- Do not skip the planning phase.
- After each big block, inspect output before continuing.
- If Agent goes off-scope, restate the current hour objective and continue.

## Hour 0 — Setup the context
```text
Read `replit.md` and `docs/source-ts.md` completely.
Do not code yet.
Summarize the project in terms of:
- final architecture
- core modules
- what must be fully implemented today
- what should be integration-ready today
- major technical risks
Then create a detailed implementation plan and wait for approval.
```

## Hour 1 — Lock the technical plan
```text
Refine the plan into a concrete build order with:
- repo structure
- packages/apps
- database strategy
- auth and RBAC approach
- domain module boundaries
- admin page map
- API route map
- shared schema strategy
Then wait for approval before coding.
```

## Hour 2 — Build the foundation
```text
Implement the full project foundation now:
- repo structure
- admin app
- API app
- shared packages
- database package
- environment example files
- auth
- RBAC
- audit log base
- settings/business rules base
Use a modular monolith approach.
After implementation, run checks and summarize what was created.
```

## Hour 3 — Database and seeds
```text
Now create the core database schema and seed data.
Include at least:
- users
- roles / permissions
- members
- plans
- memberships
- invoices
- payments
- access points
- access logs
- class types
- class sessions
- bookings
- staff basics
- products
- orders / pos basics
- notification templates
- audit logs
Add realistic seed/demo data.
Then summarize the schema.
```

## Hour 4 — Members / CRM
```text
Implement the Members / CRM module end-to-end.
Include:
- members list page
- member detail page
- create/edit forms
- search and filters
- status management
- membership linkage
- timeline/activity skeleton
- API endpoints and validation
Then test and summarize gaps.
```

## Hour 5 — Plans and memberships
```text
Implement plans and memberships end-to-end.
Include:
- plans CRUD
- memberships CRUD / assignment
- lifecycle states: active, frozen, expired, cancelled
- expiration handling basics
- admin pages and APIs
Make the flows usable from the member profile.
Then summarize what works.
```

## Hour 6 — Billing and invoice flows
```text
Implement billing core.
Include:
- invoices list and detail
- create invoice flow
- payment records
- cash payment recording
- manual transfer proof flow for Baridimob-style confirmation
- payment status handling
- admin filters and summaries
Then run checks and fix obvious issues.
```

## Hour 7 — Access control
```text
Implement access control basics end-to-end.
Include:
- QR token generation per member
- access verification endpoint
- allow/deny decision with reason
- access log creation
- access point entities
- basic time-rule checks
- admin page for access logs
Do not attempt real NFC hardware integration yet.
```

## Hour 8 — Dashboard pass 1
```text
Build the admin dashboard using real data queries.
Show at least:
- members total
- active memberships
- expiring soon
- daily revenue
- payment status summary
- today's access count
- recent activity
Use real seeded data.
```

## Hour 9 — Classes and bookings
```text
Implement classes and bookings.
Include:
- class types
- sessions
- bookings
- capacity control basics
- waitlist basics
- attendance basics
- admin pages and APIs
Keep it practical and consistent with existing modules.
```

## Hour 10 — Notifications
```text
Implement notifications basics.
Include:
- notification templates
- event-driven notification records
- preferences-ready structure
- admin management pages
- trigger examples for membership expiry, booking confirmation, payment confirmation
External delivery integrations can stay mocked/integration-ready.
```

## Hour 11 — Staff and roles expansion
```text
Expand staff operations.
Include:
- staff accounts view
- role assignment UI
- shift basics
- trainer notes placeholder-ready model if useful
- audit visibility for sensitive actions
Make sure permissions remain enforced.
```

## Hour 12 — Store / POS basics
```text
Implement store and POS basics.
Include:
- products CRUD
- inventory movement basics
- POS order creation
- linking orders to members where relevant
- simple sales reporting widgets
Keep the scope basic but real.
```

## Hour 13 — Reporting
```text
Implement reporting pages with real queries.
At minimum:
- revenue report
- membership status report
- attendance/access report
- bookings report
- product sales summary
Structure pages so exports can be added later.
```

## Hour 14 — Settings and business rules
```text
Implement settings and business rules pages.
Include:
- club profile settings
- configurable business rules
- language/branding placeholders
- audit log browsing
- security/admin settings basics
Keep changes typed and validated.
```

## Hour 15 — Loyalty if time allows
```text
If the current codebase is stable, implement loyalty basics.
Include:
- points rules
- rewards
- simple member points ledger
- admin management pages
If not stable, skip loyalty and spend this hour on bug fixing instead.
```

## Hour 16 — Member-facing web shell
```text
Create a minimal member-facing responsive web shell or portal.
Include:
- login
- membership status
- QR access view
- bookings view
- payment history view
- profile basics
Do not overdesign it; keep it functional.
```

## Hour 17 — Whole-project bug sweep 1
```text
Now audit the entire project.
Find and fix:
- type errors
- broken imports
- failing pages
- schema mismatches
- inconsistent naming
- missing validation
- poor loading/error states
Then summarize every fix made.
```

## Hour 18 — UX cleanup
```text
Improve usability across the admin flows.
Focus on:
- navigation clarity
- table usability
- forms
- status badges
- empty states
- validation messages
- consistent layout
No major redesign; improve clarity and consistency.
```

## Hour 19 — Demo data and scenario testing
```text
Strengthen demo readiness.
Add realistic demo accounts, members, plans, invoices, access logs, classes, bookings, products, and reports.
Then walk through the major flows and fix issues that block a realistic gym demo.
```

## Hour 20 — Whole-project bug sweep 2
```text
Perform another deep QA pass.
Focus on cross-module integration issues:
- member to membership flows
- billing to membership flows
- access to membership status flows
- booking permissions
- dashboard/report query correctness
Then fix everything high impact.
```

## Hour 21 — Documentation
```text
Write project documentation.
Include:
- how to run the project
- env variables
- repo structure
- implemented modules
- pending integrations
- demo accounts
- next recommended steps
```

## Hour 22 — Deployment readiness
```text
Prepare the project for easy continuation.
Add:
- clean scripts
- env example
- seed instructions
- migration instructions
- startup notes
- TODO list grouped by module
Do not overcomplicate deployment.
```

## Hour 23 — Final hardening
```text
Review the whole codebase one final time.
Prioritize reliability and consistency.
Fix any last major issues, remove dead code, and ensure the core demo flows work.
Then produce a final project status summary with completed modules, partial modules, and remaining work.
```

## Recovery Prompt — If Agent drifts or degrades
```text
Stop. Re-read `replit.md` and align with the execution plan.
You are drifting from the agreed scope.
Return to the current milestone only, keep existing working code stable, and continue from there.
Before coding, summarize exactly what you will change in this step.
```

## Recovery Prompt — If code gets messy
```text
Pause feature work.
Refactor only for stability and consistency.
Unify naming, remove duplication, fix type issues, and preserve behavior.
Do not introduce new features in this pass.
```
