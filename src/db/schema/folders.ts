import { mysqlTable } from "drizzle-orm/mysql-core";
import * as t from "drizzle-orm/mysql-core";

export const users = mysqlTable("folders", {
  id: t.int().primaryKey().autoincrement(),
  foldersName: t.varchar("folders_name", { length: 120 }),
});
