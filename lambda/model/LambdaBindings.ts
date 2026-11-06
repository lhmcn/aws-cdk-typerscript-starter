import { LambdaContext, LambdaEvent } from "@hono/aws-lambda";

type LambdaBindings = {
    event: LambdaEvent;
    lambdaContext: LambdaContext;
    requestContext: LambdaEvent["requestContext"];
};

export default LambdaBindings;
