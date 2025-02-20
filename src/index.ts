import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { db } from "./db/models";
import { folders } from "./db/schema/folders";
import { eq, lt, gte, ne, sql, and, or, like } from "drizzle-orm";
import { mkdir, readdir, appendFile, rename, rm } from "node:fs/promises";
import dayjs from "dayjs";
import { cors } from "@elysiajs/cors";

const conn = drizzle(process.env.DATABASE_URL as string);

const { folder: inFolder } = db.insert;
const { folder: upFolder } = db.update;

export interface FolderType {
  id: number;
  folders_name: string;
  parentDir: number;
  isFile: number;
  path: string;
  child: any[];
}

const app = new Elysia()
  .use(
    cors({
      credentials: false,
      origin: "http://localhost:3000",
      methods: ["GET", "PUT", "POST"],
    })
  )
  .use(swagger({ path: "docs" }))
  .group("/explorer-api/v1", (app) =>
    app
      .onError(async ({ error, code, path }) => {
        if (code === "NOT_FOUND") return;
        const file = Bun.file(
          `logs/explorer-${dayjs().format("DD-MM-YYYY")}.log`
        );
        const exists = await file.exists();
        if (!exists) {
          const folderExist = await readdir("logs");
          if (!folderExist) await mkdir(`logs`);
          await Bun.write(
            `logs/explorer-${dayjs().format("DD-MM-YYYY")}.log`,
            ""
          );
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
        const res = await conn
          .select()
          .from(folders)
          .where(and(eq(folders.parentDir, 0), eq(folders.isFile, 0)));
        const result: FolderType[] = res as unknown as FolderType[];
        return { list: result };
      })
      .get(
        "/:index",
        async ({ params: { index } }) => {
          const resUnion = await conn.execute(
            sql.raw(`WITH RECURSIVE hierarchy_paths AS (
          SELECT id, folders_name, parentDir, isFile, CAST(folders_name AS VARCHAR(255)) AS path
          FROM folders
          WHERE parentDir = 0
          UNION ALL
          SELECT h.id, h.folders_name, h.parentDir, h.isFile,
          CAST(CONCAT(hp.path, '/', h.folders_name) AS VARCHAR(255)) AS path
          FROM folders h
          INNER JOIN hierarchy_paths hp ON h.parentDir = hp.id
          )
          SELECT *
          FROM hierarchy_paths`)
          );
          let path = "Home";
          if (index > 0) {
            //@ts-ignore
            path = resUnion[0].find(({ id }) => id == index).path;
          }
          return {
            //@ts-ignore
            list: resUnion[0].filter(({ parentDir }) => parentDir == index),
            path: path,
          };
        },
        {
          params: t.Object({
            index: t.Number(),
          }),
        }
      )
      .post(
        "/add-folder",
        async ({ body }) => {
          console.log(body);
          const regex = /^[a-zA-Z0-9\s_-]+$/;
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
            return {
              list: Array(),
              msg: `Folder ${body.foldersName} sudah ada`,
            };
          }

          const resultFolder = await conn
            .insert(folders)
            .values({
              parentDir: body.parentDir,
              foldersName: body.foldersName,
              isFile: 0,
            })
            .$returningId();
          const resFdlr = resultFolder.map((val) => val.id)[0];

          const resUnion = await conn.execute(
            sql.raw(`WITH RECURSIVE hierarchy_paths AS (
          SELECT id, folders_name, parentDir, isFile, CAST(folders_name AS VARCHAR(255)) AS path
          FROM folders
          WHERE parentDir = 0
          UNION ALL
          SELECT h.id, h.folders_name, h.parentDir, h.isFile,
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

          return {
            //@ts-ignore
            list: resUnion[0].filter(
              ({ parentDir }: any) => parentDir == body.parentDir
            ),
            msg: "",
          };
        },
        {
          body: t.Object({
            foldersName: inFolder.foldersName,
            parentDir: inFolder.parentDir,
          }),
        }
      )
      .post(
        "/rename-folder",
        async ({ body }) => {
          const regexFolder = /^[a-zA-Z0-9\s_-]+$/;
          if (!regexFolder.test(body.foldersName) && !body.isFile)
            return {
              list: Array(),
              msg: `Nama folder tidak boleh ada spesial karakter`,
            };

          const regexFile = /^[a-zA-Z0-9\s._-]+$/;
          if (!regexFile.test(body.foldersName) && body.isFile)
            return {
              list: Array(),
              msg: `Nama file tidak boleh ada spesial karakter`,
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
            return {
              list: Array(),
              msg: `${body.isFile ? "File " : "Folder "} ${
                body.foldersName
              } sudah ada`,
            };
          }

          await conn
            .update(folders)
            .set({ foldersName: body.foldersName })
            .where(eq(folders.id, body.id));
          const newPath = body.path.substring(0, body.path.lastIndexOf("/"));
          await rename(
            `explorer/${body.path}`,
            `explorer/${newPath}/${body.foldersName}`
          );

          const resUnion = await conn.execute(
            sql.raw(`WITH RECURSIVE hierarchy_paths AS (
          SELECT id, folders_name, parentDir, isFile, CAST(folders_name AS VARCHAR(255)) AS path
          FROM folders
          WHERE parentDir = 0
          UNION ALL
          SELECT h.id, h.folders_name, h.parentDir, h.isFile,
          CAST(CONCAT(hp.path, '/', h.folders_name) AS VARCHAR(255)) AS path
          FROM folders h
          INNER JOIN hierarchy_paths hp ON h.parentDir = hp.id
          )
          SELECT *
          FROM hierarchy_paths`)
          );

          return {
            list: resUnion[0],
            msg: "",
          };
        },
        {
          body: t.Object({
            id: upFolder.id,
            parentDir: upFolder.parentDir,
            foldersName: upFolder.foldersName,
            path: t.String(),
            isFile: t.Number(),
          }),
        }
      )
      .post(
        "/add-files",
        async ({ body }) => {
          const regex = /^[a-zA-Z0-9\s._-]+$/;
          if (!regex.test(body.file.name))
            return {
              list: Array(),
              msg: `Nama file tidak boleh ada spesial karakter`,
            };

          const checkExist = await conn
            .select()
            .from(folders)
            .where(
              and(
                eq(folders.foldersName, body.file.name),
                eq(folders.parentDir, body.parentDir)
              )
            );
          if (checkExist.length) {
            return { list: Array(), msg: `File ${body.file.name} sudah ada` };
          }

          const res = await conn
            .insert(folders)
            .values({
              parentDir: body.parentDir,
              foldersName: body.file.name,
              isFile: 1,
            })
            .$returningId();
          const idF = res.map((val) => val.id)[0];

          const resUnion = await conn.execute(
            sql.raw(`WITH RECURSIVE hierarchy_paths AS (
          SELECT id, folders_name, parentDir, isFile, CAST(folders_name AS VARCHAR(255)) AS path
          FROM folders
          WHERE parentDir = 0
          UNION ALL
          SELECT h.id, h.folders_name, h.parentDir, h.isFile,
          CAST(CONCAT(hp.path, '/', h.folders_name) AS VARCHAR(255)) AS path
          FROM folders h
          INNER JOIN hierarchy_paths hp ON h.parentDir = hp.id
          )
          SELECT *
          FROM hierarchy_paths`)
          );

          //@ts-ignore
          const path = `${resUnion[0].find(({ id }) => id == idF).path}`;

          await Bun.write(`explorer/${path}`, body.file);
          return {
            //@ts-ignore
            list: resUnion[0].filter(
              ({ parentDir }: any) => parentDir == body.parentDir
            ),
          };
        },
        {
          body: t.Object({
            parentDir: inFolder.parentDir,
            file: t.File({ format: "*" }),
          }),
        }
      )
      .post(
        "/delete",
        async ({ body }) => {
          await conn
            .delete(folders)
            .where(or(eq(folders.id, body.id), eq(folders.parentDir, body.id)));

          await rm(`explorer/${body.path}`, { recursive: true });
          const resUnion = await conn.execute(
            sql.raw(`WITH RECURSIVE hierarchy_paths AS (
          SELECT id, folders_name, parentDir, isFile, CAST(folders_name AS VARCHAR(255)) AS path
          FROM folders
          WHERE parentDir = 0
          UNION ALL
          SELECT h.id, h.folders_name, h.parentDir, h.isFile,
          CAST(CONCAT(hp.path, '/', h.folders_name) AS VARCHAR(255)) AS path
          FROM folders h
          INNER JOIN hierarchy_paths hp ON h.parentDir = hp.id
          )
          SELECT *
          FROM hierarchy_paths`)
          );

          return {
            //@ts-ignore
            list: resUnion[0].filter(
              ({ parentDir }: any) => parentDir == body.parentDir
            ),
          };
        },
        {
          body: t.Object({
            path: t.String(),
            id: t.Number(),
            parentDir: t.Number(),
          }),
        }
      )
      .post(
        "/carifolder",
        async ({ body }) => {
          const res = await conn.execute(
            sql.raw(`WITH RECURSIVE hierarchy_paths AS (
          SELECT id, folders_name, parentDir, isFile, CAST(folders_name AS VARCHAR(255)) AS path
          FROM folders
          WHERE parentDir = 0
          UNION ALL
          SELECT h.id, h.folders_name, h.parentDir, h.isFile,
          CAST(CONCAT(hp.path, '/', h.folders_name) AS VARCHAR(255)) AS path
          FROM folders h
          INNER JOIN hierarchy_paths hp ON h.parentDir = hp.id
          )
          SELECT *
          FROM hierarchy_paths WHERE folders_name LIKE '%${body.cari}%';`)
          );
          const result = res[0] as unknown as FolderType[];
          return { list: result };
        },
        {
          body: t.Object({
            cari: t.String(),
          }),
        }
      )
  )
  .listen(3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
