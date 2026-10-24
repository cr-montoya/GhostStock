import { GetCommand, PutCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SettingsSchema, type Settings, type UpdateSettingsRequest } from "@ghoststock/contracts";
import { SETTINGS_SK, WORKSPACE_PK, storageError } from "../adapters/dynamo.js";

export interface SettingsDeps {
  db: DynamoDBDocumentClient;
  table: string;
  lowStockDefault: number;
  now?: () => Date;
}

/** Stored settings, or the `LOW_STOCK_DEFAULT` threshold when none were saved yet. */
export async function getSettings(deps: SettingsDeps): Promise<Settings> {
  try {
    const { Item } = await deps.db.send(new GetCommand({ TableName: deps.table, Key: { PK: WORKSPACE_PK, SK: SETTINGS_SK } }));
    return SettingsSchema.parse({ lowStockThreshold: Item ? Item.lowStockThreshold : deps.lowStockDefault });
  } catch (error) {
    throw storageError(error);
  }
}

export async function updateSettings(deps: SettingsDeps, request: UpdateSettingsRequest): Promise<Settings> {
  const settings = SettingsSchema.parse(request);
  try {
    await deps.db.send(
      new PutCommand({
        TableName: deps.table,
        Item: {
          PK: WORKSPACE_PK,
          SK: SETTINGS_SK,
          entity: "SETTINGS",
          lowStockThreshold: settings.lowStockThreshold,
          updatedAt: (deps.now ?? (() => new Date()))().toISOString(),
        },
      }),
    );
  } catch (error) {
    throw storageError(error);
  }
  return settings;
}
