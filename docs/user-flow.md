# Kindred — MVP User Flow

Derived from [PRD.md](PRD.md). Each group in the chart is labelled with the PRD epics it covers; features marked **(P1)** are post-P0 per §32 MVP Prioritization.

## Key

```mermaid
flowchart LR
    k1(["Start"]) ~~~ k2["Action or screen"] ~~~ k3{"Decision"} ~~~ k4("Assignment state")
    k5[["Messaging app touchpoint"]] ~~~ k6[/"Calendar touchpoint"/] ~~~ k7>"Push notification"]
    k8["Step"] -- "main flow" --> k9["Next step"]
    k10["Step"] -. "alternative / via link" .-> k11["Next step"]

    classDef state fill:#e0e7ff,stroke:#4f46e5,color:#1e1b4b
    classDef msg fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef cal fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef notif fill:#fce7f3,stroke:#db2777,color:#831843
    class k4 state
    class k5 msg
    class k6 cal
    class k7 notif
```

## Flow

```mermaid
flowchart TD
    subgraph onboard["Onboarding · Epics 1, 2, 3, 5"]
        start(["Open Kindred"]) --> hasAcct{"Has an account?"}
        hasAcct -- No --> signup["Create account"]
        hasAcct -- Yes --> signin["Sign in"]
        signup --> invited{"Opened via invite link?"}
        signin --> invited
        invited -- Yes --> join["Join existing Care Circle<br/>(no duplicate membership)"]
        invited -- No --> createCircle["Create Care Circle<br/>(care recipient's name)"]
        createCircle --> invite[["Invite family<br/>via messaging app link"]]
        invite -. "family opens link" .-> invited
        join --> connectCal{"Connect calendar?"}
        createCircle --> connectCal
        connectCal -- Yes --> freeBusy[/"Free/busy shared<br/>(no event details)"/]
        connectCal -- No --> unknown["Availability shown as Unknown"]
    end

    subgraph nav["App tabs · §9, Epics 4, 12"]
        tabs["Bottom navigation"]
        tabs --> home["Home<br/>today, awaiting me, needs someone,<br/>coverage requests"]
        tabs --> calTab["Calendar tab<br/>items by date with owner + status"]
        tabs --> tasksTab["Tasks tab<br/>mine, awaiting me, all, completed"]
        tabs --> circleTab["Care Circle tab"]
        home --> feed["Activity feed (P1)"]
        circleTab --> settings["Members, invitations,<br/>notification preferences"]
        circleTab --> disconnect[/"Disconnect calendar"/]
    end

    subgraph assignSG["Create & assign · Epics 4, 6, 7"]
        create["Create task or appointment<br/>(title, date, time)"]
        create --> checkAvail[/"See who is free, busy or Unknown"/]
        checkAvail -.-> suggest[/"Suggest times (P1)"/]
        suggest -.-> assign
        checkAvail --> assign{"Assign to someone?"}
        assign -- No --> needsSomeone("Needs someone")
        assign -- "Yes, another member" --> awaiting("Awaiting acceptance")
        awaiting --> notifyAssignee>"Assignee notified:<br/>response required"]
        awaiting -.-> shareAssign[["Share pending assignment<br/>to messaging app"]]
        notifyAssignee --> respond{"Assignee responds"}
        shareAssign -. "assignee opens link" .-> respond
        respond -- Decline --> declined>"Assigner notified"]
        declined --> needsSomeone
        respond -- Accept --> assigned("Assigned")
        needsSomeone --> claim["Member taps 'I'll do it'"]
        claim --> assigned
    end

    subgraph itemSG["Item detail · Epics 9, 13, §17"]
        detail["Task / appointment detail"]
        detail --> comment["Comment on item (P1)"]
        comment --> commentNotif>"Owner notified<br/>per preferences"]
        detail --> shareItem[["Share to messaging app<br/>(private notes excluded by default)"]]
        shareItem -. "family opens link" .-> detail
        detail --> cancel["Cancel item"]
        cancel --> cancelled("Cancelled")
    end

    subgraph workSG["Do the work · Epics 5, 10, 11"]
        assigned --> sync[/"Sync accepted item to<br/>owner's connected calendar"/]
        sync --> remind>"Reminder before due time"]
        remind --> canDo{"Can owner still do it?"}
        canDo -- Yes --> doIt["Complete task /<br/>attend appointment"]
        doIt --> isAppt{"Appointment?"}
        isAppt -- Yes --> update["Add appointment update"]
        update --> updateNotif>"Family notified<br/>(no lock-screen details)"]
        update -.-> shareUpdate[["Share 'update available'<br/>link to messaging app (P1)"]]
        update --> followUp{"Follow-up needed?"}
        followUp -- "Yes: create linked task" --> create
        followUp -- No --> completed("Completed")
        isAppt -- No --> completed
    end

    subgraph covSG["Coverage & handoffs · Epic 8, BR-01"]
        canDo -- No --> quota{"Coverage requests left<br/>this month? (max 2)"}
        quota -- No --> blocked["Limit reached: message family<br/>or reassign directly"]
        quota -- Yes --> needsCoverage("Needs coverage")
        needsCoverage --> notifyCov>"Eligible members notified"]
        needsCoverage -.-> shareCov[["Share coverage request<br/>to messaging app"]]
        notifyCov --> taken{"Someone taps 'I can do it'?"}
        shareCov -. "family opens link" .-> taken
        taken -- Yes --> transfer[/"Ownership transfers,<br/>calendars updated"/]
        taken -- "Owner cancels request<br/>(still counts toward limit)" --> assigned
    end

    freeBusy --> tabs
    unknown --> tabs
    calTab --> create
    tasksTab --> create
    calTab --> detail
    tasksTab --> detail
    feed -. "tap item" .-> detail
    blocked -.-> awaiting
    transfer --> assigned
    completed --> feed

    classDef state fill:#e0e7ff,stroke:#4f46e5,color:#1e1b4b
    classDef msg fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef cal fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef notif fill:#fce7f3,stroke:#db2777,color:#831843
    class needsSomeone,awaiting,assigned,needsCoverage,completed,cancelled state
    class invite,shareAssign,shareItem,shareUpdate,shareCov msg
    class freeBusy,disconnect,checkAvail,suggest,sync,transfer cal
    class notifyAssignee,declined,commentNotif,remind,updateNotif,notifyCov notif
```

## Epic coverage

| PRD section | Where it appears |
| --- | --- |
| Epic 1 — Accounts | Onboarding |
| Epic 2 — Care Circles | Onboarding |
| Epic 3 — Invitations | Onboarding, Care Circle tab |
| Epic 4 — Shared calendar | Calendar tab, Create & assign |
| Epic 5 — Calendar integration | Onboarding, Care Circle tab, Do the work, Coverage |
| Epic 6 — Availability | Onboarding, Create & assign |
| Epic 7 — Tasks & assignment | Create & assign, Do the work |
| Epic 8 — Coverage | Coverage & handoffs |
| Epic 9 — Messaging app sharing | Green nodes throughout |
| Epic 10 — Appointment updates | Do the work |
| Epic 11 — Notifications | Pink nodes throughout, Care Circle tab |
| Epic 12 — Activity feed | App tabs, Item detail |
| Epic 13 — Comments | Item detail |
| §17 — Assignment states | Blue rounded nodes |
