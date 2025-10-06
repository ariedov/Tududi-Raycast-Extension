import { ActionPanel, Action, Icon, List, Detail, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { useState, useEffect } from "react";

interface Task {
  id: number;
  uid: string;
  name: string;
  note?: string;
  status: number;
  priority: string;
  dueDate?: string;
}

export default function Command() {
  const preferences = getPreferenceValues<{ apiUrl: string; email: string; password: string }>();
  const [tasks, setTasks] = useState<Task[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<string>("uncompleted");

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
    if (filter === "completed") return task.status === 2;
    if (filter === "uncompleted") return task.status !== 2;
    return true;
  });

  return (
    <List
      isLoading={isLoading}
      searchBarAccessory={
        <List.Dropdown tooltip="Filter Tasks" value={filter} onChange={setFilter}>
          <List.Dropdown.Item title="Uncompleted" value="uncompleted" />
          <List.Dropdown.Item title="Completed" value="completed" />
          <List.Dropdown.Item title="All" value="all" />
        </List.Dropdown>
      }
    >
      {filteredTasks?.map((task) => (
        <List.Item
          key={task.id}
          icon={task.status === 2 ? Icon.CheckCircle : Icon.Circle}
          title={task.name}
          subtitle={task.note}
          accessories={[
            { text: getStatusText(task.status) },
            { text: task.priority },
            ...(task.dueDate ? [{ text: new Date(task.dueDate).toLocaleDateString() }] : []),
          ]}
          actions={
            <ActionPanel>
              <Action title="Show Details" onAction={() => setSelectedTask(task)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
