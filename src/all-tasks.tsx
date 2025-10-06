import { ActionPanel, Action, Icon, List, Detail, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { useState, useEffect } from "react";

interface Project {
  id: number;
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
}

export default function Command() {
  const preferences = getPreferenceValues<{ apiUrl: string; email: string; password: string }>();
  const [tasks, setTasks] = useState<Task[]>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const currentFilterValue = statusFilter !== "all" ? `status-${statusFilter}` : projectFilter ? `project-${projectFilter}` : "status-all";

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
          const projectsData = await projectsRes.json() as any;
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

  async function completeTask(task: Task) {
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

      // Update task status to done
      const response = await fetch(`${preferences.apiUrl}/api/task/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify({ status: 2 }),
      });

      if (response.ok) {
        showToast({ title: "Task completed", style: Toast.Style.Success });
        setSelectedTask(null);
        // Refresh tasks
        setTasks(tasks?.map((t) => (t.id === task.id ? { ...t, status: 2 } : t)));
      } else {
        showToast({ title: "Failed to complete task", message: response.statusText, style: Toast.Style.Failure });
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

  if (selectedTask) {
    const markdown = `# ${selectedTask.name}\n\n${selectedTask.note || "No notes available."}\n\n**Status:** ${getStatusText(selectedTask.status)}\n**Priority:** ${selectedTask.priority}${selectedTask.dueDate ? `\n**Due Date:** ${new Date(selectedTask.dueDate).toLocaleDateString()}` : ""}`;

    return (
      <Detail
        markdown={markdown}
        actions={
          <ActionPanel>
            <Action title="Complete Task" onAction={() => completeTask(selectedTask)} />
            <Action.OpenInBrowser url={`${preferences.apiUrl}/task/${selectedTask.uid}`} />
          </ActionPanel>
        }
      />
    );
  }

  if (error) {
    return (
      <List>
        <List.Item title="Error loading tasks" subtitle={error} />
      </List>
    );
  }

  const filteredTasks = tasks?.filter((task) => {
    const statusMatch = statusFilter === "all" || task.status.toString() === statusFilter;
    const projectMatch = !projectFilter || (projectFilter === "no-project" ? !task.project_id : task.project_id?.toString() === projectFilter);
    return statusMatch && projectMatch;
  });

  const handleFilterChange = (value: string) => {
    if (value.startsWith('status-')) {
      setStatusFilter(value.slice(7));
      setProjectFilter("");
    } else if (value.startsWith('project-')) {
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
        const projectName = task.project_id ? projects.find(p => p.id === task.project_id)?.name : "";
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
                <Action title="Show Details" onAction={() => setSelectedTask(task)} />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
