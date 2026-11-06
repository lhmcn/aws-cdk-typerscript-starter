import { AuthorizationType, Cors, LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import { CfnUserPoolGroup, UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import {
    IdentityPool,
    IdentityPoolProviderUrl,
    UserPoolAuthenticationProvider
} from "aws-cdk-lib/aws-cognito-identitypool";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Effect, FederatedPrincipal, IRole, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { join } from "path";

export class ProjectStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        if (!process.env.PROJECT_NAME || !process.env.STAGE) {
            throw new Error("PROJECT_NAME or STAGE is not set.");
        }

        const attachmentBucket = this.registerAttachmentBucket();
        const dynamodbTable = this.registerDynamodbTable();
        const mainControllerApi = this.registerController(attachmentBucket, dynamodbTable);

        const userPool = this.registerUserPool();
        const userPoolClient = this.registerUserPoolClient(userPool);
        const identityPool = this.registerIdentityPool(userPool, userPoolClient);

        const rootGroupRole = this.registerUserPoolGroup(userPool, identityPool, "Root", 1);
        const adminGroupRole = this.registerUserPoolGroup(userPool, identityPool, "Administrators", 10);

        this.registerUserPermissions(identityPool, mainControllerApi, adminGroupRole, rootGroupRole);
    }

    private registerAttachmentBucket(): Bucket {
        const bucket = new Bucket(this, "AttachmentBucket", {
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true
        });

        new CfnOutput(this, "AttachmentBucketBucketName", {
            value: bucket.bucketName
        });

        return bucket;
    }

    private registerController(attachmentBucket: Bucket, dynamodbTable: Table): LambdaRestApi {
        const mainControllerFunction = new NodejsFunction(this, "MainControllerFunction", {
            runtime: Runtime.NODEJS_24_X,
            memorySize: 512,
            entry: join(__dirname, "lambda/MainController.ts"),
            handler: "mainController",
            environment: {
                ATTACHMENT_BUCKET_NAME: attachmentBucket.bucketName,
                DYNAMODB_TABLE_NAME: dynamodbTable.tableName,
                STAGE: process.env.STAGE || ""
            }
        });

        dynamodbTable.grantReadWriteData(mainControllerFunction);

        const mainControllerApi = new LambdaRestApi(this, "MainControllerApi", {
            handler: mainControllerFunction,
            proxy: false,
            defaultCorsPreflightOptions: {
                allowOrigins: Cors.ALL_ORIGINS,
                allowMethods: Cors.ALL_METHODS,
                allowCredentials: true
            }
        });

        mainControllerApi.root.addResource("public").addResource("{proxy+}").addMethod("ANY", undefined, {
            authorizationType: AuthorizationType.NONE
        });

        mainControllerApi.root.addResource("user").addResource("{proxy+}").addMethod("ANY", undefined, {
            authorizationType: AuthorizationType.IAM
        });

        mainControllerApi.root.addResource("admin").addResource("{proxy+}").addMethod("ANY", undefined, {
            authorizationType: AuthorizationType.IAM
        });

        mainControllerApi.root.addResource("root").addResource("{proxy+}").addMethod("ANY", undefined, {
            authorizationType: AuthorizationType.IAM
        });

        attachmentBucket.grantReadWrite(mainControllerFunction);

        return mainControllerApi;
    }

    private registerDynamodbTable(): Table {
        const tableName = `${process.env.PROJECT_NAME}-table-${process.env.STAGE}`;

        const table = new Table(this, tableName, {
            tableName,
            partitionKey: {
                name: "PK",
                type: AttributeType.STRING
            },
            sortKey: {
                name: "SK",
                type: AttributeType.STRING
            },
            billingMode: BillingMode.PAY_PER_REQUEST,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: false
            },
            deletionProtection: false,
            removalPolicy: RemovalPolicy.RETAIN
        });

        this.registerDynamodbGlobalSecondaryIndex(table);

        return table;
    }

    private registerDynamodbGlobalSecondaryIndex(table: Table) {
        // table.addGlobalSecondaryIndex({
        //     indexName: "EmailIndex",
        //     partitionKey: {
        //         name: "email",
        //         type: AttributeType.STRING
        //     },
        //     projectionType: ProjectionType.ALL
        // });
        // table.addGlobalSecondaryIndex({
        //     indexName: "EmailIndex",
        //     partitionKey: {
        //         name: "email",
        //         type: AttributeType.STRING
        //     },
        //     projectionType: ProjectionType.INCLUDE,
        //     nonKeyAttributes: ["firstName", "lastName"]
        // });
    }

    private registerUserPool(): UserPool {
        const userPoolName = `${process.env.PROJECT_NAME}-userpool-${process.env.STAGE}`;

        const userPool = new UserPool(this, userPoolName, {
            userPoolName,
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
                username: false
            },
            signInCaseSensitive: false,
            autoVerify: {
                email: true
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true
                }
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true
            },
            removalPolicy: RemovalPolicy.DESTROY
        });

        new CfnOutput(this, "UserPoolId", {
            value: userPool.userPoolId
        });

        return userPool;
    }

    private registerUserPoolGroup(
        userPool: UserPool,
        identityPool: IdentityPool,
        groupName: string,
        precedence: number
    ) {
        const role = this.registerGroupRole(identityPool, groupName);

        new CfnUserPoolGroup(this, groupName, {
            groupName,
            userPoolId: userPool.userPoolId,
            precedence,
            roleArn: role.roleArn
        });

        return role;
    }

    private registerGroupRole(identityPool: IdentityPool, groupName: string): Role {
        return new Role(this, `${groupName}GroupRole`, {
            assumedBy: new FederatedPrincipal(
                "cognito-identity.amazonaws.com",
                {
                    StringEquals: {
                        "cognito-identity.amazonaws.com:aud": identityPool.identityPoolId
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "authenticated"
                    }
                },
                "sts:AssumeRoleWithWebIdentity"
            )
        });
    }

    private registerUserPoolClient(userPool: UserPool): UserPoolClient {
        const userPoolClientName = `${process.env.PROJECT_NAME}-userpool-${process.env.STAGE}-web-client`;

        const userPoolClient = new UserPoolClient(this, userPoolClientName, {
            userPool,
            userPoolClientName,
            authFlows: {
                userSrp: true // Secure Remote Password protocol (standard web/mobile flow)
            }
        });

        new CfnOutput(this, "UserPoolClientId", {
            value: userPoolClient.userPoolClientId
        });

        return userPoolClient;
    }

    private registerIdentityPool(userPool: UserPool, userPoolClient: UserPoolClient): IdentityPool {
        const identityPoolName = `${process.env.PROJECT_NAME}-identitypool-${process.env.STAGE}`;

        const identityPool = new IdentityPool(this, identityPoolName, {
            identityPoolName,
            allowUnauthenticatedIdentities: false,
            authenticationProviders: {
                userPools: [
                    new UserPoolAuthenticationProvider({
                        userPool,
                        userPoolClient
                    })
                ]
            },
            roleMappings: [
                {
                    mappingKey: "cognito",
                    providerUrl: IdentityPoolProviderUrl.userPool(userPool, userPoolClient),
                    useToken: true,
                    resolveAmbiguousRoles: true
                }
            ]
        });

        new CfnOutput(this, "IdentityPoolId", {
            value: identityPool.identityPoolId
        });

        return identityPool;
    }

    private registerUserPermissions(
        identityPool: IdentityPool,
        api: LambdaRestApi,
        adminGroupRole: IRole,
        rootGroupRole: IRole
    ) {
        identityPool.authenticatedRole.addToPrincipalPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["execute-api:Invoke"],
                resources: [api.arnForExecuteApi("*", "/user/*")]
            })
        );

        adminGroupRole.addToPrincipalPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["execute-api:Invoke"],
                resources: [api.arnForExecuteApi("*", "/user/*"), api.arnForExecuteApi("*", "/admin/*")]
            })
        );

        rootGroupRole.addToPrincipalPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["execute-api:Invoke"],
                resources: [api.arnForExecuteApi()]
            })
        );
    }
}
