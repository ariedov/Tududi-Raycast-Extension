# Tududi Changelog

## [1.1.0] - 2025-10-06

### Features
- **Note Creation Updates**: Modified POST request to use `project_uid` instead of `project_id`, and tags are now sent as a list of tag names (strings)
- **Note Details View**: Changed default action in all-notes list from copy to open details page showing note title and content
- **Browser Integration for Notes**: Added Enter action in note details to open the note in web browser using `${baseUrl}/note/${note_uid}`

### Technical Improvements
- Updated Note interface to include `uid` field
- Added NoteDetail component for displaying note details with markdown rendering

## [1.0.0] - 2025-10-06

### Features
- **Task Management**: View all tasks with comprehensive filtering options (Uncompleted, Completed, All)
- **Task Details**: Press Enter on any task to view detailed information including name, notes, status, priority, and due date
- **Task Completion**: Complete tasks directly from the details view by pressing Enter
- **Browser Integration**: Open tasks in the web browser using their unique identifier
- **Task Creation**: Create new tasks with full form support including:
  - Task name
  - Priority levels (Low, Medium, High)
  - Due date picker
  - Status selection (Not Started, In Progress, Done, Archived, Waiting)
  - Project assignment with dropdown populated from API
  - Tag assignment with multi-select dropdown populated from API
  - Notes/description
- **Visual Indicators**: 
  - Empty circles for uncompleted tasks
  - Checked circles for completed tasks
- **Form Reset**: Create task form automatically clears after successful submission
- **API Integration**: Full integration with Tududi API including authentication and real-time updates

### Technical Improvements
- Proper handling of numeric status codes as per API specification
- Client-side filtering with server-side data fetching
- Controlled form components for better UX
- TypeScript interfaces for type safety
- Error handling and user feedback via toast notifications

## [Initial Version] - {PR_MERGE_DATE}