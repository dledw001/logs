import request from "supertest";
import app from "../src/app.js";

const agent = request.agent(app);

const USERNAME = `SmokeTest_${Date.now()}`;

await agent.post("/api/auth/register").send({
    username: USERNAME,
    password: "Password123!"
});

await agent.post("/api/auth/login").send({
    username: USERNAME,
    password: "Password123!"
});

const me = await agent.get("/api/auth/me");
console.log(me.body);

await agent.post("/api/auth/logout");