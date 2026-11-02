import PageKey from "./PageKey";

export default interface QueryResult<T> {
    Items: T[];
    PageKey: PageKey;
}
