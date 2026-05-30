import { CloudTasksClient } from '@google-cloud/tasks';
import type { RunTask } from '@schemas';

export interface RunTaskQueue {
  projectId: string;
  location: string;
  queue: string;
  workerUrl: string;
  invokerServiceAccount: string;
}

export function createRunTaskClient(): CloudTasksClient {
  return new CloudTasksClient();
}

export async function enqueueRunTask(
  client: CloudTasksClient,
  queue: RunTaskQueue,
  task: RunTask,
): Promise<string> {
  const parent = client.queuePath(queue.projectId, queue.location, queue.queue);
  const [created] = await client.createTask({
    parent,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url: queue.workerUrl,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify(task)).toString('base64'),
        oidcToken: { serviceAccountEmail: queue.invokerServiceAccount },
      },
    },
  });
  return created.name ?? '';
}
