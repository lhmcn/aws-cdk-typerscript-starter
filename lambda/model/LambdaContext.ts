import { Context } from "hono";
import LambdaBindings from "./LambdaBindings";

type ContextWithLambdaBindings = Context<{ Bindings: LambdaBindings }>;

export default ContextWithLambdaBindings;
