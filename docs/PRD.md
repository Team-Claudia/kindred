# Kindred — Product Requirements Document (PRD)

## 1. Product Overview

**Product name:** Kindred
**Platform:** Mobile app — iOS/Android
**Product stage:** MVP / validation stage
**Launch market:** Canada (see **37. Technical and Non-Functional Requirements**)
**Primary user:** Working adults who share unpaid caregiving responsibilities for an aging parent, spouse, or other family member with siblings, partners, or relatives.

### Product Vision

> **Kindred helps families coordinate care without forcing them to abandon the tools they already use.**

Kindred gives families one shared place to understand what needs to happen, who is responsible, who is available, and what everyone needs to know.

Kindred acts as a coordination layer across existing behaviours and tools:

- **Kindred** owns task ownership, acceptance, handoffs, caregiving context, and shared visibility.
- **Connected calendar apps** (e.g., Google Calendar) remain the source of personal availability and scheduling.
- **The family's messaging app** (e.g., WhatsApp) remains a familiar communication channel for the family.

The goal is to make shared caregiving feel coordinated rather than chaotic.

---

## 2. Problem Statement

> A working adult who shares caregiving responsibilities with family members struggles to keep everyone aligned when appointments, tasks, or changes in care occur because responsibilities, availability, and information are scattered across messaging apps (e.g., WhatsApp), calendars, phone calls, and individual family members. Today they manually message one another, check separate calendars, and rely on people to pass information along, which costs them time and creates the risk of missed appointments, duplicated work, and important information being lost.

**Short Version**

> We believe working family caregivers experience coordination breakdowns when responsibility or care information moves between family members because there is no single, trusted view of who is doing what, who has actually agreed to do it, who is available, and what has changed.

---

## 3. Product Goals

Kindred should help families:

1. Know what caregiving responsibilities are coming up.
2. Know who is responsible for each task or appointment.
3. Distinguish between someone being **asked** to take responsibility and someone who has **accepted** it.
4. See who may be available when help or coverage is needed.
5. Reduce missed or duplicated caregiving responsibilities.
6. Share important information after appointments.
7. Transfer responsibility quickly when someone's availability changes.
8. Coordinate without exposing unnecessary personal calendar information.
9. Continue using their existing messaging app (e.g., WhatsApp) and calendars rather than moving all communication into a new app.
10. Reduce time spent asking questions such as:

- "Who is taking Mom?"
- "Did they actually agree to do it?"
- "Who is free?"
- "Did someone pick up the medication?"
- "What did the doctor say?"
- "Who is handling this?"
- "Can anyone cover me?"

---

## 4. Non-Goals

The MVP will not attempt to:

- Diagnose medical conditions.
- Provide medical advice.
- Recommend medications or treatments.
- Replace healthcare professionals.
- Store comprehensive electronic medical records.
- Replace the family's primary messaging app (e.g., WhatsApp).
- Replace the family's connected calendar app (e.g., Google Calendar) or personal calendars.
- Provide clinical monitoring.
- Manage insurance or healthcare billing.
- Become a full project-management platform.
- Track caregiver contribution for compensation or legal purposes.

The initial product remains focused on **family coordination and communication around care**.

---

## 5. Target User / Proto-Persona

### Maya — Working Family Care Coordinator

**Age:** 35–50
**Occupation:** Full-time professional
**Situation:** Shares responsibility for an aging parent or relative with siblings or other family members.

Maya may not formally identify herself as a caregiver. She simply knows her family collectively needs to make sure appointments, medication pickups, transportation, meals, and other responsibilities happen.

Different family members may handle different parts of care.

For example:

- One sibling handles meals.
- Another manages medication.
- Another attends appointments.
- Everyone communicates through a shared messaging app.
- Appointments may live in different people's calendars.

**Maya's Goals**

Maya wants to:

- Know who is responsible for what.
- Know whether the person assigned has actually agreed to do it.
- Quickly understand whether someone is available.
- Stay informed when another sibling attends an appointment.
- Avoid chasing family members for updates.
- Prevent tasks and appointments from being forgotten.
- Coordinate caregiving without it consuming her workday.
- Keep her personal calendar details private.
- Continue using tools she already knows.

**Current Behaviours**

Maya's family currently relies on:

- WhatsApp.
- Text messages.
- Phone calls.
- Google Calendar.
- Apple Calendar.
- Shared calendars.
- Notes.
- Memory.

The problem is not necessarily the absence of tools. It is that responsibility, confirmation, availability, and information are fragmented across them.

---

## 6. Jobs to Be Done

### Primary Job

> When my family shares responsibility for someone's care, help me quickly understand what needs to happen, who has agreed to handle it, and whether it has been completed so I don't have to coordinate everything manually.

### Supporting Jobs

When a caregiving responsibility comes up, help us identify who can take it.

When I ask another family member to handle something, let me know whether they have actually accepted responsibility.

When another caregiver attends an appointment, help me understand what happened without having to chase them.

When I can no longer handle something I agreed to do, help me find someone else who can take over.

When my family needs to know my availability, let me share enough information to coordinate without exposing the contents of my personal calendar.

When something important happens in Kindred, let me share it into the messaging conversation my family already uses.

---

## 7. Product Principles

### 7.1 Integrate Into Existing Behaviour

Kindred should not require families to replace the tools they already use.

Users should be able to:

- Connect their calendar.
- Sync caregiving appointments into their personal calendar.
- Use calendar availability to coordinate.
- Share Kindred tasks, appointments, invitations, and coverage requests through their messaging app.

---

### 7.2 Coordination Before Communication

Kindred should not try to become another messaging app.

The family's messaging app remains useful for conversation.

Kindred should be better at answering:

> **Who owns this, have they accepted it, when is it happening, and has it been handled?**

---

### 7.3 Assignment Is Not Ownership Until Accepted

A family member can propose that another caregiver take responsibility for a task or appointment.

However, the assignee must explicitly accept before Kindred considers them the confirmed owner.

Kindred should never create false certainty by displaying someone as responsible when they have not agreed to take the responsibility.

---

### 7.4 Ownership Should Always Be Visible

Every task or appointment should clearly communicate:

- What needs to happen.
- When it needs to happen.
- Whether an assignment is awaiting acceptance.
- Who has confirmed responsibility.
- Its current status.

---

### 7.5 Low Effort

Common actions should take seconds.

For example:

- Accept or decline an assignment.
- Claim an unassigned task.
- Complete a task.
- Request coverage.
- Accept coverage.
- Share to messaging app.
- Add an appointment update.

---

### 7.6 Privacy by Default

Families should be able to coordinate availability without exposing the contents of personal calendars.

---

### 7.7 Mobile-First

Kindred should be optimized for caregivers checking or updating something quickly during their day.

---

### 7.8 Accessible to the Whole Family

The experience should remain simple enough for family members with different levels of technical comfort.

---

## 8. MVP Scope

The MVP will include:

1. Account creation and authentication.
2. Family Care Circles.
3. Family member invitations.
4. Shared caregiving calendar.
5. Calendar integration.
6. Free/busy availability.
7. Calendar event syncing.
8. Care tasks.
9. Proposed task and appointment assignments.
10. Explicit acceptance or decline of assignments.
11. Task ownership.
12. Coverage and handoffs.
13. Two coverage requests per caregiver per calendar month.
14. Appointment updates.
15. Follow-up tasks.
16. Push notifications and reminders.
17. Messaging app sharing.
18. Shared activity feed.
19. Contextual comments.
20. Recurring tasks and appointments (simple repeats).
21. Account deletion and personal data export.

---

## 9. Information Architecture

Kindred will use a simple mobile bottom navigation structure.

### Home

Shows:

- Today's responsibilities.
- Assignments awaiting my response.
- Upcoming responsibilities.
- Tasks needing someone.
- Coverage requests.
- Recent family activity.

### Calendar

Shows:

- Appointments.
- Scheduled caregiving tasks.
- Confirmed caregiver.
- Awaiting-acceptance assignments.
- Unassigned items.
- Availability indicators.

### Tasks

Shows:

- My tasks.
- Awaiting my acceptance.
- All tasks.
- Needs someone.
- Needs coverage.
- Completed tasks.

### Care Circle

Shows:

- Family members.
- Invitations.
- Connected calendars.
- Availability settings.
- Notification preferences.
- Care Circle settings.
- Account settings, including data export and account deletion.

---

## 10. Epic 1 — Account Creation and Authentication

### User Story 1.1 — Create an Account

**As a** caregiver,
**I want to** create a Kindred account,
**so that** I can participate in my family's Care Circle.

**Acceptance Criteria**

**Scenario: Successful account creation**

- **Given** I do not already have a Kindred account
- **When** I provide the required registration information
- **Then** my account is created
- **And** I can enter the app.

**Scenario: Existing account**

- **Given** an account already exists for my credentials
- **When** I attempt to register again
- **Then** Kindred prompts me to sign in instead.

---

### User Story 1.2 — Sign In

**As a** caregiver,
**I want to** sign in with a method I already use,
**so that** joining my family's Care Circle is quick even if I am not technically confident.

**Acceptance Criteria**

**Scenario: Supported sign-in methods**

- **Given** I am on the sign-in screen
- **When** I choose how to sign in
- **Then** I can use Sign in with Apple, Sign in with Google, or an email one-time code.

**Scenario: Invitation link before the app is installed**

- **Given** I receive a Care Circle invitation but do not have Kindred installed
- **When** I open the link, install the app, and sign in
- **Then** Kindred still adds me to the Care Circle from the original invitation.

*Assumption: passwordless methods only for MVP, to reduce support load and suit less technically confident family members. Sign in with Apple is required by the App Store whenever Sign in with Google is offered.*

---

### User Story 1.3 — Delete Account and Export Data

**As a** caregiver,
**I want to** export or delete my personal data,
**so that** I stay in control of information about me and my family.

**Acceptance Criteria**

**Scenario: Export data**

- **Given** I am signed in
- **When** I request a data export
- **Then** Kindred provides a copy of my personal data and the Care Circle content I created.

**Scenario: Delete account**

- **Given** I am signed in
- **When** I delete my account and confirm
- **Then** Kindred removes my account and disconnects my calendar
- **And** open responsibilities I own return to **Needs someone**
- **And** other members are notified.

**Scenario: Shared history is preserved without my identity**

- **Given** I contributed updates or comments to a Care Circle
- **When** my account is deleted
- **Then** that content remains for the family but is attributed to "Former member".

*Assumption: whether shared content is kept or deleted on account deletion needs privacy/legal review (see §37).*

---

## 11. Epic 2 — Care Circles

A **Care Circle** represents the group coordinating care for one person.

### User Story 2.1 — Create a Care Circle

**As a** caregiver,
**I want to** create a Care Circle,
**so that** my family has one place to coordinate care.

**Acceptance Criteria**

**Scenario: Create a Care Circle**

- **Given** I am signed into Kindred
- **When** I select **Create Care Circle** and enter the care recipient's name
- **Then** Kindred creates a new Care Circle
- **And** makes me its initial administrator.

**Scenario: Missing required information**

- **Given** I am creating a Care Circle
- **When** I attempt to continue without providing a name
- **Then** Kindred prevents creation
- **And** prompts me to enter one.

---

### User Story 2.2 — Equal Member Permissions

**As a** Care Circle member,
**I want** every member to be able to manage the family's responsibilities,
**so that** coordination does not depend on one person being available.

**Acceptance Criteria**

**Scenario: Any member can manage any item**

- **Given** I belong to a Care Circle
- **When** I view a task or appointment created or owned by someone else
- **Then** I can edit, cancel, assign, reassign, or withdraw an assignment on it.

**Scenario: Changes are attributed**

- **Given** a member changes an item they do not own
- **When** the change is saved
- **Then** the activity feed records who made the change
- **And** the current owner or proposed assignee is notified.

**Scenario: Member management is limited to administrators**

- **Given** I am not an administrator
- **When** I view the Care Circle member list
- **Then** I can invite members but cannot remove them or change administrators.

**Scenario: Last administrator leaves**

- **Given** I am the only administrator
- **When** I leave the Care Circle
- **Then** Kindred makes the longest-standing remaining member an administrator.

*Decision: all members have equal permissions over tasks and appointments. The administrator role exists only for member management (removing members, granting administrator). A Care Circle may have several administrators.*

---

## 12. Epic 3 — Invite Family Members

### User Story 3.1 — Invite Another Caregiver

**As a** Care Circle member,
**I want to** invite another family member,
**so that** everyone involved in care can participate.

**Acceptance Criteria**

**Scenario: Send invitation**

- **Given** I belong to a Care Circle
- **When** I select **Invite caregiver**
- **Then** Kindred generates a mobile invitation link that I can share.

**Scenario: Share invitation through messaging app**

- **Given** Kindred has generated an invitation link
- **When** I choose my messaging app as the sharing method
- **Then** the messaging app opens with a pre-populated invitation message and the Kindred link.

**Scenario: Join a Care Circle**

- **Given** I receive a valid Care Circle invitation
- **When** I open the link and sign in or create an account
- **Then** I am added to that Care Circle.

**Scenario: Existing member opens invitation**

- **Given** I already belong to the Care Circle
- **When** I open another invitation
- **Then** Kindred opens the existing Care Circle without creating a duplicate membership.

---

## 13. Epic 4 — Shared Care Calendar

### User Story 4.1 — View Caregiving Events

**As a** caregiver,
**I want to** see caregiving responsibilities in one shared calendar,
**so that** I know what is happening and who is responsible.

**Acceptance Criteria**

**Scenario: View calendar**

- **Given** my Care Circle contains scheduled tasks or appointments
- **When** I open the Calendar tab
- **Then** I can see those items organized by date and time.

**Scenario: View confirmed ownership**

- **Given** an event has an accepted caregiver
- **When** I view the calendar
- **Then** that caregiver is clearly displayed as the confirmed owner.

**Scenario: Assignment awaiting acceptance**

- **Given** an event has been assigned to another caregiver
- **And** they have not yet responded
- **When** I view the event
- **Then** Kindred displays **Awaiting acceptance**
- **And** does not present that caregiver as confirmed.

**Scenario: Unassigned event**

- **Given** an event has no proposed or confirmed caregiver
- **When** I view it
- **Then** Kindred labels it **Needs someone**.

---

### User Story 4.2 — Create an Appointment

**As a** caregiver,
**I want to** add a caregiving appointment,
**so that** everyone knows when it is happening.

**Acceptance Criteria**

**Scenario: Create appointment**

- **Given** I am inside a Care Circle
- **When** I create an appointment with a title, date, and time
- **Then** it appears on the shared Care Circle calendar.

**Scenario: Propose an appointment owner**

- **Given** I am creating or editing an appointment
- **When** I select another Care Circle member
- **Then** that member receives an assignment request
- **And** the appointment is marked **Awaiting acceptance**.

**Scenario: View shared appointment**

- **Given** an appointment has been created
- **When** another member opens the Care Circle calendar
- **Then** they can see the appointment and its assignment status.

---

## 14. Epic 5 — Calendar Integration

### User Story 5.1 — Connect Calendar

**As a** caregiver,
**I want to** connect my calendar,
**so that** Kindred can coordinate caregiving around my existing schedule.

**Acceptance Criteria**

**Scenario: Successful connection**

- **Given** I am signed into Kindred
- **When** I select **Connect calendar** and authorize access
- **Then** Kindred stores the connection successfully.

**Scenario: Permission declined**

- **Given** Kindred requests calendar access
- **When** I decline
- **Then** I can continue using Kindred
- **And** Kindred informs me that calendar-based availability will not be available.

**Scenario: Disconnect calendar**

- **Given** my calendar is connected
- **When** I choose to disconnect it
- **Then** Kindred stops accessing calendar availability
- **And** stops syncing new events.

---

### User Story 5.2 — Sync Accepted Care Appointments to Connected Calendar

**As a** caregiver,
**I want to** have caregiving appointments I have accepted appear in my connected calendar,
**so that** I can see them alongside work and personal commitments.

**Acceptance Criteria**

**Scenario: Appointment has only been proposed**

- **Given** another caregiver has assigned an appointment to me
- **And** I have not yet accepted it
- **When** I view my calendar
- **Then** Kindred does not treat the appointment as a confirmed calendar commitment.

**Scenario: Accepted appointment**

- **Given** my calendar is connected
- **And** I accept responsibility for a caregiving appointment
- **When** the acceptance is saved
- **Then** Kindred adds the appointment to my connected calendar according to my sync preferences.

**Scenario: Appointment changes**

- **Given** an accepted Kindred appointment has been synced
- **When** its date or time changes
- **Then** the connected calendar event is updated.

**Scenario: Appointment cancellation**

- **Given** a Kindred appointment has been synced
- **When** the appointment is cancelled
- **Then** the synced calendar event is removed or marked cancelled.

**Scenario: Sync preferences**

- **Given** my calendar is connected
- **When** I open my sync preferences
- **Then** I can choose whether accepted appointments and accepted tasks with a due time are added to my calendar
- **And** by default, appointments are added and tasks are not.

**Scenario: Synced events stay private**

- **Given** Kindred adds an event to my connected calendar
- **When** the event is created
- **Then** it contains the title, time, and a Kindred link, but not appointment notes or updates.

*Assumption: sync is one-way (Kindred → calendar). Edits made to a synced event in the calendar app are not read back into Kindred.*

---

## 15. Epic 6 — Availability

### User Story 6.1 — Share Free/Busy Availability

**As a** caregiver,
**I want to** share my availability without exposing private calendar details,
**so that** my family can coordinate while I maintain privacy.

**Acceptance Criteria**

**Scenario: Show availability**

- **Given** I have connected my calendar
- **When** another Care Circle member checks my availability
- **Then** Kindred displays whether I am free or busy.

**Scenario: Protect private event information**

- **Given** I have a personal or work event on my calendar
- **When** another Care Circle member views my availability
- **Then** they cannot see the event title, description, attendees, location, or notes.

**Scenario: No connected calendar**

- **Given** I have not connected a calendar
- **When** another caregiver checks my availability
- **Then** Kindred displays my availability as **Unknown**.

---

### User Story 6.2 — Find Available Caregivers

**As a** caregiver,
**I want to** see who may be available for a task or appointment,
**so that** I do not need to message every family member individually.

**Acceptance Criteria**

**Scenario: View availability**

- **Given** Care Circle members have connected calendars
- **When** I select a date and time for a caregiving responsibility
- **Then** Kindred shows which members appear free and which appear busy.

**Scenario: Calendar unavailable**

- **Given** a caregiver has not connected a calendar
- **When** availability is displayed
- **Then** Kindred shows their availability as **Unknown**.

---

### User Story 6.3 — Suggest a Suitable Time

**As a** caregiver,
**I want to** identify times that work for family members,
**so that** scheduling requires less back-and-forth.

**Acceptance Criteria**

**Scenario: Suggest times**

- **Given** multiple Care Circle members have shared availability
- **When** I request suggested times
- **Then** Kindred displays available time windows based on their calendars.

**Scenario: No common availability**

- **Given** there is no shared open time
- **When** I request suggestions
- **Then** Kindred indicates that no common time was found
- **And** shows least-conflicted options if available.

---

## 16. Epic 7 — Tasks and Assignment

### User Story 7.1 — Create a Task

**As a** caregiver,
**I want to** create a caregiving task,
**so that** responsibilities do not rely on memory or chat messages.

Examples include picking up medication, buying groceries, arranging transportation, calling a pharmacy, or preparing a meal.

**Acceptance Criteria**

**Scenario: Create task**

- **Given** I am inside a Care Circle
- **When** I create a task with a title and due date
- **Then** it appears in the shared task list.

**Scenario: Create unassigned task**

- **Given** I create a task without selecting a caregiver
- **When** the task is saved
- **Then** Kindred labels it **Needs someone**.

---

### User Story 7.2 — Claim an Unassigned Task

**As a** caregiver,
**I want to** claim an unassigned task,
**so that** the family knows I am handling it.

**Acceptance Criteria**

**Scenario: Claim task**

- **Given** a task is marked **Needs someone**
- **When** I select **I'll do it**
- **Then** I immediately become the confirmed task owner
- **And** the status changes to **Assigned**.

**Scenario: Another caregiver already claimed it**

- **Given** another caregiver has already claimed the task
- **When** I attempt to claim it
- **Then** Kindred informs me that the task has already been taken
- **And** displays the confirmed owner.

Because the caregiver is voluntarily claiming the task themselves, a second acceptance step is not required.

---

### User Story 7.3 — Assign a Task to Another Caregiver

**As a** caregiver,
**I want to** assign a task to another family member,
**so that** I can propose who should take responsibility while allowing them to confirm they can actually do it.

**Acceptance Criteria**

**Scenario: Assign task**

- **Given** I am creating or editing a task
- **When** I select another Care Circle member as the assignee
- **Then** Kindred marks the task **Awaiting acceptance**
- **And** sends that caregiver an assignment notification.

**Scenario: Assignee accepts**

- **Given** a task has been assigned to me
- **And** its status is **Awaiting acceptance**
- **When** I select **Accept**
- **Then** I become the confirmed task owner
- **And** the task status changes to **Assigned**.

**Scenario: Assignee declines**

- **Given** a task has been assigned to me
- **When** I select **Decline**
- **Then** I am not made the task owner
- **And** the task returns to **Needs someone**
- **And** the person who assigned it is notified.

**Scenario: Assignment has not been answered**

- **Given** a task has been assigned
- **And** the assignee has not responded
- **When** another Care Circle member views it
- **Then** Kindred displays the proposed assignee
- **And** clearly labels the task **Awaiting acceptance**.

**Scenario: Assignment is no longer available**

- **Given** I received an assignment request
- **But** the task has since been reassigned or claimed
- **When** I attempt to accept the original request
- **Then** Kindred informs me that the assignment is no longer available
- **And** displays the current status.

---

### User Story 7.4 — Assign an Appointment to Another Caregiver

**As a** caregiver,
**I want to** assign an appointment to another family member,
**so that** I can ask them to take responsibility without assuming they can attend.

**Acceptance Criteria**

**Scenario: Assign appointment**

- **Given** I am creating or editing an appointment
- **When** I select another caregiver
- **Then** Kindred marks the appointment **Awaiting acceptance**
- **And** notifies that caregiver.

**Scenario: Accept appointment**

- **Given** an appointment is awaiting my acceptance
- **When** I select **Accept**
- **Then** I become the confirmed appointment owner
- **And** the appointment status changes to **Assigned**.

**Scenario: Decline appointment**

- **Given** an appointment is awaiting my acceptance
- **When** I select **Decline**
- **Then** the appointment returns to **Needs someone**
- **And** the assigning caregiver is notified.

---

### User Story 7.5 — Complete a Task

**As a** caregiver,
**I want to** mark my responsibility complete,
**so that** the family knows it has been handled.

**Acceptance Criteria**

**Scenario: Complete task**

- **Given** I am the confirmed owner of an open task
- **When** I mark the task complete
- **Then** its status changes to **Completed**.

**Scenario: Family sees completion**

- **Given** a task has been completed
- **When** another member views it
- **Then** they can see that it was completed and by whom.

---

### User Story 7.6 — Create a Recurring Task or Appointment

**As a** caregiver,
**I want to** set a task or appointment to repeat,
**so that** routine care such as weekly medication pickups does not need to be recreated.

**Acceptance Criteria**

**Scenario: Create repeating item**

- **Given** I am creating a task or appointment
- **When** I choose to repeat it daily, weekly, or monthly, with an optional end date
- **Then** Kindred creates a series of occurrences on the shared calendar.

**Scenario: Each occurrence has its own ownership**

- **Given** a recurring series exists
- **When** I view one occurrence
- **Then** it has its own assignment state, owner, completion, comments, and updates.

**Scenario: Assign a series**

- **Given** I am assigning a recurring item
- **When** I choose **This occurrence** or **All future occurrences**
- **Then** the assignee receives one request covering what I selected
- **And** accepting it confirms them as owner of every occurrence it covers.

**Scenario: Coverage is per occurrence**

- **Given** I own several occurrences in a series
- **When** I request coverage
- **Then** the request applies to one occurrence and counts as one coverage request.

*Decision: MVP supports simple repeats only (daily, weekly, monthly). Rules such as "every second Tuesday" are out of scope.*

---

### User Story 7.7 — Edit or Cancel a Recurring Item

**As a** caregiver,
**I want to** change one occurrence or the rest of a series,
**so that** one-off changes do not break the routine.

**Acceptance Criteria**

**Scenario: Edit scope**

- **Given** I edit or cancel an occurrence of a recurring item
- **When** I save the change
- **Then** Kindred asks whether it applies to **This occurrence** or **This and future occurrences**.

---

### User Story 7.8 — Change an Existing Assignment

**As a** caregiver,
**I want to** withdraw, reassign, or reschedule responsibilities,
**so that** plans can change without leaving the family unsure who is responsible.

**Acceptance Criteria**

**Scenario: Withdraw a pending assignment**

- **Given** an item is **Awaiting acceptance**
- **When** any member withdraws the assignment
- **Then** the item returns to **Needs someone**
- **And** the proposed assignee is notified.

**Scenario: Reassign an accepted item**

- **Given** an item is **Assigned**
- **When** another member reassigns it to a different caregiver
- **Then** the item becomes **Awaiting acceptance** for the new caregiver
- **And** the previous owner is notified and is no longer the owner
- **And** the previous owner's coverage-request count is unaffected.

**Scenario: Schedule change requires re-confirmation**

- **Given** an item is **Assigned**
- **When** a member other than the owner changes its date or time
- **Then** the item returns to **Awaiting acceptance** for the same owner
- **And** the owner is asked to confirm they can still do it.

**Scenario: Non-schedule edits**

- **Given** an item is **Assigned**
- **When** a member changes its title, notes, or location
- **Then** ownership is unchanged
- **And** the owner is notified of the change.

**Scenario: Overdue item**

- **Given** an item's due time has passed
- **And** it is not **Completed** or **Cancelled**
- **When** members view it
- **Then** Kindred shows an **Overdue** indicator alongside its state.

**Scenario: Unanswered assignment near due time**

- **Given** an item is still **Awaiting acceptance** 24 hours before it is due
- **When** that point is reached
- **Then** the assignee receives a reminder
- **And** the member who assigned it is notified that it is unconfirmed.

---

## 17. Assignment State Model

Kindred will use the following core assignment states:

| State | Meaning |
| --- | --- |
| Needs someone | No caregiver has been proposed or confirmed |
| Awaiting acceptance | A caregiver has been asked but has not accepted |
| Assigned | A caregiver has explicitly accepted or voluntarily claimed the responsibility |
| Needs coverage | The confirmed caregiver can no longer complete the responsibility |
| Completed | Responsibility has been completed |
| Cancelled | Responsibility is no longer required |

The standard assignment flow is:

> **Needs someone → Awaiting acceptance → Assigned → Completed**

If the proposed caregiver declines:

> **Awaiting acceptance → Needs someone**

If the confirmed caregiver later cannot complete it:

> **Assigned → Needs coverage → Assigned to new caregiver**

Other transitions (see User Story 7.8):

| From | Action | To |
| --- | --- | --- |
| Awaiting acceptance | Any member withdraws the assignment | Needs someone |
| Assigned | Any member reassigns to another caregiver | Awaiting acceptance (new caregiver) |
| Assigned | Someone other than the owner changes date/time | Awaiting acceptance (same owner) |
| Needs coverage | Owner cancels the coverage request | Assigned (same owner) |
| Any state except Completed | Any member cancels | Cancelled |

**Overdue** is an indicator shown alongside a state, not a state of its own. Changes of state must be atomic, so that two members acting at once (for example, both claiming the same task) cannot both succeed.

---

## 18. Epic 8 — Coverage and Handoffs

### User Story 8.1 — Request Coverage

**As a** caregiver,
**I want to** request someone else to take over a responsibility,
**so that** it is not missed when my availability changes.

**Acceptance Criteria**

**Scenario: Request coverage within monthly limit**

- **Given** I am the confirmed owner of a future task or appointment
- **And** I have used fewer than 2 coverage requests in the current calendar month
- **When** I select **Need coverage**
- **Then** Kindred marks the item **Needs coverage**
- **And** my monthly coverage-request count increases by 1.

**Scenario: Notify family**

- **Given** a valid coverage request has been created
- **When** the request is published
- **Then** every other member of the Care Circle is notified that coverage is needed.

**Scenario: Reach monthly coverage limit**

- **Given** I have already accepted a task and used 2 coverage requests in the current calendar month
- **When** I attempt to select **Need coverage**
- **Then** Kindred prevents another formal coverage request
- **And** tells me I have reached my limit of 2 requests for the month.

**Scenario: Monthly limit resets**

- **Given** I reached my limit during the previous calendar month
- **When** a new calendar month begins
- **Then** my coverage-request count resets to 0.

**Scenario: Cancel coverage request**

- **Given** I submitted a coverage request
- **And** another caregiver has not yet accepted it
- **When** I cancel the request
- **Then** the responsibility returns to **Assigned** under my ownership
- **And** the cancelled request still counts toward my monthly limit.

**Scenario: View remaining coverage requests**

- **Given** I am viewing a responsibility assigned to me
- **When** I open the coverage action
- **Then** Kindred displays how many coverage requests I have remaining during the current month.

---

### User Story 8.2 — Accept Coverage

**As a** caregiver,
**I want to** take over a responsibility that needs coverage,
**so that** I can help when another caregiver's availability changes.

**Acceptance Criteria**

**Scenario: Accept coverage**

- **Given** another caregiver has requested coverage
- **And** the responsibility remains available
- **When** I select **I can do it**
- **Then** I become the confirmed owner
- **And** the coverage request is closed.

**Scenario: Coverage already accepted**

- **Given** another caregiver has already accepted the coverage request
- **When** I attempt to accept it
- **Then** Kindred informs me that the request has already been resolved
- **And** displays the new owner.

Because a caregiver is voluntarily selecting **I can do it**, no additional acceptance step is required.

---

### User Story 8.3 — Update Calendars After Handoff

**As a** caregiver,
**I want** calendar commitments to reflect responsibility handoffs,
**so that** everyone's schedule remains accurate.

**Acceptance Criteria**

**Scenario: New caregiver accepts appointment coverage**

- **Given** an appointment is synced to the original caregiver's calendar
- **When** another caregiver accepts coverage
- **Then** Kindred transfers ownership
- **And** syncs the event to the new caregiver's connected calendar according to their preferences.

**Scenario: Original caregiver no longer owns appointment**

- **Given** responsibility has successfully transferred
- **When** the handoff is completed
- **Then** the original caregiver's synced event is removed from their calendar.

---

## 19. Epic 9 — Messaging App Integration

For MVP, messaging app integration means **sharing Kindred information into the family's messaging app (e.g., WhatsApp) and linking family members back into the correct Kindred item**.

Sharing uses the phone's standard share sheet with pre-filled text and a Kindred link. There is no direct integration with any messaging app's API, and Kindred does not need to read users' private messaging app conversations.

### User Story 9.1 — Share a Task to Messaging App

**As a** caregiver,
**I want to** share a Kindred task through my messaging app,
**so that** my family sees it in the channel they already use.

**Acceptance Criteria**

**Scenario: Share task**

- **Given** I am viewing a task
- **When** I select **Share to messaging app**
- **Then** the messaging app opens with a pre-populated task message and Kindred link.

**Scenario: Include useful context**

- **Given** the task has a due date and assignment status
- **When** the messaging app message is generated
- **Then** it includes the task name, due date, assignment status, and Kindred link.

**Scenario: Open task from messaging app**

- **Given** a Care Circle member receives the link
- **When** they open it
- **Then** Kindred opens the corresponding task if they have permission to access it.

---

### User Story 9.2 — Share Assignment Request Through Messaging App

**As a** caregiver assigning a responsibility,
**I want to** notify the proposed caregiver through my messaging app,
**so that** they are more likely to see and respond to the request.

**Acceptance Criteria**

**Scenario: Share pending assignment**

- **Given** I have assigned a task or appointment to another caregiver
- **And** it is **Awaiting acceptance**
- **When** I select **Share to messaging app**
- **Then** the messaging app opens with a message stating that their response is required
- **And** includes a Kindred link.

**Scenario: Accept from linked Kindred item**

- **Given** I receive a pending assignment link
- **When** I open the link
- **Then** Kindred opens the responsibility
- **And** allows me to choose **Accept** or **Decline**.

---

### User Story 9.3 — Share Coverage Request Through Messaging App

**As a** caregiver who needs help,
**I want to** share a coverage request in my family's messaging app,
**so that** family members can respond where they already communicate.

**Acceptance Criteria**

**Scenario: Share coverage**

- **Given** I have successfully created a coverage request
- **When** I choose **Share to messaging app**
- **Then** the messaging app opens with a pre-populated coverage request and Kindred link.

**Scenario: Claim from messaging app**

- **Given** another caregiver opens the Kindred coverage link
- **When** they select **I can do it**
- **Then** Kindred transfers ownership to them.

**Scenario: Already resolved**

- **Given** another caregiver has already accepted coverage
- **When** someone opens the same link
- **Then** Kindred indicates that coverage has already been resolved.

---

### User Story 9.4 — Share Appointment Through Messaging App

**As a** caregiver,
**I want to** share appointment details through my messaging app,
**so that** family members can quickly see important scheduling information.

**Acceptance Criteria**

**Scenario: Share appointment**

- **Given** I am viewing an appointment
- **When** I select **Share to messaging app**
- **Then** the messaging app opens with a concise appointment summary and Kindred link.

**Scenario: Exclude private notes by default**

- **Given** the appointment contains private notes
- **When** I share the appointment
- **Then** those notes are excluded unless I explicitly choose to include them.

---

### User Story 9.5 — Share Appointment Update Through Messaging App

**As a** caregiver,
**I want to** tell the family that an appointment update is available,
**so that** they know to check Kindred without me rewriting the information.

**Acceptance Criteria**

**Scenario: Share update**

- **Given** I added an appointment update
- **When** I select **Share update to messaging app**
- **Then** the messaging app opens with a message indicating an update is available and includes a Kindred link.

**Scenario: Protect sensitive update content**

- **Given** the update may contain sensitive information
- **When** Kindred generates the messaging app message
- **Then** the full update is not automatically included.

---

## 20. Epic 10 — Appointment Updates and Knowledge Sharing

### User Story 10.1 — Add an Appointment Update

**As a** caregiver who attended an appointment,
**I want to** record what happened,
**so that** knowledge is not lost or held by one family member.

**Acceptance Criteria**

**Scenario: Add update**

- **Given** an appointment exists
- **When** I select **Add update**
- **Then** I can enter a written summary.

**Scenario: Family views update**

- **Given** I save an update
- **When** another Care Circle member opens the appointment
- **Then** they can read the update.

**Scenario: Protect update details in notifications**

- **Given** an update is saved
- **When** notifications are sent
- **Then** push notifications do not expose sensitive details on the lock screen.

---

### User Story 10.2 — Create Follow-Up Task From Appointment

**As a** caregiver,
**I want to** turn an appointment outcome into a task,
**so that** required follow-up is not lost.

**Acceptance Criteria**

**Scenario: Create follow-up task**

- **Given** I am viewing an appointment or update
- **When** I select **Create follow-up task**
- **Then** Kindred opens a task creation flow linked to that appointment.

**Scenario: Family views follow-up task**

- **Given** I save the follow-up task
- **When** another Care Circle member views it
- **Then** they can see its due date, assignment status, owner if confirmed, and linked appointment.

---

## 21. Epic 11 — Notifications and Reminders

### User Story 11.1 — Receive Assignment Request

**As a** caregiver,
**I want to** be notified when someone assigns me a responsibility,
**so that** I can accept or decline it promptly.

**Acceptance Criteria**

**Scenario: Receive assignment notification**

- **Given** another caregiver assigns a task or appointment to me
- **When** the assignment is submitted
- **Then** I receive a notification that my response is required.

**Scenario: Open assignment from notification**

- **Given** I open the notification
- **When** Kindred opens
- **Then** I am taken directly to the responsibility
- **And** can choose **Accept** or **Decline**.

---

### User Story 11.2 — Receive Task Reminder

**As a** caregiver,
**I want to** receive reminders for responsibilities I have accepted,
**so that** I do not forget them.

**Acceptance Criteria**

**Scenario: Receive task reminder**

- **Given** I am the confirmed owner of a future task
- **When** its configured reminder time arrives
- **Then** I receive a push notification.

**Scenario: No reminder before acceptance**

- **Given** I have only been proposed as the assignee
- **And** I have not accepted
- **When** the normal task reminder time occurs
- **Then** Kindred does not treat me as the confirmed task owner.

**Scenario: No reminder after completion**

- **Given** a task has already been completed
- **When** its reminder time arrives
- **Then** Kindred does not send the reminder.

---

### User Story 11.3 — Receive Appointment Reminder

**As a** caregiver,
**I want to** receive reminders for appointments I have accepted,
**so that** important appointments are not missed.

**Acceptance Criteria**

**Scenario: Receive appointment reminder**

- **Given** I am the confirmed appointment owner
- **When** its reminder time arrives
- **Then** I receive a push notification.

**Scenario: No reminder before acceptance**

- **Given** an appointment is still awaiting my acceptance
- **When** its normal reminder time occurs
- **Then** Kindred does not treat me as the confirmed owner.

---

### User Story 11.4 — Control Notification Preferences

**As a** caregiver,
**I want to** control which notifications I receive,
**so that** Kindred helps me without becoming noisy.

**Acceptance Criteria**

**Scenario: Disable optional notifications**

- **Given** I am in notification settings
- **When** I disable an optional notification category
- **Then** Kindred stops sending push notifications for that category.

Notification categories and defaults:

| Category | Includes | Default |
| --- | --- | --- |
| Requests | Assignment requests, coverage requests, re-confirmation requests | On |
| Reminders | Upcoming responsibilities I own, unanswered assignments near due time | On |
| Changes | Changes, reassignments, and cancellations affecting items I own or was asked to take | On |
| Appointment updates | Updates added to appointments in my Care Circle | On |
| Comments | Comments on items I own or commented on | On |
| Activity | Other members completing or creating items | Off |

All categories can be turned off for push. Requests always remain visible in the app regardless of this setting.

**Scenario: In-app indicator remains even when notifications are disabled**

- **Given** an assignment requires my acceptance
- **When** someone assigns a responsibility to me
- **Then** Kindred provides a clear in-app indicator even if optional push notifications are disabled.

---

## 22. Epic 12 — Activity Feed

### User Story 12.1 — See What Changed

**As a** caregiver,
**I want to** see recent Care Circle activity,
**so that** I can catch up without reading an entire messaging thread.

**Acceptance Criteria**

**Scenario: View recent activity**

- **Given** activity has occurred in the Care Circle
- **When** I open Home
- **Then** Kindred displays recent activity chronologically.

Activity may include:

- Task created.
- Assignment requested.
- Assignment accepted.
- Assignment declined.
- Task completed.
- Appointment created.
- Appointment changed.
- Coverage requested.
- Coverage accepted.
- Appointment update added.
- Family member joined.

**Scenario: Open activity**

- **Given** an activity item relates to a task or appointment
- **When** I tap it
- **Then** Kindred opens the relevant item.

---

## 23. Epic 13 — Contextual Comments

Kindred should not build a full chat platform during MVP.

Comments should exist where they help clarify a specific task or appointment.

### User Story 13.1 — Comment on a Task

**As a** caregiver,
**I want to** ask or answer a question about a specific task,
**so that** the conversation remains attached to the responsibility.

**Acceptance Criteria**

**Scenario: Add comment**

- **Given** I am viewing a task
- **When** I add a comment
- **Then** the comment appears within that task.

**Scenario: Notified of new comment**

- **Given** another caregiver comments on a task assigned to me
- **When** the comment is posted
- **Then** I receive a notification according to my preferences.

---

## 24. Business Rules

### BR-01 — Coverage Request Limit

Each caregiver may initiate a maximum of **2 formal coverage requests per calendar month after already being assigned**.

The limit:

- Applies per caregiver.
- Includes tasks and appointments.
- Resets at the beginning of each calendar month.
- Counts once the request is submitted.
- Does not restrict how many coverage requests the caregiver may accept for other people.

After reaching the limit, users may still communicate with family members or directly reassign responsibilities where appropriate, but cannot initiate another formal **Need coverage** request until the next calendar month.

This fixed limit of 2 is an MVP simplification. See **32. MVP Prioritization** for the plan to make this limit configurable per Care Circle in a future release.

---

### BR-02 — Explicit Assignment Acceptance

A caregiver may assign a task or appointment to another Care Circle member.

However:

- The selected caregiver is a **proposed assignee**, not the confirmed owner.
- The responsibility remains **Awaiting acceptance** until they respond.
- The assignee must explicitly select **Accept** before ownership is confirmed.
- If they select **Decline**, the responsibility returns to **Needs someone**.
- Care Circle members must be able to distinguish pending assignments from confirmed ownership.

---

### BR-03 — Voluntary Claiming Does Not Require a Second Acceptance

If a caregiver independently chooses **I'll do it** or **I can do it**, they become the confirmed owner immediately because their action itself constitutes acceptance.

---

### BR-04 — Calendar Privacy

Connected personal calendars may be used to determine availability, but Care Circle members cannot view private event details.

---

### BR-05 — Confirmed Calendar Commitments

A task or appointment assigned by someone else should not be treated as a confirmed personal commitment until the assignee explicitly accepts it.

---

### BR-06 — Messaging App as Communication Channel

Kindred may generate structured content and links for sharing through the family's messaging app (e.g., WhatsApp) via the phone's share sheet, but does not integrate with messaging app APIs or require access to users' private messaging conversation history for MVP.

---

### BR-07 — Care Circle Access

Only authorized Care Circle members may view tasks, appointments, updates, comments, and other information within the circle.

---

### BR-08 — Equal Member Permissions

Every Care Circle member may create, edit, cancel, assign, reassign, and withdraw assignments on any task or appointment in that circle. Administrators additionally manage membership (removing members and granting the administrator role). Every change is attributed in the activity feed.

---

### BR-09 — Single Time Zone

For MVP, Kindred assumes all members of a Care Circle are in the same time zone. Items, reminders, availability, and the monthly coverage-request reset (BR-01) all use the device's local time zone. Support for members in different time zones is deferred.

---

### BR-10 — Recurring Items

Recurring tasks and appointments repeat daily, weekly, or monthly, with an optional end date. Each occurrence is an independent item for assignment, acceptance, coverage, completion, comments, and updates.

---

### BR-11 — Re-confirmation After Schedule Changes

If anyone other than the owner changes the date or time of an **Assigned** item, it returns to **Awaiting acceptance** for the same owner. This keeps BR-02's guarantee that a confirmed owner has agreed to the responsibility as it currently stands.

---

### BR-12 — One Care Circle per User

For MVP, each user belongs to exactly one Care Circle. A user who already belongs to a Care Circle cannot create or join another; if they open an invitation to a different Care Circle, Kindred explains that they must leave their current one first.

---

## 25. Mobile UX Requirements

Because Kindred will often be used while caregivers are busy, common actions should require minimal effort.

Users should be able to:

- Accept an assignment in one tap.
- Decline an assignment in one tap.
- Claim an open task in one tap.
- Complete a task in one tap.
- Request coverage in no more than two taps.
- Accept coverage in one tap.
- See remaining monthly coverage requests before submitting.
- Share an item to their messaging app in no more than two taps.
- Identify whether responsibility is confirmed or awaiting acceptance without opening the detail page.
- See today's responsibilities immediately from Home.
- Understand another caregiver's availability without seeing their private calendar.

**Accessibility Requirements**

Kindred should support:

- Dynamic text sizing.
- Screen-reader labels.
- Large touch targets.
- High-contrast states.
- Plain-language labels.
- Minimal reliance on icons without text.
- Status indicators that do not depend on colour alone.

The target standard is **WCAG 2.2 AA**.

---

## 26. Privacy Requirements

Because caregiving information may be sensitive:

- Care Circles are private by default.
- Only invited members can access a Care Circle.
- Personal calendar contents are never shown to family members.
- Calendar integration exposes only the minimum free/busy information needed.
- Users can disconnect calendars.
- Users can leave a Care Circle.
- Users can export their data and delete their account.
- Administrators can remove members.
- Push notifications should minimize sensitive lock-screen information.
- Appointment notes should only be accessible to authorized Care Circle members.
- Messaging app shares should avoid automatically exposing sensitive appointment notes.
- Kindred should collect only the minimum information needed to coordinate care.

---

## 27. Notification Strategy

Kindred should prioritize **actionable notifications**, not activity volume.

**High-Priority Notifications**

- Someone assigned you a responsibility and needs your response.
- An accepted responsibility is due soon.
- Someone requested coverage.
- You accepted or received a responsibility through a handoff.
- An appointment you own changed.
- An appointment update relevant to you was added.

**Lower-Priority Activity**

Events such as another caregiver completing their own routine task should generally appear in the activity feed instead of generating a push notification.

---

## 28. Key MVP User Flow — Normal Coordination

Maya creates **Mom's Care Circle** and invites her siblings through her messaging app.

Each sibling joins Kindred and connects their calendar.

Maya creates Mom's cardiology appointment.

Kindred shows which siblings appear free.

Maya selects her brother as the proposed caregiver.

His Kindred app shows:

> **Mom's cardiology appointment — Awaiting your acceptance**

He selects:

> **Accept**

Only then does Kindred mark him as the confirmed owner.

The appointment is synced to his calendar.

After attending the appointment, he adds an update to Kindred.

He creates a follow-up task:

> **Pick up prescription by Friday**

He assigns it to Maya.

Maya receives the request and selects **Accept**.

The task becomes hers and appears as a confirmed responsibility.

When she picks up the prescription, she marks it complete.

The family now has a clear record of:

> **who was asked → who accepted → what happened → what was completed.**

---

## 29. Key MVP User Flow — Coverage

Maya has previously accepted responsibility for driving Mom to an appointment.

A mandatory work meeting appears on her calendar.

Maya opens Kindred.

Kindred displays:

> **Need coverage — 1 of 2 requests remaining this month**

She selects **Need coverage**.

Kindred identifies family members who appear available.

Maya shares the request into the family's messaging group.

Her brother opens the Kindred link and selects:

> **I can do it**

Because he voluntarily claimed the responsibility, this action counts as his acceptance.

Kindred:

- Transfers confirmed ownership to him.
- Closes the coverage request.
- Updates the Care Circle.
- Updates connected calendars.
- Shows him as the confirmed owner.
- Records one of Maya's two monthly coverage requests as used.

After Maya uses a second coverage request during the same month, Kindred displays:

> **You've used your 2 coverage requests for this month. Your allowance resets next month.**

---

## 30. Success Metrics

**Activation**

Measure the percentage of new Care Circles that:

- Connect at least one calendar.
- Create at least one task or appointment.
- Send at least one assignment request.
- Have at least one assignment accepted.

**Engagement**

Measure:

- Weekly active Care Circles.
- Tasks created.
- Assignments proposed.
- Assignment acceptance rate.
- Assignment decline rate.
- Median time to accept or decline.
- Tasks completed.
- Percentage of responsibilities with confirmed owners.
- Appointments created.
- Appointment updates added.
- Coverage requests created.
- Coverage requests accepted.
- Percentage of coverage requests resolved.
- Messaging app shares initiated.
- Calendar-connected caregivers.

**Coverage Metrics**

Measure:

- Percentage of caregivers using coverage.
- Percentage of requests successfully claimed.
- Time between requesting coverage and acceptance.
- Percentage of users reaching the two-request monthly limit to change coverage after acceptance.

**Core Network Metric**

> **Percentage of active Care Circles with at least two active caregivers.**

Supporting metrics:

> **Percentage of responsibilities with a confirmed owner.**
>
> **Percentage of proposed assignments explicitly accepted or declined.**

---

## 31. Outcome Metrics

Through interviews and product surveys, determine whether Kindred helps users experience:

- Less time spent coordinating.
- Fewer repeated "who is doing this?" conversations.
- Greater confidence that someone has actually agreed to handle a responsibility.
- Fewer forgotten or duplicated tasks.
- Better knowledge-sharing after appointments.
- Less need to chase siblings for information.
- Less disruption to caregivers' workdays.

---

## 32. MVP Prioritization

| Priority | Capability |
| --- | --- |
| P0 | Account creation / login |
| P0 | Create Care Circle |
| P0 | Invite family members |
| P0 | Messaging app invitation sharing |
| P0 | Create tasks |
| P0 | Propose task/appointment assignment |
| P0 | Accept or decline assignments |
| P0 | Claim unassigned tasks |
| P0 | Complete tasks |
| P0 | Shared care calendar |
| P0 | Calendar connection |
| P0 | Free/busy availability |
| P0 | Sync accepted appointments to connected calendar |
| P0 | Request/reassign coverage |
| P0 | Two-request monthly coverage rule |
| P0 | Display remaining coverage allowance |
| P0 | Share tasks to messaging app |
| P0 | Share pending assignments to messaging app |
| P0 | Share coverage requests to messaging app |
| P0 | Share appointments to messaging app |
| P0 | Appointment notes/updates |
| P0 | Task and appointment reminders |
| P0 | Recurring tasks and appointments (daily/weekly/monthly) |
| P0 | Withdraw, reassign, and reschedule assignments |
| P0 | Account deletion and data export |
| P1 | Suggested caregivers based on availability |
| P1 | Suggested appointment times |
| P1 | Activity feed |
| P1 | Task comments |
| P1 | Share appointment updates to messaging app |
| P1 | French language support (required before availability in Quebec) |
| P2 | Apple Calendar / Outlook integration |
| P2 | Care Circles whose members are in different time zones |
| P2 | Belonging to more than one Care Circle |
| P2 | Advanced recurrence rules (e.g., every second Tuesday) |
| P2 | Deeper messaging app automation where technically feasible |
| P2 | AI-generated appointment summaries |
| P2 | Contribution/fairness insights |
| P2 | AI caregiving assistant |
| P2 | Configurable coverage-request limit as a Care Circle setting (replaces the fixed MVP limit of 2 per caregiver per month; see BR-01) |

---

## 33. Key Product Hypothesis

> **We believe families sharing caregiving responsibilities will use Kindred if it gives them a clearer way to manage responsibility, acceptance, availability, appointments, and care updates while allowing them to continue using the calendars and messaging conversations they already rely on.**

We will know this hypothesis is supported if multiple members of the same Care Circle actively use Kindred to:

- Propose responsibilities.
- Accept or decline assignments.
- Claim responsibilities.
- Coordinate schedules.
- Transfer coverage.
- Share appointment information.
- Complete tasks.

rather than Kindred becoming another tool maintained only by the primary caregiver.

---

## 34. Riskiest Assumptions to Validate

1. Families experience enough coordination pain to adopt an additional product.
2. The problem is sufficiently common among families sharing caregiving responsibility.
3. Family members will participate rather than leaving one person to maintain Kindred.
4. Explicit acceptance improves clarity without creating too much extra friction.
5. Users will respond to assignment requests quickly enough for the workflow to remain useful.
6. Calendar availability meaningfully reduces scheduling friction.
7. Users are comfortable connecting personal calendars if Kindred only exposes free/busy status.
8. Messaging app integration lowers the adoption barrier because families can keep communicating where they already do.
9. Task ownership and handoffs provide enough incremental value beyond a messaging app and shared calendars.
10. Appointment knowledge-sharing is recurring enough to warrant a dedicated feature.
11. Working caregivers experience enough administrative interruption for this to be a meaningful problem.
12. Families perceive Kindred as a coordination layer rather than another app they must constantly check.
13. A two-coverage-request monthly limit does not create enough friction to cause users to abandon the workflow.

---

## 35. Open Questions

The following remain product discovery questions:

- How long should an assignment remain **Awaiting acceptance** before Kindred reminds the assignee?
- Should the assigner be able to withdraw a pending assignment? **Decided: yes, any member can (BR-08, User Story 7.8).**
- Should an assigner be able to send the same responsibility to multiple potential caregivers, or only one person at a time?
- What happens if an assignment remains unanswered close to its due date? **Current MVP assumption: assignee and assigner are reminded 24 hours before (User Story 7.8).**
- Should declined assignments include an optional reason?
- Should accepted tasks automatically sync to the user's calendar, or only appointments? **Current MVP assumption: appointments by default; tasks are opt-in (User Story 5.2).**
- Is free/busy information sufficient for effective coordination?
- How frequently will users use messaging app sharing?
- Does the care recipient ever need their own Kindred account?
- Should appointment updates use a structured template or free text?
- How should Kindred support less technically confident family members?
- Is two coverage requests per month the right limit, and should this be configurable per Care Circle rather than fixed for all users? **Current MVP assumption: fixed at 2, with per-Care-Circle configurability planned as a later-phase item (see MVP Prioritization).**
- Should unused coverage requests roll over? **Current MVP assumption: no.**
- Should other caregivers see someone's remaining monthly coverage allowance? **Current MVP assumption: no.**
- With Google Calendar as the only P0 calendar, iPhone users on iCloud Calendar will show as **Unknown**. Should MVP read on-device calendars (iOS EventKit / Android Calendar Provider) to cover them? To be evaluated in the ARD.
- Should shared content (updates, comments) be kept as "Former member" when an account is deleted, or removed? Needs privacy/legal review.
- When is French language support needed, and does the MVP launch include Quebec?

---

## 36. Definition of MVP Success

Kindred's MVP is successful if families are not simply creating accounts but **changing how responsibility is coordinated**.

The strongest early signal would be Care Circles in which multiple family members repeatedly:

> **create → assign → accept → coordinate → hand off → complete**

real caregiving responsibilities through Kindred while continuing to use their calendar and messaging apps around it.

The key distinction is that Kindred does not simply show **who someone nominated** to do something. It creates a reliable record of **who actually agreed to be responsible**.

That supports the central product thesis:

> **Kindred does not need to replace the tools families already have. It needs to make those tools work together while creating clarity around who is responsible, what they have agreed to do, and whether it actually got done.**

---

## 37. Technical and Non-Functional Requirements

This section gives the constraints the Architecture Requirements Document (ARD) should design to. Items marked *Assumption* are proposed defaults to confirm or revise; items marked *Decision* have been agreed (see **38. Decision Log**).

### 37.1 Market and Language

- *Decision:* MVP launches in **Canada**.
- *Assumption:* English (Canadian spelling) at launch. French support is P1 and required before the app is made available in Quebec (Charter of the French Language).
- *Assumption:* iOS (current and previous major version) and Android 10 and later.

### 37.2 Privacy and Compliance

Appointment updates, notes, and comments may contain personal health information, so Kindred treats them as **sensitive personal information**.

- Kindred must comply with **PIPEDA** and, where applicable, provincial private-sector privacy laws: **Quebec Law 25**, **Alberta PIPA**, and **British Columbia PIPA**.
- Quebec Law 25 requires, among other things, a designated person responsible for privacy, a privacy impact assessment before transferring personal information outside Quebec, and privacy-protective default settings.
- Consent for collecting sensitive information must be express and obtained during onboarding.
- Privacy breaches that create a real risk of significant harm must be reported to the Office of the Privacy Commissioner of Canada and affected users.
- *Assumption:* Kindred is a consumer coordination tool, not a health information custodian under provincial health privacy laws (such as Ontario's PHIPA). **This must be confirmed by legal review before launch.**

### 37.3 Data Residency

- *Assumption:* all Kindred data, including backups, is stored in Canadian data centres.
- Data necessarily leaves Kindred's control when sent to third parties (push notification services, Google Calendar). Those payloads must therefore contain no sensitive content (see 37.4).

### 37.4 Security

- All traffic encrypted in transit (TLS 1.2 or later); all stored data encrypted at rest.
- Sensitive content (appointment notes, updates, comments) is never included in push notification payloads, synced calendar events, share-sheet text by default, application logs, or analytics events.
- Calendar access tokens are stored encrypted and use the minimum scopes needed to read free/busy information and manage events Kindred created.
- Links (invitations, shared items) never grant access on their own: opening one requires signing in as a member of the relevant Care Circle. Invitation links expire after 7 days.
- Changes of state are atomic and validated on the server (see §17).

### 37.5 Scale

*Assumption:* the MVP is a validation release. Design for:

- Up to 1,000 Care Circles and 5,000 users in the first 12 months, with room to grow tenfold without re-architecture.
- Typically 2–6 members per Care Circle, with a maximum of 20.
- Recurring series show occurrences at least 12 weeks ahead.

### 37.6 Performance and Reliability

*Assumption:*

- Common one-tap actions (accept, decline, claim, complete) confirm within 1 second on a typical mobile connection.
- Push notifications are sent within 1 minute of the triggering event; reminders within 1 minute of their scheduled time.
- Free/busy information is no more than 15 minutes old.
- Service availability of 99.5% per month.
- Data can be restored with at most 1 hour of loss (RPO) and service restored within 8 hours of a major failure (RTO).

### 37.7 Offline Behaviour

*Assumption:*

- When offline, Kindred shows the last-synced Home, Calendar, and Tasks, clearly marked as possibly out of date.
- Actions that change ownership or state (accept, claim, complete, request coverage) require a connection, so that two members cannot both succeed while offline. Kindred explains this clearly when offline.
- Drafts of updates and comments are kept on the device until they can be sent.

### 37.8 Data Retention

*Assumption:*

- Care Circle content is kept while the Care Circle exists.
- Completed and cancelled items are deleted 24 months after completion or cancellation.
- Deleted accounts are removed within 30 days, including from backups as they expire.

### 37.9 Analytics

- The metrics in §30 require product event tracking.
- Events record identifiers, event types, and timings only, never titles, notes, updates, or comments.
- *Assumption:* users can opt out of analytics in settings. Whether analytics needs opt-in consent instead should be confirmed by the privacy review in 37.2.

### 37.10 Integrations

| Integration | MVP approach |
| --- | --- |
| Sign-in | Sign in with Apple, Sign in with Google, email one-time code (User Story 1.2) |
| Calendar | Google Calendar: read free/busy, one-way write of accepted items (Epic 5) |
| Messaging apps | Phone share sheet with pre-filled text and links; no messaging API (Epic 9) |
| Invitations and shared links | Deep links that also work after the app is installed for the first time (User Story 1.2) |
| Push notifications | Apple Push Notification service and Firebase Cloud Messaging |

---

## 38. Decision Log

| Date | Decision | Where it is applied |
| --- | --- | --- |
| 2026-09-25 | MVP launch market is Canada | §1, §37.1–37.3 |
| 2026-09-25 | All Care Circle members have equal permissions over tasks and appointments; administrators only manage membership | User Story 2.2, BR-08 |
| 2026-09-25 | MVP supports simple recurrence (daily, weekly, monthly) with each occurrence owned independently | User Stories 7.6–7.7, BR-10 |
| 2026-09-25 | MVP assumes all members of a Care Circle share one time zone | BR-09 |
| 2026-09-25 | Each user belongs to exactly one Care Circle in MVP | BR-12 |
