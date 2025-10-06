import { Form, ActionPanel, Action, showToast, getPreferenceValues, Toast } from "@raycast/api";
import { useState, useEffect } from "react";

interface Project {
  id: number;
  name: string;
}

interface Tag {
  id: number;
  name: string;
}

export default function Command() {
  const preferences = getPreferenceValues<{ apiUrl: string; email: string; password: string }>();
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [status, setStatus] = useState<string>("0");
  const [note, setNote] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        // Login to get session cookie
        const loginRes = await fetch(`${preferences.apiUrl}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: preferences.email, password: preferences.password }),
        });
        if (!loginRes.ok) {
          throw new Error("Login failed");
        }
        const cookie = loginRes.headers.get("set-cookie");

        // Fetch projects
        const projectsRes = await fetch(`${preferences.apiUrl}/api/projects`, {
          headers: cookie ? { Cookie: cookie } : undefined,
        });
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(Array.isArray(projectsData) ? projectsData : projectsData.data || []);
        }

        // Fetch tags
        const tagsRes = await fetch(`${preferences.apiUrl}/api/tags`, {
          headers: cookie ? { Cookie: cookie } : undefined,
        });
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json();
          setTags(Array.isArray(tagsData) ? tagsData : tagsData.data || []);
        }
      } catch (error) {
        console.error("Failed to load projects/tags:", error);
      }
    }

    loadData();
  }, [preferences.apiUrl, preferences.email, preferences.password]);

  async function handleSubmit() {
    try {
      // Always login to get session cookie
      const loginRes = await fetch(`${preferences.apiUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: preferences.email, password: preferences.password }),
      });
      if (!loginRes.ok) {
        throw new Error("Login failed");
      }
      const cookie = loginRes.headers.get("set-cookie");

      // Create task
      const response = await fetch(`${preferences.apiUrl}/api/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify({
          name,
          priority,
          ...(dueDate ? { due_date: dueDate.toISOString() } : {}),
          status: parseInt(status),
          note,
          ...(selectedProject ? { project_id: parseInt(selectedProject) } : {}),
          ...(selectedTags.length > 0 ? { tag_ids: selectedTags.map((id) => parseInt(id)) } : {}),
        }),
      });

      if (response.ok) {
        showToast({ title: "Task created successfully", style: Toast.Style.Success });
        // Reset form
        setName("");
        setPriority("medium");
        setDueDate(undefined);
        setStatus("0");
        setNote("");
        setSelectedProject("");
        setSelectedTags([]);
      } else {
        showToast({ title: "Failed to create task", message: response.statusText, style: Toast.Style.Failure });
      }
    } catch (error) {
      showToast({ title: "Error", message: (error as Error).message, style: Toast.Style.Failure });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Create a new Tududi task." />
      <Form.TextField id="name" title="Name" placeholder="Enter task name" value={name} onChange={setName} />

      <Form.Dropdown id="priority" title="Priority" value={priority} onChange={setPriority}>
        <Form.Dropdown.Item value="low" title="Low" />
        <Form.Dropdown.Item value="medium" title="Medium" />
        <Form.Dropdown.Item value="high" title="High" />
      </Form.Dropdown>

      <Form.DatePicker id="dueDate" title="Due Date" value={dueDate} onChange={(date) => setDueDate(date || null)} />
      <Form.Dropdown id="status" title="Status" value={status} onChange={setStatus}>
        <Form.Dropdown.Item value={"0"} title="Not Started" />
        <Form.Dropdown.Item value={"1"} title="In Progress" />
        <Form.Dropdown.Item value={"2"} title="Done" />
        <Form.Dropdown.Item value={"3"} title="Archived" />
        <Form.Dropdown.Item value={"4"} title="Waiting" />
      </Form.Dropdown>
      <Form.Dropdown id="project" title="Project" value={selectedProject} onChange={setSelectedProject}>
        <Form.Dropdown.Item value="" title="No Project" />
        {projects.map((project) => (
          <Form.Dropdown.Item key={project.id} value={project.id.toString()} title={project.name} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown id="tags" title="Tags" value={selectedTags} onChange={setSelectedTags}>
        {tags.map((tag) => (
          <Form.Dropdown.Item key={tag.id} value={tag.id.toString()} title={tag.name} />
        ))}
      </Form.Dropdown>
      <Form.TextArea id="note" title="Note" placeholder="Enter task note" value={note} onChange={setNote} />
    </Form>
  );
}
