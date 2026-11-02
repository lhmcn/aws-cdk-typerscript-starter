import { LambdaContext, LambdaEvent } from "@hono/aws-lambda";

type LambdaBindings = {
    event: LambdaEvent;
    lambdaContext: LambdaContext;
};

export default LambdaBindings;
