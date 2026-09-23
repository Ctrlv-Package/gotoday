import {Pool} from "pg";
const g=globalThis as typeof globalThis&{gotodayPool?:Pool};
export const db=g.gotodayPool??new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},max:5});
if(process.env.NODE_ENV!=="production")g.gotodayPool=db;
