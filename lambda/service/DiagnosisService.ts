import { success } from "../lib/Response";
import LambdaContext from "../model/LambdaContext";

export const showEvent = async (c: LambdaContext) => {
    const { event } = c.env;
    return success(c, event);
};
