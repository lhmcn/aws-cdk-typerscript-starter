import { Context } from "hono";

interface ResponseBody<T = any> {
    code?: string;
    message?: string;
    data: T;
}

const buildResponseBody = <T = any>(
    data: T,
    code?: string,
    message?: string
): ResponseBody<T> => ({
    code,
    message,
    data
});

export const success = <T = any>(c: Context, data: T) =>
    c.json(buildResponseBody(data));

export const requestError = (c: Context, code: string, message: string) =>
    c.json(buildResponseBody(undefined, code, message), 400);

export const forbidden = (c: Context) =>
    c.json(
        buildResponseBody(
            undefined,
            "Forbidden",
            "You do not have access to this resource"
        ),
        403
    );

export const serverError = (
    c: Context,
    code = "ServerErrorUnknown",
    message = "An error occurred on the server, please contact the technical support"
) => c.json(buildResponseBody(undefined, code, message), 500);
