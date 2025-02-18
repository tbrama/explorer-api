import { mysqlTable } from "drizzle-orm/mysql-core";
import * as t from "drizzle-orm/mysql-core";

export const folders = mysqlTable("folders", {
  id: t.int().primaryKey().autoincrement(),
  parentDir: t.int(),
  foldersName: t.varchar("folders_name", { length: 120 }),
});
