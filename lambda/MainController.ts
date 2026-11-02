import { handle } from "@hono/aws-lambda";
import { Hono } from "hono";
import { cors } from "hono/cors";
import AdminController from "./AdminController";
import PublicController from "./PublicController";
import RootController from "./RootController";
import UserController from "./UserController";

const app = new Hono()
    .use("*", cors())
    .route("/public", PublicController)
    .route("/user", UserController)
    .route("/admin", AdminController)
    .route("/root", RootController)
    .all("*", (c) => c.notFound());

export const mainController = handle(app);
