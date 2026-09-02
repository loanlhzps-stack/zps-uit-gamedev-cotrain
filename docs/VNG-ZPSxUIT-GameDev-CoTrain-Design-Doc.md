# VNG-ZPSxUIT-GameDev CoTrain

## Product, UX/UI & Technical Design Document

| Field | Value |
|---|---|
| Document version | 1.0 |
| Status | Build-ready MVP specification |
| Last updated | 31/08/2026 |
| Product type | Full-stack learning program management tool |
| Initial scope | One co-training course: **PHÁT TRIỂN KỸ NĂNG LẬP TRÌNH GAME ỨNG DỤNG TRONG THỰC TẾ** |
| Future direction | Support additional co-training classes without redesigning the core data model |
| Default language | Vietnamese |

---

## 1. Instructions for Claude

Build a production-oriented, full-stack web application from this specification. Do not treat it as a static dashboard or clickable mockup.

Mandatory principles:

- Implement real authentication, database persistence, file upload and role-based authorization.
- Enforce permissions on the server and with database Row Level Security; hiding UI elements is not sufficient.
- Use the exact product name: **VNG-ZPSxUIT-GameDev CoTrain** (renamed from the original "Learning Station" — see README).
- Use the three logo files supplied separately by the Product Owner. Do not redraw, reinterpret or generate a new logo.
- Start with one program but keep `program_id` in all program-owned entities so additional classes can be added later.
- Seed realistic sample data for the current class when final operational data is unavailable. Clearly mark sample records in development.
- Use Vietnamese interface copy unless an exact English label is specified in this document.
- Prioritize correctness, readability and smooth interaction over excessive animation.

### Logo asset mapping

The Product Owner will provide three logo files. Inspect and map them to these semantic slots:

1. `brand.logo_full_light`: full logo suitable for light backgrounds.
2. `brand.logo_full_dark`: full/inverse logo suitable for dark backgrounds.
3. `brand.logo_mark`: compact symbol for collapsed sidebar, favicon and mobile.

If the three supplied files do not match these exact variants, use the closest valid mapping and preserve the original artwork. Do not alter proportions, colors or clear space.

---

## 2. Product definition

### 2.1 Product statement

**VNG-ZPSxUIT-GameDev CoTrain** is an independent operating system for managing a co-training course. It connects course scheduling, attendance, assignments, mentoring, group progress and final game projects in one role-aware workspace.

It is not an LMS replacement, chat tool, cloud drive or source-code repository. It is the program's operational source of truth.

### 2.2 Primary objective

Help the Program Owner answer five questions quickly:

1. Chương trình đang ở giai đoạn nào?
2. Tuần này có việc gì cần xử lý?
3. Sinh viên hoặc nhóm nào đang có rủi ro?
4. Bài tập, attendance và project có đúng tiến độ không?
5. Chương trình tạo ra kết quả gì?

### 2.3 Product goals

- Centralize program information and operating actions.
- Reduce fragmented coordination through spreadsheets, chat, email and manual follow-up.
- Detect attendance, submission and project risks early.
- Give every role a focused workspace containing only relevant information and actions.
- Preserve program history, files and learning evidence.
- Make the data model reusable for future co-training classes.

### 2.4 Non-goals for MVP

- Hosting complete e-learning content.
- Replacing Google Drive, GitHub, Calendar or Google Forms.
- Built-in chat or social feed.
- Automatic Google Form completion tracking.
- AI-generated coaching or risk analysis.
- Direct trainer/judge scoring during the 17/12 checkpoint.
- Multi-program switching in the initial UI.

---

## 3. Initial program data

### 3.1 Population

| Role | Count |
|---|---:|
| Program Owner | 1 |
| Program Co-owner | 1 |
| Sponsors | 2 |
| Trainers | 11 |
| Mentor ZPS | 8 |
| Mentor Sinh viên | 7 |
| Students | 41 |
| **Initial accounts** | **70** |

### 3.2 Group structure

- 08 student groups.
- 07 groups have 5 students.
- 01 group has 6 students.
- Groups 1–7 have one Mentor ZPS and one Mentor Sinh viên.
- Group 8 has one Mentor ZPS and no Mentor Sinh viên.
- Every student in a group may edit shared group information and group drafts.
- Group 8's Mentor ZPS receives an attendance-operator exception for Group 8 only.

---

## 4. Roles and permissions

### 4.1 Roles

Use these role codes:

```text
owner
co_owner
sponsor
trainer
mentor_zps
mentor_student
student
```

### 4.2 Permission matrix

| Capability | Owner | Co-owner | Sponsor | Trainer | Mentor ZPS | Mentor SV | Student |
|---|---:|---:|---:|---:|---:|---:|---:|
| View program overview | Full | Full | Full read | General | General | General | General |
| Edit program settings | Yes | Yes | No | No | No | No | No |
| Create/invite accounts | Yes | No | No | No | No | No | No |
| Change roles/access | Yes | No | No | No | No | No | No |
| Suspend/archive accounts | Yes | No | No | No | No | No | No |
| View schedule | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Edit schedule/session | Yes | Yes | No | Own teaching details only | No | No | No |
| View all attendance | Yes | Yes | Aggregated only | Read relevant | Own group | Own group | Own record and group summary |
| Submit attendance | All groups | All groups | No | No | Group 8 exception only | Own group | No |
| Create Course Assignment | Yes | Yes | No | Own teaching session | No | No | No |
| Create Mentor Task | Yes | Yes | No | No | Own group | No | No |
| Submit personal/group work | No | No | No | No | No | No | Yes |
| Review Course Assignment | Override | Override | No | Own assignment | Comment for own group | Track only | No |
| Review Mentor Task | Override | Override | No | No | Own task | Track only | No |
| Manage group project | Full | Full | Read | Read relevant | Own group | Own group | Own group shared content |
| Upload checkpoint result | Yes | Yes | No | No | No | No | No |
| Publish checkpoint result | Yes | Yes | No | No | No | No | No |
| Send reminder | Any scope | Operational scope | No | Own assignment | Own group | Own group | No |
| View reports | Full | Full | Full read | Relevant | Own group | Own group | Personal/group |
| View audit log | Yes | Yes | No | No | No | No | No |

### 4.3 Sensitive information

- Sponsors see aggregate attendance and program health, not private absence reasons or discipline notes.
- Students may see teammates' participation status and group-level attendance health, but not private absence reasons or internal mentor notes.
- Private notes are visible only to Owner, Co-owner and the assigned Mentors.

---

## 5. Authentication, invitations and profiles

### 5.1 Authentication

- Login identifier: email.
- Owner creates an invitation by entering email, role and optional group/session assignment.
- The invited user receives an email and completes account activation.
- Never let Owner create or view another user's password.
- The service-role key must remain server-only.
- Suspended or archived memberships must immediately lose program access.

### 5.2 First-login flow

```text
Email invitation
→ Activate account / set password
→ Complete profile
→ Confirm notification preferences
→ Enter role-specific Home
```

### 5.3 Profile fields

Required editable fields:

- Avatar.
- Full name.
- Display name.
- Organization/unit.
- Job title or student information.
- Preferred theme: light, dark or system.
- Notification preferences.

System-controlled/read-only fields:

- Email.
- Role.
- Assigned program.
- Assigned group(s).
- Account status.

Profile menu actions:

- Xem hồ sơ.
- Chỉnh sửa hồ sơ.
- Cài đặt giao diện.
- Cài đặt thông báo.
- Đăng xuất.

---

## 6. Information architecture

### 6.1 Main routes

```text
/login
/auth/callback
/onboarding/profile
/app
/app/schedule
/app/schedule/[sessionId]
/app/attendance
/app/assignments
/app/assignments/[assignmentId]
/app/groups
/app/groups/[groupId]
/app/projects
/app/people
/app/reports
/app/notifications
/app/settings
/app/profile
```

### 6.2 Role-aware navigation

| Navigation item | Owner/Co-owner | Sponsor | Trainer | Mentors | Student |
|---|---:|---:|---:|---:|---:|
| Home | Yes | Yes | Yes | Yes | Yes |
| Thời khóa biểu | Yes | Yes | Yes | Yes | Yes |
| Attendance | Yes | Aggregate | Relevant | Own group | Personal/group read |
| Bài tập | Yes | No | Own | Own group | Own |
| Nhóm & Dự án | Yes | Read | Relevant read | Own group | Own group |
| People & Access | Yes | No | No | No | No |
| Báo cáo | Yes | Yes | Relevant | Own group | Personal/group |
| Settings | Yes | No | No | No | No |

---

## 7. Layout foundation

### 7.1 Application shell

Desktop:

- Persistent left Sidebar, approximately 248–264px wide.
- Sticky Main Bar/Top Bar, approximately 64–72px high.
- Fluid main workspace with 24–32px content padding.
- Optional contextual right-side panel for quick edit, reminders and record details.
- Do not place a marketing hero above the working surface.

Sidebar contains:

- Logo and product name.
- Current course card.
- Role-aware navigation.
- Collapsed mode using the supplied logo mark.
- User/profile shortcut at the bottom.

Main Bar contains:

- Current program or page title.
- Global search when relevant.
- Theme toggle.
- Notification center.
- Profile/avatar menu.

### 7.2 Welcome experience

Every role-specific Home starts with a concise personalized greeting:

```text
Welcome, {displayName} 👋
```

The supporting sentence must change by role and focus on the next useful action. Do not use a large decorative hero.

Examples:

- Owner: `Đây là những việc cần bạn chú ý trong tuần này.`
- Trainer: `Buổi học và bài tập bạn phụ trách đang ở đây.`
- Mentor: `Cùng theo sát nhịp học và tiến độ của nhóm.`
- Student: `Xem lịch học, deadline và tiến độ của bạn.`

### 7.3 Responsive behavior

- Owner, Co-owner, Sponsor and Trainer workflows are desktop-oriented.
- Mentor and Student workflows must be excellent on mobile.
- Sidebar becomes a drawer on tablet/mobile.
- Keep the Main Bar visible on mobile.
- Attendance for 5–6 students must be completable on a phone in approximately 30 seconds.
- Tables may switch to stacked cards on small screens; do not force unreadable horizontal tables for primary mobile tasks.

---

## 8. Brand and visual system

### 8.1 Brand direction

- Independent product for co-training course management.
- Orange gradient as the primary visual identity.
- Gaming vibe expressed through progress paths, checkpoints, nodes, directional shapes and polished interaction states.
- Avoid cyberpunk overload, excessive neon, cartoon UI or overly cute visuals.
- Overall feeling: modern, energetic, professional and easy to operate.

### 8.2 Typography

- Font family: **Arial**, with standard system fallbacks.
- Light-theme primary text: black/near-black.
- Dark-theme primary text: off-white for accessibility; do not keep black text on dark surfaces.
- Use clear hierarchy and compact labels; avoid long all-caps headings.

```css
font-family: Arial, Helvetica, sans-serif;
```

### 8.3 Color tokens

Suggested starting tokens; adjust only to meet contrast requirements while preserving the orange-gradient direction.

```css
:root {
  --brand-orange-1: #ff8a00;
  --brand-orange-2: #ff641f;
  --brand-orange-3: #f4511e;
  --brand-gradient: linear-gradient(135deg, #ff8a00 0%, #ff641f 52%, #f4511e 100%);

  --background: #f6f7f9;
  --surface: #ffffff;
  --surface-raised: #ffffff;
  --text-primary: #171717;
  --text-secondary: #66727e;
  --border: #e3e7eb;

  --success: #24966a;
  --warning: #df941e;
  --risk: #d84b40;
  --info: #367dcc;
}

[data-theme="dark"] {
  --background: #0d1117;
  --surface: #151b23;
  --surface-raised: #1b232d;
  --text-primary: #f4f6f8;
  --text-secondary: #aab4bf;
  --border: #293440;
}
```

### 8.4 Theme behavior

- Default theme: light.
- User can manually select Light, Dark or System in the Main Bar and Profile Settings.
- Persist preference per user profile.
- On first login, default to Light even if the system is dark, until the user changes it.
- All charts, status colors, borders, uploads and focus states must work in both themes.

### 8.5 Shapes and components

- Cards: clean surfaces, 12–16px radius, subtle border and shadow.
- Primary buttons: orange gradient with clear hover, active, loading and disabled states.
- Secondary buttons: neutral surface with border.
- Destructive actions: red, never orange.
- Timelines: visually strong checkpoint nodes connected by progress paths.
- Progress bars: segmented or node-based when tied to the learning/game journey.
- Use gaming-inspired cut corners or directional accents selectively, not on every component.
- Use icons consistently from one icon library.
- CTA labels must be action-specific: `Submit attendance`, `Gửi reminder`, `Publish kết quả`, not generic `OK`.

### 8.6 Motion

- 150–250ms transitions for hover, panel, status and progress changes.
- Respect `prefers-reduced-motion`.
- Avoid continuous decorative animation.
- Use motion to clarify state changes, not to decorate data-heavy screens.

---

## 9. Role-specific Home dashboards

### 9.1 Owner and Co-owner

Show:

- Welcome message.
- Current program phase and next milestone.
- Session readiness.
- Attendance risks.
- Missing attendance sheets.
- Upcoming deadlines.
- Submission health.
- Group/project health.
- Action Center.
- Quick actions: create session, assignment, reminder, invite member (Owner only), upload result.

### 9.2 Sponsor

Read-only executive dashboard:

- Overall program health.
- Training progress.
- Aggregate attendance.
- Assignment completion.
- Status of eight groups.
- Major risks without private details.
- Milestones and published results.

### 9.3 Trainer

- Upcoming teaching sessions.
- Full schedule.
- Session materials/readiness for owned sessions.
- Course Assignments created for owned sessions.
- Submission queue and revision requests.
- General program progress.

### 9.4 Mentor ZPS

- Full schedule.
- Own group workspace.
- Attendance read view; Group 8 operator exception.
- Deadlines and submissions for own group.
- Create/manage Mentor Tasks.
- Project progress, blockers and feedback.

### 9.5 Mentor Sinh viên

- Next session.
- One-tap entry to attendance for own group.
- Missing attendance submission alert.
- Group deadlines.
- Group health and project progress.
- Escalation/reminder actions.

### 9.6 Student

- Personal attendance rate and completion eligibility.
- Next session.
- Upcoming deadlines.
- Personal and group assignments.
- Group/project progress.
- Feedback and revision requests.
- Survey link after each completed session.

---

## 10. Schedule and sessions

### 10.1 Schedule rules

- Class normally runs Thursday, 13:30–17:00.
- Opening day 10/09/2026 starts at 13:00.
- Store explicit session dates; do not generate a rigid weekly recurrence because the schedule contains breaks.
- A class day may contain one or more learning blocks.

### 10.2 Confirmed schedule

| Date | Learning blocks |
|---|---|
| 10/09/2026 | Khai giảng; Tổng quan về Phát triển Game trên Thiết bị Di động |
| 17/09/2026 | Giới thiệu về Thiết kế Game; Thực hành: Khởi tạo Project |
| 01/10/2026 | Thực hành: Player Movement; Thực hành: Tilemap và Physics |
| 08/10/2026 | Lập trình cùng AI; Thực hành: Model 3D với Blockbench |
| 15/10/2026 | Thực hành: Enemy System; Thực hành: Combat System |
| 22/10/2026 | Ứng dụng thiết kế hướng đối tượng; Thực hành: Level Design |
| 29/10/2026 | Giao tiếp Hiệu quả cho Lập trình viên; Thực hành: Giao tiếp Hiệu quả cho Lập trình viên |
| 12/11/2026 | Làm Chủ Phát Triển Server cho Game; Thực hành: Làm chủ Phát triển Server Game |
| 19/11/2026 | Nghệ thuật trong lập trình game; Thực hành: Nghệ thuật trong lập trình game |
| 26/11/2026 | Quy trình ứng dụng Đồ họa trong Game; Thực hành: Power-ups và Items |
| 03/12/2026 | Kỹ năng Trình bày và Truyền đạt Ý tưởng; Thực hành: Kỹ năng Trình bày, Truyền đạt ý tưởng |
| 10/12/2026 | Âm thanh và Hoạt họa trong Sản xuất; Thực hành: Sound, Music, Effect |
| 17/12/2026 | Rehearsal 8 nhóm trình bày sản phẩm; Official Project Checkpoint |
| 24/12/2026 | Giới thiệu Marketing & Branding; Thực hành: UI và HUD |
| 07/01/2027 | Quản lý chất lượng toàn diện; Thực hành: Polish và Optimization |
| 21/01/2027 | Lễ Tổng Kết và Trưng bày Game (Expo) |

### 10.3 Session record

Each session contains:

- Date, start time, end time and location.
- Session status.
- One or more learning blocks.
- Assigned Trainer(s).
- Learning materials and links.
- Related Course Assignment(s).
- Survey link.
- Attendance sheet.
- Internal notes and post-session reflection.

Session statuses:

```text
draft
scheduled
ready
attendance_open
completed
cancelled
```

---

## 11. Attendance

### 11.1 Statuses

```text
present
excused_absence
unexcused_absence
not_recorded
```

Vietnamese labels:

- Có tham gia.
- Vắng có phép.
- Vắng không lý do.
- Chưa ghi nhận.

Both absence statuses count as absent for attendance completion. They remain separate for attitude/discipline handling.

### 11.2 Attendance workflow

```text
Session attendance opens
→ Mentor SV ticks 5–6 students
→ Mentor reviews group sheet
→ Mentor submits
→ Sheet locks
→ Students can view results
→ Owner/Co-owner may correct or reopen with audit reason
```

For Group 8, the assigned Mentor ZPS performs the Mentor SV attendance action.

### 11.3 Completion rule

- 16 required class days.
- A student must attend at least 80%.
- With the current schedule, at least 13/16 days are required.
- `excused_absence` and `unexcused_absence` both reduce attendance percentage.
- If partial attendance is later enabled, calculate from attended minutes; MVP records one status per class day and optional late/early note.

### 11.4 Alerts

| Rule | Result |
|---|---|
| Two consecutive absences | Highlight and create Mentor follow-up alert |
| Three total absences | Near-threshold warning |
| Four total absences | Not eligible under attendance rule |
| Multiple unexcused absences | Attitude/discipline alert |
| Attendance sheet not submitted | Operational alert to Mentor and Owners |

Student-facing views must clearly show:

- Attended count.
- Required count.
- Current percentage.
- Remaining absences before becoming ineligible.
- Current eligibility status.

---

## 12. Assignments and submissions

### 12.1 Course Assignment

Created by Owner, Co-owner or the Trainer responsible for the related session.

May target:

- Whole class.
- Selected groups.
- Individual students.
- Group submission or individual submission.

Statuses:

```text
draft
published
in_progress
submitted
late
needs_revision
completed
archived
```

The owning Trainer reviews and sets `needs_revision` or `completed`. Mentor ZPS may comment for their group but cannot alter the official result. Owner/Co-owner can override with an audit reason.

### 12.2 Mentor Task

Created by Mentor ZPS for the Mentor's assigned group only.

- Not an official Course Assignment by default.
- Does not automatically affect course results.
- May include assignees, deadline, files/links and Mentor feedback.
- Reviewed/closed by the creating Mentor ZPS.

### 12.3 Group editing and submission

All student members of a group can:

- Edit group draft content.
- Add/remove draft files and links.
- Update task progress.
- Submit a group assignment or project.
- Submit a revised version when reopened.

Safeguards:

- Show `last updated by` and timestamp.
- Keep version history.
- Confirm before official submission.
- Notify the entire group after submission.
- Lock the submitted version.
- Only reviewer or Owner/Co-owner can reopen it.

### 12.4 Supported submission evidence

- Uploaded file.
- Google Drive link.
- GitHub repository link.
- Game build link/file.
- Video/demo link.
- Submission note and version note.

---

## 13. Group Workspace

Route: `/app/groups/[groupId]`

### 13.1 Header

- Group image.
- Group name.
- Member count.
- Mentor ZPS.
- Mentor Sinh viên or `Chưa phân công`.
- Group health: `On track`, `Need attention`, `At risk`.
- Current milestone.
- Last updated information.

All student members may update the group image, group name and shared group/project content. Membership and Mentor assignment remain system-controlled.

### 13.2 Summary metrics

- Course progress: completed sessions / total sessions.
- Group attendance health.
- Group assignments completed / total.
- Final project milestone.

### 13.3 Tabs

#### Tổng quan

- Members and Mentors.
- Next session.
- Nearest deadline.
- Current Course Assignment and Mentor Task.
- Attendance warning.
- Project milestone and blockers.

#### Thành viên

- Avatar and full name.
- Role in project when defined.
- Attendance rate.
- Assigned tasks.
- Risk indicator.

#### Thời khóa biểu

- Full 16-day schedule.
- Trainer and learning blocks.
- Session status.
- Related assignment.
- Survey link after session completion.

#### Bài tập

- Separate Course Assignment and Mentor Task sections.
- Deadline, assignees, status, files, feedback and version history.

#### Attendance

- Member × session matrix on desktop.
- Session-first stacked interface on mobile.
- Mentor SV submit action.
- Student read-only view.
- Private reasons hidden from students.

#### Final Project

- Game name, image and concept.
- Members and project roles.
- Current milestone.
- Repository/build/video links.
- 17/12 checkpoint submission.
- Published feedback/result.
- Actions before Expo.
- Final submission for 21/01.

---

## 14. Milestones and final project

### 14.1 Confirmed milestones

| Date | Milestone |
|---|---|
| 10/09/2026 | Khai giảng |
| 10/09/2026–21/01/2027 | Đào tạo, theo sát tiến độ và feedback |
| 17/12/2026 | Rehearsal and official project checkpoint |
| 21/01/2027 | Tổng kết và Expo |

### 14.2 Checkpoint flow for 17/12

```text
Group submits project evidence
→ Mentor checks readiness
→ Group presents on 17/12
→ Results are consolidated outside the tool
→ Owner/Co-owner uploads official result package
→ Owner/Co-owner reviews and publishes
→ Authorized roles view the published result
```

The MVP does not require Trainers/Judges to score directly in the system.

### 14.3 Result package

Owner/Co-owner may upload:

- Excel result file.
- PDF result file.
- Google Drive link.
- Version label.
- General notes.
- Overall highlights.
- Number of groups meeting expectations.
- Number of groups requiring major improvement.
- Program-wide actions before Expo.

Result statuses:

```text
awaiting_submissions
submissions_closed
results_being_consolidated
result_uploaded
published
withdrawn
```

Upload and Publish are separate actions. Published results may be withdrawn by Owner/Co-owner without deleting the file history.

---

## 15. Survey links

- Owner/Co-owner attaches one Google Form URL to each session.
- Show the survey CTA after the session is completed.
- CTA label: `Thực hiện khảo sát buổi học`.
- The link may also appear in the Group Workspace schedule tab and Student Home.
- MVP does not claim to know whether the user completed Google Form.
- Do not display a false `Đã hoàn thành khảo sát` state without an integration.

---

## 16. Notifications and reminders

### 16.1 Mandatory MVP

- In-app notification center.
- Account invitation email.
- Notification records for attendance risk, missing attendance sheet, deadline, submission, revision, checkpoint publication and group changes.
- Owner/Co-owner can send targeted reminders.
- Trainer can remind targets of owned assignments.
- Mentors can remind members of their own group.

### 16.2 Email delivery

- Use a provider adapter such as Resend when configured.
- Never block creation of the in-app notification when email delivery fails.
- Store delivery status: `queued`, `sent`, `failed`, `skipped`.
- Do not expose provider credentials to the client.

---

## 17. Program health and early warnings

Group/program health must be rule-based and explainable.

### 17.1 Group status

`At risk` when any of the following applies:

- A student becomes attendance-ineligible.
- An official group submission is overdue.
- A required project milestone is missed.

`Need attention` when any of the following applies:

- A student has two consecutive absences.
- A student has three total absences.
- A deadline is within 48 hours and the group has no submission draft.
- An attendance sheet is missing.
- A revision deadline is approaching.

Otherwise show `On track`.

Always display the reason behind the health status and the recommended next action.

---

## 18. Core data model

Use UUID primary keys, `created_at`, `updated_at`, and soft-delete/archive fields where relevant.

### 18.1 Core tables

```text
programs
profiles
program_memberships
groups
group_members
mentor_assignments
sessions
session_blocks
attendance_sheets
attendance_records
assignments
assignment_targets
submissions
submission_versions
submission_assets
mentor_tasks
mentor_task_assignees
group_projects
project_members
project_milestones
project_submissions
checkpoint_result_packages
notifications
notification_deliveries
audit_logs
```

### 18.2 Key relationships

- `programs` has many memberships, groups, sessions, assignments and projects.
- `profiles` connect to programs through `program_memberships` with one role per program in MVP.
- Students connect to one group through `group_members` in the current program.
- Mentors connect to groups through `mentor_assignments` and a mentor type.
- Sessions contain multiple session blocks and one attendance sheet.
- Assignments target program, group or individual membership records.
- Submissions keep immutable versions and associated assets.
- Each group owns one primary final project in MVP.
- All publish, permission, attendance override and destructive actions write an audit log.

### 18.3 Suggested storage buckets

```text
avatars
group-assets
submission-assets
project-assets
checkpoint-results
```

Recommended object paths:

```text
{program_id}/{profile_id}/...
{program_id}/{group_id}/...
{program_id}/{assignment_id}/{submission_id}/...
```

Validate file type and size server-side. Use signed URLs for protected content.

---

## 19. Technical architecture

### 19.1 Recommended stack

- Next.js App Router with TypeScript.
- Tailwind CSS.
- shadcn/ui primitives.
- Supabase Auth.
- Supabase PostgreSQL.
- Supabase Row Level Security.
- Supabase Storage.
- React Hook Form + Zod for validated forms.
- date-fns for date handling.
- Vercel deployment.
- Optional Resend adapter for reminder emails.

### 19.2 Security requirements

- All mutations execute in server actions or protected route handlers.
- Validate membership, role and resource scope on every mutation.
- Enable RLS on every program-owned table.
- Never send the Supabase service-role key to the browser.
- Use signed storage access for protected assets.
- Rate-limit invitations, reminder sends and upload endpoints.
- Sanitize filenames and user-provided URLs.
- Soft-delete records where recovery or auditability matters.
- Require confirmation for submit, publish, withdraw, archive and permission changes.

### 19.3 RLS intent

- Owner/Co-owner: read/write program content; only Owner may mutate access memberships.
- Sponsor: read program-wide non-private operational data and published results.
- Trainer: read program schedule/progress; write owned session details and owned Course Assignments.
- Mentor ZPS: read own group; write Mentor Tasks and group/project feedback; Group 8 attendance exception only.
- Mentor SV: read own group; create/update/submit own group's attendance sheet.
- Student: read program schedule and own/group resources; write own submissions and shared group/project drafts.
- Nobody may access another program through guessed IDs.

---

## 20. Interaction and state requirements

For every data screen, implement:

- Loading state.
- Empty state with a useful next action.
- Error state with retry when safe.
- Success confirmation.
- Disabled state with explanation.
- Permission-denied state.
- Unsaved-change protection.
- Optimistic interaction only when rollback is safe.

For collaborative group editing:

- Display last editor and edit time.
- Detect stale updates using `updated_at` or a version number.
- Do not silently overwrite a newer saved version.
- Keep immutable submission versions after official submit.

---

## 21. Accessibility and usability

- Meet WCAG AA contrast for text, controls and statuses in both themes.
- Never rely on color alone for attendance or risk status.
- Use visible keyboard focus.
- All icon-only controls need accessible labels/tooltips.
- Forms require labels, inline validation and error summaries when needed.
- Buttons need at least 44px touch targets on mobile.
- Preserve readable Arial sizing; body text should normally be at least 14px on desktop and 15–16px on mobile.
- Tables need sticky headers when long and semantic column labels.

---

## 22. MVP acceptance criteria

The MVP is accepted only when all statements below are true.

### Authentication and access

- Owner can invite a new email, assign a role and optional group/session scope.
- Invited users can activate an account and complete Profile Setup.
- Co-owner cannot create accounts or change access.
- Server/RLS blocks unauthorized data even when a URL or request is manipulated.

### Schedule

- All 16 confirmed days and their learning blocks can be stored and displayed.
- Owner/Co-owner can edit session details.
- Trainer can access owned teaching sessions.
- Users see schedule information appropriate to their role.

### Attendance

- Mentor SV can tick and submit only their assigned group's attendance.
- Group 8 Mentor ZPS can tick and submit Group 8 only.
- Submitted sheets lock.
- Owner/Co-owner can reopen/correct with an audit reason.
- Students can view but cannot edit attendance.
- The system flags two consecutive absences and calculates the 13/16 threshold correctly.

### Assignments

- Course Assignment and Mentor Task are visibly and logically separate.
- Trainer can create/review assignments for owned sessions.
- Mentor ZPS can create/review Mentor Tasks for own group.
- Students can submit individual and shared group work.
- Official submit creates a locked version and notifies the group.

### Group Workspace

- Each group page shows image, name, members, Mentors, schedule, course progress, assignments, survey link, attendance and final project.
- Every student member may edit shared group/project content.
- Membership and Mentor assignment cannot be edited by students.
- Private attendance reasons are not exposed to students or Sponsors.

### Checkpoint and result

- Groups can submit project evidence for 17/12.
- Owner/Co-owner can upload a consolidated result package.
- Upload does not publish automatically.
- Published result visibility follows role scope.
- Result withdrawal preserves history.

### UI/UX

- Product uses supplied logos, orange gradient, Arial and black/near-black text in light mode.
- Light is the default theme; users can switch to Dark or System.
- Sidebar, Main Bar, personalized Welcome and Profile Setup are implemented.
- Mentor attendance and Student deadline/submission flows work well on mobile.
- Primary actions are visually clear and use specific CTA labels.

---

## 23. Future scope

- Multiple programs and program switcher.
- Clone a prior course/program.
- Google Calendar synchronization.
- Google Forms/Sheets completion integration.
- Google Drive and GitHub integration.
- AI summaries and explainable risk recommendations.
- Cross-season comparison.
- Mentor development/talent pipeline.
- Course template library.

---

## 24. Environment variables

Provide `.env.example` without secrets.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
RESEND_API_KEY=
EMAIL_FROM=
```

`RESEND_API_KEY` and `EMAIL_FROM` may be optional in local development, but invitation and in-app notification flows must still be testable.

---

## 25. Build sequence recommended for Claude

1. Set up design tokens, themes, shell, supplied logos and Profile Setup.
2. Create database schema, migrations, seed data and RLS policies.
3. Implement Auth and Owner invitation/access management.
4. Implement role-aware Home and navigation.
5. Implement Schedule and Session detail.
6. Implement Attendance and alert rules.
7. Implement Course Assignment, Mentor Task and submissions.
8. Implement Group Workspace and Final Project.
9. Implement checkpoint result upload/publish.
10. Implement notifications, reports and audit log.
11. Complete responsive, dark-theme, accessibility and permission testing.

Do not defer authorization, RLS, error states or mobile attendance until after the interface is complete. They are part of the product, not polish.

