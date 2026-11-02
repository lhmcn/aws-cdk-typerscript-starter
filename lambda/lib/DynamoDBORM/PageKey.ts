import { NativeAttributeValue } from "@aws-sdk/lib-dynamodb";

type PageKey = Record<string, NativeAttributeValue> | undefined;

export default PageKey;
