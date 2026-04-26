# Covaled Events App — User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [All Trips](#all-trips)
3. [Admin Dashboard](#admin-dashboard)
4. [Participants](#participants)
5. [Groups](#groups)
6. [Schedule (Events)](#schedule)
7. [Notes Feed](#notes-feed)
8. [Import](#import)
9. [File Management](#file-management)
10. [Broadcasts](#broadcasts)
11. [Attendee Microsite](#attendee-microsite)

---

## Getting Started

### Signing Up & Logging In

1. Navigate to the app and click **Sign Up** to create an account.
2. Enter your email, password, display name, phone, company, and role.
3. After signing up, log in with your email and password.
4. If you forget your password, use the **Forgot Password** link on the login page to receive a reset email.

---

## All Trips

The **All Trips** page is your home base. From here you can manage all of your trips and account settings.

### Creating a Trip

1. Click **+ New Trip** in the top-right corner.
2. Enter a **Trip Title**, **Start Date**, **End Date**, and **Timezone**.
3. Optionally invite additional admins by email — they'll get access to manage the trip alongside you.
4. Click **Create Trip**.

### Trip Settings (Edit Modal)

Click the **gear icon** on any trip card to open its settings:

- **Title, Dates, Timezone** — Edit basic trip information.
- **Theme** — Customize the color scheme that attendees see on their microsite. Choose from preset themes (Dark, Light) or set custom colors for primary, secondary, surface, border, text, and alert colors.
- **Logo** — Upload a logo image that appears on the trip header and attendee microsite.
- **Manage Admins** — Invite additional admins by email, or remove existing admins. Each admin can be assigned a "super" or "admin" role.
- **Delete Trip** — Two-step confirmation process to permanently delete a trip and all its data.

### Account Settings

Click the **gear icon** in the top-right corner of the All Trips page:

- **General** — Set your organization name, display name, phone, company, role, and timezone.
- **Account** — Change your password.
- **Users** (super admin only) — View and manage all users in your organization.

### Selecting a Trip

Click on any trip card to enter its **Dashboard**. The selected trip is remembered for your session.

---

## Admin Dashboard

After selecting a trip, you land on the **Dashboard** — a grid of six navigation tiles:

| Tile | Description |
|------|-------------|
| **Participants** | Manage your attendees |
| **Groups** | Manage group assignments |
| **Schedule** | Calendar & activities |
| **Notes Feed** | Participant submissions |
| **Import** | CSV participants & ICS calendar |
| **File Management** | Fact sheets & configuration |

Below the navigation grid is the **Broadcast Composer** (see [Broadcasts](#broadcasts)).

The header bar shows your trip logo/title, date range, and navigation links to **All Trips** and **Logout**.

---

## Participants

### Viewing Participants

Participants are displayed as cards showing their name, photo (or initial), title, company, and group assignment. Click any card to view their full details.

### Participant Detail View

The detail view has five tabs:

- **Personal** — Name, email, phone, and a button to copy their unique attendee microsite link.
- **Flights** — Arrival and departure airline, flight number, time, and airport.
- **Hotel & Fun** — Hotel name, check-in/out dates, room type, dietary restrictions, fun diversions, and notes.
- **Emergency** — Emergency contact name, phone, and relationship.
- **Group** — Which group they belong to, with the group lead's info.

### Adding a Participant

1. Click **+ Add Participant** in the top-right corner.
2. Fill in the participant's information across the available tabs:
   - **Personal**: Name (required), email, phone, title, company, photo upload.
   - **Flights**: Arrival/departure airline, flight number, datetime, airport.
   - **Hotel & Fun**: Hotel, check-in/out, room type, dietary needs, fun diversions, notes.
   - **Emergency**: Emergency contact name, phone, relationship.
   - **Group**: Assign to an existing group from the dropdown.
3. Click **Save**.

### Editing a Participant

Click a participant card, then click **Edit** in the detail view. The same tabbed form opens pre-filled with their current information.

### Deleting a Participant

Open the edit modal for a participant and click **Delete** at the bottom.

### Copying Attendee Links

Each participant has a unique microsite URL. In the detail view's Personal tab, click **Copy URL** to copy it to your clipboard. Share this link with the participant so they can access their personalized microsite.

---

## Groups

### What Are Groups?

Groups let you organize participants into sub-teams. Each group has a **name**, an optional **group lead** (with name, email, phone, and photo), and assigned participants. Events can be assigned to specific groups so only those participants see them.

### Creating a Group

1. Click **+ Add Group**.
2. Enter a **Group Name**.
3. Optionally fill in lead information: name, email, phone, and photo.
4. You can import lead details from an existing participant using the **Import from Participant** dropdown.
5. Click **Save**.

### Editing a Group

Click **Edit** on any group card. The same form opens with current information.

### Deleting a Group

Click **Delete** on a group card. Participants in the group will be unassigned.

### Group Cards

Each group card shows:
- Group lead photo and name
- Lead email and phone (clickable)
- Number of assigned participants
- Edit and Delete buttons

---

## Schedule

### Calendar View

The Schedule page shows a full interactive calendar powered by FullCalendar. You can switch between:

- **Month View** — Overview of all events in a month grid.
- **Week View** — Detailed hour-by-hour view of the week.
- **Day View** — Detailed hour-by-hour view of a single day.
- **List View** — A flat list of upcoming events.

On mobile, it defaults to a **list view** for easier reading.

Events are color-coded:
- **Primary color** — Mandatory events
- **Alert/amber color** — Optional events

### Creating an Event

1. Click the **+ Add Event** button, or click on a time slot in the calendar.
2. Fill in the event form:
   - **Title** (required)
   - **Date**, **Start Time**, **End Time** — End time auto-fills 1 hour after start.
   - **Location**
   - **Type** — Mandatory or Optional (affects color coding).
   - **Group** — Assign to "All Groups" or a specific group. Group-specific events only appear for those participants.
   - **Talking Points** — Preparation notes visible to attendees.
   - **Description** — Detailed event information.
   - **Meeting Contacts** — Add up to 5 people the attendees will be meeting. Each contact has a name, title, and optional photo. Drag to reorder.
   - **Meeting Lead** — Select a participant as the meeting lead.
3. Click **Save Event**.

### Editing an Event

Click any event on the calendar to open its edit form.

### Deleting an Event

Open an event and click **Delete Event** at the bottom of the form.

### Significant Change Detection

When you edit an event, the system detects "significant changes" (title, time, location, or type) vs. minor edits (description, talking points). Only significant changes trigger update notifications to attendees.

---

## Notes Feed

### What Is the Notes Feed?

The Notes Feed shows all journal entries submitted by participants from their microsite. Participants can write notes about specific events or general observations.

### Viewing Notes

Notes appear as cards showing:
- Participant name, photo, company, and title
- The note content (with preserved formatting)
- Timestamp
- If linked to an event: the event title, time, location, and type (expandable)

### Filtering & Sorting

- **Filter by Participant** — Dropdown to show notes from a specific person.
- **Filter by Group** — Dropdown to show notes from a specific group.
- **Sort Order** — Toggle between newest-first and oldest-first.

### Deleting Notes

Click the **X** button on any note to delete it (with confirmation).

---

## Import

The Import page has two tabs: **CSV** (for participants) and **ICS** (for calendar events).

### Importing Participants via CSV

1. Select the **CSV** tab.
2. Click **Choose File** and select your CSV file.
3. Click **Preview Import** to see a summary of what will be imported.
4. Review the preview showing the number of participants and the column mapping.
5. Click **Import [N] Participants** to confirm.
6. The system maps CSV columns to participant fields (name, email, phone, title, company, etc.).

### Importing Events via ICS

1. Select the **ICS** tab.
2. Click **Choose File** and select an ICS calendar file.
3. Choose an **Event Type** (mandatory or optional).
4. Optionally assign a **Group** — imported events will be assigned to this group.
5. Click **Preview Import** to see a summary.
6. Review the preview showing event titles, dates, and locations.
7. Click **Import [N] Events** to confirm.

---

## File Management

The File Management page has four sections:

### Fact Sheets

Fact sheets are PDF documents shared with attendees on their microsite.

- **Upload**: Enter a label and select a PDF file (max 20MB), then click **Upload**.
- **Set Active**: Click **Set Active** on a fact sheet to make it the one visible to attendees. Only one can be active at a time.
- **Delete**: Click the **X** to remove a fact sheet.

### Documents & Maps

Documents and maps are additional files (PDF or images) available to attendees.

- **Upload**: Enter a label, choose the type (Document or Map), optionally assign to a group, and select a file (max 20MB).
- Documents assigned to a group are only visible to participants in that group.
- **Delete**: Click the **X** to remove.

### Trip Photos

View and manage photos uploaded by attendees to the trip album.

- Shows the total photo count.
- **Download All as ZIP** — Downloads all trip photos in a ZIP file, organized by participant.

---

## Broadcasts

The Broadcast Composer lives at the bottom of the Admin Dashboard.

### Sending a Broadcast

1. Enter your **name** (the "from" name attendees will see).
2. Type your **message**.
3. Choose the **audience**:
   - **Everyone** — All participants across all groups.
   - **Specific Group** — Only participants in the selected group.
4. Click **Send Broadcast**.

### Viewing Past Broadcasts

Click to expand the **Recent Broadcasts** section to see previously sent messages with their timestamp, sender, and audience.

Broadcasts appear on the attendee microsite as a collapsible "Note from [Name]" banner at the top of the page.

---

## Attendee Microsite

Each participant has a unique microsite URL (accessed via their personal link). This is what participants see and interact with.

### Profile Section

At the top, participants see their photo, name, title, company, and group info. They can:

- **Edit their profile** — Click the pencil icon to update personal info, flight details, hotel info, dietary needs, and emergency contacts.
- **Upload a profile photo** — Click the camera icon on their avatar.

### Group Info

If assigned to a group, participants see their group lead's name, email, and phone (clickable to call/email).

### Calendar / Schedule

A day-by-day scrollable calendar showing all events for the trip. Each event card shows:

- Time, title, and location
- Color-coded by type (mandatory vs. optional)
- Click to expand and see: description, talking points, meeting contacts with photos, and team attendees

### Talking Points & Meeting Contacts

When an event has talking points or meeting contacts, these appear in the expanded event popover. Meeting contacts show photos, names, and titles.

### Documents Section

Expandable section showing:
- **Fact Sheet** — The active fact sheet PDF (opens in a new tab).
- **Documents** — Any documents assigned to the participant's group or all groups.

### Maps Section

Expandable section showing uploaded maps relevant to the participant's group.

### Journal

Participants can write notes/observations:
- Each note can optionally be linked to a specific event.
- Notes are submitted to the admin's Notes Feed.
- Participants can view and delete their own notes.

### Trip Photos

Participants can upload photos to the shared trip album:
- **Select multiple photos at once** for bulk upload.
- Photos are automatically compressed and converted to JPEG.
- Supports all image formats including HEIC from iPhones.
- Progress indicator shows "Uploading 3 of 7..." during bulk uploads.

### Broadcasts

Broadcast messages from admins appear as a collapsible banner at the top of the page, showing the sender name and message.

### Calendar Download

Participants can download the trip schedule as an **ICS file** to add events to their personal calendar app.

### Install as App (PWA)

On supported devices, participants see a prompt to **Add to Home Screen**, which installs the microsite as a progressive web app for quick access.
