import { DynamoDB } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    NativeAttributeValue,
    QueryCommand,
    QueryCommandInput
} from "@aws-sdk/lib-dynamodb";
import ItemNotFoundError from "./error/ItemNotFoundError";
import KeyValueEmptyError from "./error/KeyValueEmptyError";
import Model from "./index";
import PageKey from "./PageKey";
import QueryResult from "./QueryResult";

const db = DynamoDBDocumentClient.from(new DynamoDB());

export default class QueryBuilder<T extends Model> {
    private _partitionKeyValue: any = null;
    private _sortKeyEquals: any = null;
    private _sortKeyCondition: boolean = false;
    private _sortKeyLessThan: any = null;
    private _sortKeyLessThanOrEquals: any = null;
    private _sortKeyGreaterThan: any = null;
    private _sortKeyGreaterThanOrEquals: any = null;
    private _sortKeyBetweenLowerBound: any = null;
    private _sortKeyBetweenUpperBound: any = null;
    private _sortKeyBeginsWith: string = "";
    private _queryLimit: number = -1;
    private _scanIndexForward: boolean = true;
    private _attributeValues: any[] = [];
    private _selectedProperties: string[] = [];
    private _pageKey: PageKey | null = null;
    private _model: T;

    constructor(model: T) {
        this._model = model;
    }

    /**
     * Set the primary key value of the query
     * @param value
     * @return Returns the current object
     */
    partitionKeyEquals(value: any): this {
        if (this._partitionKeyValue !== value) {
            this._partitionKeyValue = value;
        }
        return this;
    }

    /**
     * Set the sort key condition of the query to a specific value
     * This condition overrides all other sort key conditions
     * @param value
     * @return Returns the current object
     */
    sortKeyEquals(value: any): this {
        if (this._sortKeyEquals !== value) {
            this._sortKeyEquals = value;
        }
        return this;
    }

    /**
     * Set the sort key condition of the query to be less than the provided value
     * @param value
     * @return Returns the current object
     */
    sortKeyLessThan(value: any): this {
        if (this._sortKeyLessThan !== value) {
            this._sortKeyLessThan = value;
            this._sortKeyCondition = true;
        }
        return this;
    }

    /**
     * Set the sort key condition of the query to be less than or equal to the provided value
     * @param value
     * @return Returns the current object
     */
    sortKeyLessThanOrEquals(value: any): this {
        if (!this._sortKeyLessThanOrEquals !== value) {
            this._sortKeyLessThanOrEquals = value;
            this._sortKeyCondition = true;
        }
        return this;
    }

    /**
     * Set the sort key condition of the query to be greater than the provided value
     * @param value
     * @return Returns the current object
     */
    sortKeyGreaterThan(value: any): this {
        if (this._sortKeyGreaterThan !== value) {
            this._sortKeyGreaterThan = value;
            this._sortKeyCondition = true;
        }
        return this;
    }

    /**
     * Set the sort key condition of the query to be greater than or equal to the provided value
     * @param value
     * @return Returns the current object
     */
    sortKeyGreaterThanOrEquals(value: any): this {
        if (this._sortKeyGreaterThanOrEquals !== value) {
            this._sortKeyGreaterThanOrEquals = value;
            this._sortKeyCondition = true;
        }
        return this;
    }

    /**
     * Set the sort key condition of the query to be greater than or equal to the lowerBound,
     * and less than or equal to the upperBound
     * @param lowerBound
     * @param upperBound
     * @return Returns the current object
     */
    sortKeyBetween(lowerBound: any, upperBound: any): this {
        if (
            this._sortKeyBetweenLowerBound !== lowerBound ||
            this._sortKeyBetweenUpperBound !== upperBound
        ) {
            this._sortKeyBetweenLowerBound = lowerBound;
            this._sortKeyBetweenUpperBound = upperBound;
            this._sortKeyCondition = true;
        }
        return this;
    }

    /**
     * Set the sort key condition of the query to be greater than or equal to the provided value
     * @param value
     * @return Returns the current object
     */
    sortKeyBeginsWith(value: string): this {
        if (typeof this._model[this._model.partitionKeyName] !== "string") {
            throw new Error(
                "Only string sort key support begins_with() condition"
            );
        }

        if (this._sortKeyBeginsWith !== value) {
            this._sortKeyBeginsWith = value;
            this._sortKeyCondition = true;
        }
        return this;
    }

    /**
     * Set the key for pagination
     * @param value
     * @return Returns the current object
     */
    pageKey(value: PageKey): this {
        if (this._pageKey !== value) {
            this._pageKey = value;
        }
        return this;
    }

    /**
     * Alias for pageKey()
     * @param value
     * @return Returns the current object
     */
    skip(value: PageKey): this {
        return this.pageKey(value);
    }

    /**
     * Set the limit of the query
     * @param value
     * @return Returns the current object
     */
    limit(value: number): this {
        if (this._queryLimit !== value) {
            this._queryLimit = value;
        }
        return this;
    }

    /**
     * Alias for limit()
     * @param value
     */
    take(value: number): this {
        return this.limit(value);
    }

    /**
     * Set the order for index traversal (default ASC）
     * @param value
     * @return Returns the current object
     */
    sort(value: "ASC" | "DESC"): this {
        this._scanIndexForward = value !== "DESC";
        return this;
    }

    /**
     * Set the selected properties to be returned
     * @param value Names of the selected properties
     * @return Returns the current object
     */
    select(value: string[]): this {
        this._selectedProperties = value;
        return this;
    }

    /**
     * Query the database
     * @param deleteMetaProperties Delete meta properties in the result item
     * @return Returns the query result
     */
    async query(deleteMetaProperties: boolean = true): Promise<QueryResult<T>> {
        if (!this._partitionKeyValue) {
            throw new KeyValueEmptyError("Partition key value is required");
        }

        // The request params
        const params: QueryCommandInput = {
            TableName: this._model.tableName
        };

        // Use index
        if (this._model.indexName) {
            params.IndexName = this._model.indexName;
        }

        // Set order
        if (!this._scanIndexForward) {
            params.ScanIndexForward = this._scanIndexForward;
        }

        // Build request expression and attributes
        params.KeyConditionExpression = this.buildKeyConditionExpression();
        params.ExpressionAttributeNames = this.buildExpressionAttributeNames();
        params.ExpressionAttributeValues =
            this.buildExpressionAttributeValues();
        params.ProjectionExpression = this.buildProjectionExpression();

        // Set key for pagination
        if (this._pageKey) {
            params.ExclusiveStartKey = this._pageKey;
        }

        // Set the limit
        if (this._queryLimit > 0) {
            params.Limit = this._queryLimit;
        }

        const queryResult: QueryResult<T> = {
            Items: [],
            PageKey: undefined
        };

        const command = new QueryCommand(params);

        // Query the database
        const data = await db.send(command);

        // Create objects of the requested model
        data.Items?.forEach((dataItem) => {
            const returnItem: T = this._model.newInstance<T>();
            Model.fillItem(
                dataItem,
                returnItem,
                this._model,
                deleteMetaProperties
            );
            queryResult.Items.push(returnItem);
        });

        // Add the key for pagination
        queryResult.PageKey = data.LastEvaluatedKey;

        return queryResult;
    }

    /**
     * Get all items matching the query conditions
     * @param deleteMetaProperties Delete meta properties in the result item
     * @return Returns the items as an array
     */
    async all(deleteMetaProperties: boolean = true): Promise<T[]> {
        // Delete skip & take conditions
        this._pageKey = null;
        this._queryLimit = -1;

        const items: T[] = [];
        let pageKey: PageKey = undefined;

        // Loop until no pageKey returns
        do {
            const queryResult: QueryResult<T> =
                await this.query(deleteMetaProperties);
            queryResult.Items.forEach((i) => items.push(i));
            pageKey = queryResult.PageKey;
        } while (pageKey);

        return items;
    }

    /**
     * Get the first returned item of the query
     * @param deleteMetaProperties Delete meta properties in the result item
     * @return Returns the first item
     * @throws Throws item not found exception if no item is found
     */
    async first(deleteMetaProperties: boolean = true): Promise<T> {
        if (!this._partitionKeyValue) {
            throw new KeyValueEmptyError("Partition key value is required");
        }

        // Set limit to 1
        this.limit(1);

        const queryResult: QueryResult<T> =
            await this.query(deleteMetaProperties);

        if (queryResult.Items.length > 0) {
            return queryResult.Items[0];
        } else {
            throw new ItemNotFoundError("Item not found");
        }
    }

    /**
     * Get the first returned item of the query
     * @param defaultValue The default value
     * @param deleteMetaProperties Delete meta properties in the result item
     * @return Returns the first item, or the default value if no item is found
     */
    async firstOrDefault(
        defaultValue: T | null = null,
        deleteMetaProperties: boolean = true
    ): Promise<T | null> {
        try {
            return await this.first(deleteMetaProperties);
        } catch (e: any) {
            if (e instanceof ItemNotFoundError) {
                return defaultValue;
            } else {
                throw e;
            }
        }
    }

    /**
     * Builds the KeyConditionExpression property
     * @private
     * @return Returns the KeyExpression
     */
    private buildKeyConditionExpression(): string {
        // Partition key value
        let n: number = this._attributeValues.push(this._partitionKeyValue);
        let expression: string = `#partitionKey = :val${n}`;

        // Sort key less than
        if (this._sortKeyLessThan) {
            n = this._attributeValues.push(this._sortKeyLessThan);
            expression += ` and #sortKey < :val${n}`;
        }

        // Sort key less than or equals
        if (this._sortKeyLessThanOrEquals) {
            n = this._attributeValues.push(this._sortKeyLessThanOrEquals);
            expression += ` and #sortKey <= :val${n}`;
        }

        // Sort key greater than
        if (this._sortKeyGreaterThan) {
            n = this._attributeValues.push(this._sortKeyGreaterThan);
            expression += ` and #sortKey > :val${n}`;
        }

        // Sort key greater than or equals
        if (this._sortKeyGreaterThanOrEquals) {
            n = this._attributeValues.push(this._sortKeyGreaterThanOrEquals);
            expression += ` and #sortKey >= :val${n}`;
        }

        // Sort key between
        if (this._sortKeyBetweenLowerBound && this._sortKeyBetweenUpperBound) {
            n = this._attributeValues.push(this._sortKeyBetweenLowerBound);
            expression += ` and #sortKey BETWEEN :val${n}`;

            n = this._attributeValues.push(this._sortKeyBetweenUpperBound);
            expression += ` and :val${n}`;
        }

        // Sort key begins with
        if (this._sortKeyBeginsWith) {
            n = this._attributeValues.push(this._sortKeyBeginsWith);
            expression += ` AND begins_with(#sortKey, :val${n})`;
        }

        return expression;
    }

    /**
     * Builds the ExpressionAttributeNames property (#name)
     * @private
     * @return Returns the ExpressionAttributeNameMap
     */
    private buildExpressionAttributeNames(): Record<string, string> {
        const names: Record<string, string> = {
            "#partitionKey": this._model.partitionKeyName
        };

        if (this._sortKeyCondition && this._model.sortKeyName) {
            names["#sortKey"] = this._model.sortKeyName;
        }

        return names;
    }

    /**
     * Builds the ExpressionAttributeValues property (:value)
     * @private
     * @return Returns the ExpressionAttributeValueMap
     */
    private buildExpressionAttributeValues(): Record<
        string,
        NativeAttributeValue
    > {
        return this._attributeValues.reduce(
            (obj: object, v: any, i) => ({
                ...obj,
                [`:val${i + 1}`]: v
            }),
            {}
        );
    }

    /**
     * Builds the ProjectionExpression
     * @private
     * @return Returns the ProjectionExpression
     */
    private buildProjectionExpression(): string | undefined {
        // Return all
        if (this._selectedProperties.length === 0) return undefined;

        // Add create & update time
        if (this._model.createdAt) {
            this._selectedProperties.push("createdAt");
        }

        if (this._model.updatedAt) {
            this._selectedProperties.push("updatedAt");
        }

        return this._selectedProperties.join(",");
    }
}
