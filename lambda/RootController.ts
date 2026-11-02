import { Hono } from "hono";
import LambdaBindings from "./model/LambdaBindings";
import * as DiagnosisService from "./service/DiagnosisService";

const controller = new Hono<{ Bindings: LambdaBindings }>();

controller.get("/event", (c) => DiagnosisService.showEvent(c));

export default controller;
