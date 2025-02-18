import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { db } from "./db/models";
import {folders}  from "./db/schema/folders";
import { eq, lt, gte, ne } from 'drizzle-orm';

const conn = drizzle(process.env.DATABASE_URL as string);

const { folder :inFolder }   = db.insert
const { folder :selectFolder }   = db.select


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
    }
		)}
  )
  .listen(3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
