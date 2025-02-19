import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { db } from "./db/models";
import {folders}  from "./db/schema/folders";
import { eq, lt, gte, ne } from 'drizzle-orm';
import { folders } from "./db/schema/folders";
import { eq, lt, gte, ne, sql, and } from "drizzle-orm";
import { mkdir, readdir, appendFile } from "node:fs/promises";
import { unionAll } from "drizzle-orm/mysql-core";
import { files } from "./db/schema/files";
import dayjs from "dayjs";

const conn = drizzle(process.env.DATABASE_URL as string);

const { folder :inFolder }   = db.insert
const { folder :selectFolder }   = db.select

const { folder: inFolder, file: inFile } = db.insert;

const app = new Elysia()
  .use(swagger())
  .get("/", () =>{
    const result =  conn.select().from(folders).where(eq(folders.parentDir,0));
     return result
    })
  .post('/add-folder', async  ({ body }) => {
   const resultFolder =   await conn.insert(folders).values(body).$returningId();
    return {id_folder:resultFolder.map((val)=>val.id) }
	}, 
  {
		body: t.Object({
      parentDir: inFolder.parentDir,
      foldersName: inFolder.foldersName,
  .use(swagger({ path: "docs" }))
  .onError(async ({ error, code, path }) => {
    if (code === "NOT_FOUND") return;
    const file = Bun.file(`logs/explorer-${dayjs().format("DD-MM-YYYY")}.log`);
    const exists = await file.exists();
    if (!exists) {
      await mkdir(`logs`);
      await Bun.write(`logs/explorer-${dayjs().format("DD-MM-YYYY")}.log`, "");
    }

    await appendFile(
      `logs/explorer-${dayjs().format("DD-MM-YYYY")}.log`,
      `${path} ${dayjs().format("DD-MM-YYYY HH:mm:ss")}: ${JSON.stringify(
        error
      )}\n\n`
    );
    // console.error(error);
  })
  .get("/", async () => {
    const result = conn.select().from(folders).where(eq(folders.parentDir, 0));
    // const result = await readdir("explorer/", { recursive: false });
    return result;
  })
  .post(
    "/add-folder",
    async ({ body }) => {
      const regex = /^[a-zA-Z0-9\s]+$/;
      if (!regex.test(body.foldersName))
        return {
          list: Array(),
          msg: `Nama folder tidak boleh ada spesial karakter`,
        };

      const checkExist = await conn
        .select()
        .from(folders)
        .where(
          and(
            eq(folders.foldersName, body.foldersName),
            eq(folders.parentDir, body.parentDir)
          )
        );
      if (checkExist.length) {
        return { list: Array(), msg: `Folder ${body.foldersName} sudah ada` };
      }

      const resultFolder = await conn
        .insert(folders)
        .values(body)
        .$returningId();
      const resFdlr = resultFolder.map((val) => val.id)[0];

      const resUnion = await conn.execute(
        sql.raw(`WITH RECURSIVE hierarchy_paths AS (
          SELECT id, folders_name, parentDir, CAST(folders_name AS VARCHAR(255)) AS path
          FROM folders
          WHERE parentDir = 0
          UNION ALL
          SELECT h.id, h.folders_name, h.parentDir,
          CAST(CONCAT(hp.path, '/', h.folders_name) AS VARCHAR(255)) AS path
          FROM folders h
          INNER JOIN hierarchy_paths hp ON h.parentDir = hp.id
          )
          SELECT *
          FROM hierarchy_paths`)
      );

      //@ts-ignore
      const path = resUnion[0].find(({ id }) => id == resFdlr).path;

      await mkdir(`explorer/${path}`, { recursive: true });

      return { list: resUnion[0], msg: "" };
    },
    {
      body: t.Object({
        parentDir: inFolder.parentDir,
        foldersName: inFolder.foldersName,
      }),
    }
  )
    }
		)}
  )
  .listen(3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
