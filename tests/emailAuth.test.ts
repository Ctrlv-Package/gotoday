import test from "node:test";
import assert from "node:assert/strict";
import {cleanEmail,hashPassword,validEmail,validPassword,verifyPassword} from "../lib/auth";

test("password hashing round-trips and rejects wrong passwords",async()=>{
 const h=await hashPassword("correct horse");
 assert.equal(await verifyPassword("correct horse",h),true);
 assert.equal(await verifyPassword("wrong horse",h),false);
 assert.equal(await verifyPassword("correct horse","garbage"),false);
});

test("the same password hashes differently twice (random salt)",async()=>{
 const a=await hashPassword("same-password"),b=await hashPassword("same-password");
 assert.notEqual(a,b);
 assert.equal(await verifyPassword("same-password",a),true);
 assert.equal(await verifyPassword("same-password",b),true);
});

test("email and password validation",()=>{
 assert.equal(validEmail("ana@example.com"),true);
 assert.equal(validEmail("ANA@Example.COM"),true);
 assert.equal(validEmail("not-an-email"),false);
 assert.equal(validEmail("a@b"),false);
 assert.equal(validEmail("a b@c.com"),false);
 assert.equal(validPassword("12345678"),true);
 assert.equal(validPassword("short"),false);
 assert.equal(validPassword("x".repeat(201)),false);
 assert.equal(cleanEmail("  ANA@Example.COM "),"ana@example.com");
});
