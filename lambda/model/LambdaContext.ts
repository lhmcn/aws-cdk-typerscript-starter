import { Context } from "hono";
import LambdaBindings from "./LambdaBindings";

type LambdaContext = Context<{ Bindings: LambdaBindings }>;

export default LambdaContext;
