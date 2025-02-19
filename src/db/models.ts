import { t } from "elysia";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-typebox";
import { spreads } from "./utils";
import { folders } from "./schema/folders";

export const db = {
  insert: spreads(
    {
      folder: createInsertSchema(folders, {
        parentDir: t.Integer(),
        foldersName: t.String({ maxLength: 120 }),
      }),
    },
    "insert"
  ),
  update: spreads(
    {
      folder: createUpdateSchema(folders, {
        id: t.Integer(),
        parentDir: t.Integer(),
        foldersName: t.String({ maxLength: 120 }),
      }),
    },
    "update"
  ),
  select: spreads(
    {
      folder: folders,
    },
    "select"
  ),
} as const;
