import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "@gym/offline-queue";

type QueueItem = {
  type: "PATCH_PROGRESS";
  payload: unknown;
};

export async function enqueue(item: QueueItem): Promise<void> {
  const current = await getQueue();
  current.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(current));
}

export async function getQueue(): Promise<QueueItem[]> {
  const value = await AsyncStorage.getItem(QUEUE_KEY);
  if (!value) {
    return [];
  }
  try {
    return JSON.parse(value) as QueueItem[];
  } catch {
    return [];
  }
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
