export default class KeyValueEmptyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "KeyValueEmptyError";
    }
}
