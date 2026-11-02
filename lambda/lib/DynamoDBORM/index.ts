import { DynamoDB } from "@aws-sdk/client-dynamodb";
import {
    DeleteCommand,
    DynamoDBDocumentClient,
    GetCommand,
    NativeAttributeValue,
    PutCommand
} from "@aws-sdk/lib-dynamodb";
import QueryBuilder from "./QueryBuilder";
import KeyValueEmptyError from "./error/KeyValueEmptyError";
import ItemNotFoundError from "./error/ItemNotFoundError";

const db = DynamoDBDocumentClient.from(new DynamoDB());

const keyDataTypes: any = {
    string: "S",
    number: "N"
};

/**
 * Properties to be excluded from the data item
 */
const metaProperties: ReadonlySet<string> = new Set<string>([
    "tableName",
    "indexName",
    "partitionKeyName",
    "sortKeyName"
]);

export default abstract class Model {
    /**
     * Allow dynamic access to key/value attributes by property name.
     * This keeps model instances compatible with DynamoDB key lookups.
     */
    [key: string]: any;

    /**
     * The DynamoDB table name (required)
     */
    abstract tableName: string;

    /**
     * The index name
     * Set to empty string if no index used
     */
    abstract indexName: string;

    /**
     * Name of the partition key (required)
     * If indexName is provided, must be the partition key of the index
     */
    abstract partitionKeyName: string;

    /**
     * Name of the sort key
     * If indexName is provided, must be the sort key of the index
     */
    abstract sortKeyName: string;

    /**
     * Automatically updated when items are created
     * Delete this property in sub-classes' constructors if you don't need it
     */
    createdAt: number;

    /**
     * Automatically updated when items are created or updated
     * Delete this property in sub-classes' constructors if you don't need it
     */
    updatedAt: number;

    constructor() {
        this.createdAt = -1;
        this.updatedAt = -1;
    }

    /**
     * Build an item from the instance for storage
     * @private
     */
    private buildItem(): Record<string, NativeAttributeValue> {
        // Check partition key
        if (
            !keyDataTypes[typeof this[this.partitionKeyName]] ||
            !this[this.partitionKeyName]
        ) {
            throw new KeyValueEmptyError("Partition key is required");
        }

        // Check sort key
        if (
            this.sortKeyName &&
            (!keyDataTypes[typeof this[this.sortKeyName]] ||
                !this[this.sortKeyName])
        ) {
            throw new KeyValueEmptyError("Sort key is required");
        }

        // Create an empty item
        const item: Record<string, NativeAttributeValue> = {};

        // Fill the item with value from current instance
        Model.fillItem(this, item, this, true);

        const now = Date.now();

        // Update time
        if (this.createdAt && this.createdAt < 0) {
            item["createdAt"] = now;
        }

        if (this.updatedAt) {
            item["updatedAt"] = now;
        }

        return item;
    }

    /**
     * Save or update the instance to database
     */
    async save(): Promise<void> {
        // If the item is from indices, throw an exception
        if (this.indexName) {
            throw new Error("Items from indices are read-only");
        }

        // If the tablename is empty, throw an exception
        if (!this.tableName) {
            throw new Error("Items must keep meta properties");
        }

        const item = this.buildItem();

        const command = new PutCommand({
            TableName: this.tableName,
            Item: item
        });

        // Send put request to database
        await db.send(command);

        // Update current instance
        if (this.updatedAt) {
            this.updatedAt = item.updatedAt;
        }
    }

    /**
     * Deletes the current item
     */
    async delete(): Promise<void> {
        // If the tablename is deleted, throw an exception
        if (!this.tableName) {
            throw new Error("Items must keep meta properties");
        }

        const key = {
            [this.partitionKeyName]: this[this.partitionKeyName]
        };

        // Add the sort key if configured
        if (this.sortKeyName) {
            if (this[this.sortKeyName]) {
                key[this.sortKeyName] = this[this.sortKeyName];
            } else {
                throw new KeyValueEmptyError("Sort key value is required");
            }
        }

        // The request params
        const command = new DeleteCommand({
            TableName: this.tableName,
            Key: key
        });

        // Send delete request to database
        await db.send(command);
    }

    /**
     * Get a new instance
     */
    newInstance<T extends Model>(): T {
        // @ts-ignore
        return new this.constructor();
    }

    /**
     * Get a copy of the instance
     */
    clone<T extends Model>(): T {
        const newInstance: T = this.newInstance();
        Model.fillItem(this, newInstance, newInstance);
        return newInstance;
    }

    /**
     * Finds and returns a single item matching the key
     * @param partitionKeyValue Value of the partition key
     * @param sortKeyValue Value of the sort key
     * @param deleteMetaProperties Delete meta properties in the result item
     * @return Returns the single item
     * @throws Throws item not found exception if no item is found
     */
    static async find<T extends Model>(
        partitionKeyValue: any,
        sortKeyValue: any = "",
        deleteMetaProperties: boolean = true
    ): Promise<T> {
        // @ts-ignore
        const returnItem: T = new this();

        if (returnItem.indexName) {
            const result = await this.queryBuilder<T>()
                .partitionKeyEquals(partitionKeyValue)
                .sortKeyEquals(sortKeyValue)
                .query(deleteMetaProperties);
            if (result.Items.length > 0) {
                return result.Items[0];
            }
        } else {
            const key = {
                [returnItem.partitionKeyName]: partitionKeyValue
            };

            // Add the sort key if configured
            if (returnItem.sortKeyName) {
                if (sortKeyValue) {
                    key[returnItem.sortKeyName] = sortKeyValue;
                } else {
                    throw new KeyValueEmptyError("Sort key value is required");
                }
            }

            // The request params
            const params = new GetCommand({
                TableName: returnItem.tableName,
                Key: key
            });

            // Get item from the database
            const data = await db.send(params);
            if (data.Item) {
                // Fill the item with database result
                this.fillItem(
                    data.Item,
                    returnItem,
                    returnItem,
                    deleteMetaProperties
                );
                return returnItem;
            }
        }

        throw new ItemNotFoundError("Item not found");
    }

    /**
     * Finds and returns a single item matching the key
     * @param partitionKeyValue Value of the partition key
     * @param sortKeyValue Value of the sort key
     * @param defaultValue The default value
     * @param deleteMetaProperties Delete meta properties in the result item
     * @return Returns the single item, or the default value if no item is found
     */
    static async findOrDefault<T extends Model>(
        partitionKeyValue: any,
        sortKeyValue: any = "",
        defaultValue: T | null = null,
        deleteMetaProperties: boolean = true
    ): Promise<T | null> {
        try {
            return await this.find(
                partitionKeyValue,
                sortKeyValue,
                deleteMetaProperties
            );
        } catch (e: any) {
            if (e instanceof ItemNotFoundError) {
                return defaultValue;
            } else {
                throw e;
            }
        }
    }

    /**
     * Deletes a single item matching the key
     * @param partitionKeyValue Value of the partition key
     * @param sortKeyValue Value of the sort key
     */
    static async delete<T extends Model>(
        partitionKeyValue: any,
        sortKeyValue: any = ""
    ): Promise<void> {
        // @ts-ignore
        const deletedItem: T = new this();

        (deletedItem as any)[deletedItem.partitionKeyName] = partitionKeyValue;
        (deletedItem as any)[deletedItem.sortKeyName] = sortKeyValue;

        await deletedItem.delete();
    }

    /**
     * Gets the query builder
     * @return Returns the query builder
     */
    static queryBuilder<T extends Model>(): QueryBuilder<T> {
        // @ts-ignore
        const model: T = new this();

        return new QueryBuilder<T>(model);
    }

    /**
     * Assign values from source item to target item
     * @param itemFrom The source item
     * @param itemTo The target item
     * @param itemTemplate The template with default values of the item
     * @param deleteMetaProperties Delete meta properties in the result item
     */
    static fillItem<T extends Model>(
        itemFrom: any,
        itemTo: any,
        itemTemplate: T,
        deleteMetaProperties: boolean = true
    ) {
        Object.getOwnPropertyNames(itemTemplate).forEach((k) => {
            if (!metaProperties.has(k)) {
                itemTo[k] = this.isEmpty(itemFrom[k])
                    ? itemTemplate[k]
                    : itemFrom[k];
            } else if (deleteMetaProperties) {
                delete itemTo[k];
            }
        });

        if (itemTemplate.createdAt) {
            itemTo["createdAt"] = itemFrom["createdAt"];
        }

        if (itemTemplate.updatedAt) {
            itemTo["updatedAt"] = itemFrom["updatedAt"];
        }
    }

    /**
     * Checks if a value is empty
     * @param value The value to be checked
     */
    static isEmpty(value: any): boolean {
        if (value === null || value === undefined) {
            return true;
        }

        if (value instanceof Set) {
            return value.size === 0;
        }

        if (value instanceof Map) {
            return value.size === 0;
        }

        switch (typeof value) {
            case "object":
                return Object.keys(value).length === 0;
            case "string":
                return value.length === 0;
            default:
                return false;
        }
    }
}
