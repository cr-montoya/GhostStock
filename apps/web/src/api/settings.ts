import { SettingsSchema, type Settings, type UpdateSettingsRequest } from "@ghoststock/contracts";
import { apiFetch } from "./client";

export function getSettings(): Promise<Settings> {
  return apiFetch("/api/settings", {}, SettingsSchema);
}

export function updateSettings(settings: UpdateSettingsRequest): Promise<Settings> {
  return apiFetch("/api/settings", { method: "PUT", body: settings }, SettingsSchema);
}
