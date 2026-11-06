import { success } from "../lib/Response";
import ContextWithLambdaBindings from "../model/LambdaContext";

export const showEvent = async (c: ContextWithLambdaBindings) => {
    if (process.env.STAGE === "dev") {
        return success(c, c.env.event);
    }

    return c.notFound();
};
