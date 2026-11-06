import { LambdaEvent } from "@hono/aws-lambda";
import { v7 } from "uuid";

export type UserCredential = {
    UserPoolId: string;
    sub: string;
    IdentityId: string | null;
};

export type PaginatedItems<T = any> = {
    items: T[];
    count: number;
};

export const getFileExtension = (filename: string): string => {
    const ext = filename.split(".").slice(-1)[0];
    return ext === filename ? "" : ext;
};

export const extractUserCredential = (event: LambdaEvent): UserCredential => {
    const credentials: UserCredential = {
        UserPoolId: "",
        sub: "",
        IdentityId: null
    };

    const identity = (event.requestContext as any).identity;
    if (identity) {
        credentials.IdentityId = identity.cognitoIdentityId || null;

        const provider = identity.cognitoAuthenticationProvider as string;
        if (provider) {
            const segments = provider.split("/")[2].split(":");
            credentials.UserPoolId = segments[0];
            credentials.sub = segments[2];
        }
    }

    return credentials;
};

export const paginate = <T = any>(data: T[], page: number = 1, size: number = 20): PaginatedItems<T> => {
    const ret: PaginatedItems<T> = {
        items: [],
        count: 0
    };

    if (data && Array.isArray(data) && data.length > 0) {
        ret.count = data.length;

        if (!size || size < 1) size = 20;
        const start = page && page > 1 ? (page - 1) * size : 0;
        const end = start + size;

        ret.items = data.slice(start, end);
    }

    return ret;
};

export const generateID = (prefix: string = "", id?: string): string => {
    if (!id) id = v7();

    return prefix ? `${prefix}-${id}` : id;
};

export const mapToObject = (value: Map<any, any>): Record<string, any> => {
    const obj: Record<string, any> = {};
    value.forEach((v, k) => (obj[k] = v));
    return obj;
};
