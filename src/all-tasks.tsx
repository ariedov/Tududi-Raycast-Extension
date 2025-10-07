import {
  ActionPanel,
  Action,
  Icon,
  List,
  Detail,
  getPreferenceValues,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState, useEffect } from "react";

interface Project {
  id: number;
  uid: string;
  name: string;
}

interface Tag {
  uid: string;
  name: string;
}

interface Task {
  id: number;
  uid: string;
  name: string;
  note?: string;
  status: number;
  priority: string;
  dueDate?: string;
  project_id?: number;
  tags?: Tag[];
}

export default function Command() {
  const preferences = getPreferenceValues<{ apiUrl: string; email: string; password: string }>();
  const [tasks, setTasks] = useState<Task[]>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const currentFilterValue =
    statusFilter !== "all" ? `status-${statusFilter}` : projectFilter ? `project-${projectFilter}` : "status-all";

  useEffect(() => {
    async function load() {
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

        // Fetch projects
        const projectsRes = await fetch(`${preferences.apiUrl}/api/projects`, {
          headers: cookie ? { Cookie: cookie } : undefined,
        });
        if (projectsRes.ok) {
          const projectsData = (await projectsRes.json()) as any;
          let projectsArray: any[] = [];
          if (Array.isArray(projectsData)) {
            projectsArray = projectsData;
          } else if (projectsData.data && Array.isArray(projectsData.data)) {
            projectsArray = projectsData.data;
          } else if (projectsData.projects && Array.isArray(projectsData.projects)) {
            projectsArray = projectsData.projects;
          }
          setProjects(projectsArray.filter((p: any) => p && p.id != null && p.name));
        }

        // Fetch tasks
        const tasksRes = await fetch(`${preferences.apiUrl}/api/tasks?type=all&client_side_filtering=true`, {
          headers: cookie ? { Cookie: cookie } : undefined,
        });
        if (!tasksRes.ok) {
          throw new Error("Failed to fetch tasks");
        }
        const tasksData = (await tasksRes.json()) as { data?: Task[]; tasks?: Task[] } | Task[];
        let tasksArray: Task[] | undefined;
        if (Array.isArray(tasksData)) {
          tasksArray = tasksData;
        } else if (tasksData.data && Array.isArray(tasksData.data)) {
          tasksArray = tasksData.data;
        } else if (tasksData.tasks && Array.isArray(tasksData.tasks)) {
          tasksArray = tasksData.tasks;
        }
        if (tasksArray) {
          setTasks(tasksArray);
        } else {
          throw new Error("Invalid tasks response");
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [preferences.apiUrl, preferences.email, preferences.password]);

  async function updateTaskStatus(task: Task, newStatus: number) {
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

      // Prepare full task data with updated status
      const updatedTask = {
        name: task.name,
        priority: task.priority,
        ...(task.dueDate ? { due_date: new Date(task.dueDate).toISOString() } : {}),
        status: newStatus,
        note: task.note || "",
        ...(task.project_id ? { project_id: task.project_id } : {}),
        ...(task.tags ? { tags: task.tags } : {}),
      };

      // Update task
      const response = await fetch(`${preferences.apiUrl}/api/task/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(updatedTask),
      });

      if (response.ok) {
        const statusTexts = ["not started", "in progress", "completed", "archived", "waiting"];
        showToast({ title: `Task marked as ${statusTexts[newStatus]}`, style: Toast.Style.Success });
        // Update local state
        setTasks((prev) => prev?.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
      } else {
        showToast({ title: "Failed to update task", message: response.statusText, style: Toast.Style.Failure });
      }
    } catch (error) {
      showToast({ title: "Error", message: (error as Error).message, style: Toast.Style.Failure });
    }
  }

  const getStatusText = (status: number) => {
    switch (status) {
      case 0:
        return "Not Started";
      case 1:
        return "In Progress";
      case 2:
        return "Done";
      case 3:
        return "Archived";
      case 4:
        return "Waiting";
      default:
        return "Unknown";
    }
  };

  if (error) {
    return (
      <List>
        <List.Item title="Error loading tasks" subtitle={error} />
      </List>
    );
  }

  const filteredTasks = tasks?.filter((task) => {
    const statusMatch = statusFilter === "all" || task.status.toString() === statusFilter;
    const projectMatch =
      !projectFilter ||
        (projectFilter === "no-project" ? !task.project_id : task.project_id?.toString() === projectFilter);
    return statusMatch && projectMatch;
  });

  const handleFilterChange = (value: string) => {
    if (value.startsWith("status-")) {
      setStatusFilter(value.slice(7));
      setProjectFilter("");
    } else if (value.startsWith("project-")) {
      setProjectFilter(value.slice(8));
      setStatusFilter("all");
    }
  };

  return (
    <List
      isLoading={isLoading}
      searchBarAccessory={
        <List.Dropdown tooltip="Filter Tasks" value={currentFilterValue} onChange={handleFilterChange}>
          <List.Dropdown.Section title="Status">
            <List.Dropdown.Item title="All" value="status-all" />
            <List.Dropdown.Item title="Not Started" value="status-0" />
            <List.Dropdown.Item title="In Progress" value="status-1" />
            <List.Dropdown.Item title="Done" value="status-2" />
            <List.Dropdown.Item title="Archived" value="status-3" />
            <List.Dropdown.Item title="Waiting" value="status-4" />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Project">
            <List.Dropdown.Item title="All Projects" value="project-" />
            <List.Dropdown.Item title="No Project" value="project-no-project" />
            {projects.map((project) => (
              <List.Dropdown.Item key={`project-${project.id}`} value={`project-${project.id}`} title={project.name} />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {filteredTasks?.map((task) => {
        const projectName = task.project_id ? projects.find((p) => p.id === task.project_id)?.name : "";
        return (
          <List.Item
            key={task.id}
            icon={task.status === 2 ? Icon.CheckCircle : Icon.Circle}
            title={task.name}
            subtitle={task.note}
            accessories={[
              { text: getStatusText(task.status) },
              { text: task.priority },
              ...(projectName ? [{ icon: Icon.Folder, text: projectName }] : []),
              ...(task.dueDate ? [{ text: new Date(task.dueDate).toLocaleDateString() }] : []),
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Show Details"
                  target={<TaskDetail task={task} projects={projects} updateTaskStatus={updateTaskStatus} />}
                />
                <Action.OpenInBrowser url={`${preferences.apiUrl}/task/${task.uid}`} />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

function TaskDetail({
  task,
  projects,
  updateTaskStatus,
}: {
    task: Task;
    projects: Project[];
    updateTaskStatus: (task: Task, newStatus: number) => Promise<void>;
  }) {
  const preferences = getPreferenceValues<{ apiUrl: string; email: string; password: string }>();
  const { pop } = useNavigation();

  const getStatusText = (status: number) => {
    switch (status) {
      case 0:
        return "Not Started";
      case 1:
        return "In Progress";
      case 2:
        return "Done";
      case 3:
        return "Archived";
      case 4:
        return "Waiting";
      default:
        return "Unknown";
    }
  };

  const projectName = task.project_id ? projects.find((p) => p.id === task.project_id)?.name : null;
  const tagsText = task.tags?.map((t) => t.name).join(", ") || null;
  const markdown = `# ${task.name}

**Status:** ${getStatusText(task.status)}${
task.dueDate
? `  
**Due Date:** ${new Date(task.dueDate).toLocaleDateString()}`
: ""
}

${projectName || tagsText ? `${projectName ? `📁 ${projectName}` : ""}${projectName && tagsText ? " | " : ""}${tagsText ? `🏷️ ${tagsText}` : ""}\n\n` : ""}

${task.note || "No notes available."}`;

  const isCompleted = task.status === 2;
  const actionTitle = isCompleted ? "Mark as Not Started" : "Complete Task";
  const newStatus = isCompleted ? 0 : 2;

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action title={actionTitle} onAction={() => updateTaskStatus(task, newStatus).then(() => pop())} />
          <Action.OpenInBrowser url={`${preferences.apiUrl}/task/${task.uid}`} />
        </ActionPanel>
      }
    />
  );
}
