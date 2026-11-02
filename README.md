# AWS CDK Starter Kit for TypeScript

This is a pre-configured starter kit for AWS serverless developers.

**Language:** TypeScript

**Pre-configured AWS Services:**

- DynamoDB

- Cognito User Pool

- Cognito Identity Pool

- S3 bucket for attachment

- API Gateway

## Pre-requisitions

- Node.js 24 or higher installed
    - [Installation guide](https://nodejs.org/)
- Git installed
    - [Installation guide](https://git-scm.com/)
- AWS Cli installed
    - [Installation guide](https://aws.amazon.com/cli/)
- AWS CDK installed
    ```
    npm install -g aws-cdk
    ```

## Endpoint permissions

By default, endpoints are protected into 4 layers: Public, User, Admin, Root.

- Endpoints in `lambda/PublicController.ts` are accessible to everyone.
- Endpoints in `lambda/UserController.ts` are accessible to signed-in users.
- Endpoints in `lambda/AdminController.ts` are accessible to users in the `Administrators` or `Root` groups.
- Endpoints in `lambda/RootController.ts` are accessible to users in the `Root` group.

## Usage

1. Clone this repo

    ```
    git clone https://github.com/lhmcn/aws-cdk-typerscript-starter.git projectName
    ```

1. Install dependencies

    ```
    cd projectName
    npm install
    ```

1. Edit `.env`, change your PROJECT_NAME, STAGE, and CDK_DEPLOY_REGION as needed.

1. Write your code.

1. Compare deployed stack with current state

    ```
    cdk diff
    ```

1. Deploy to AWS

    ```
    cdk deploy
    ```

    - You may be asked to enter your access key ID and secret access key.
    - You may be asked to run `cdk bootstrap` to bootstrap your environment. It happens only once per account and region, not once per app or per deployment.
    - Copy and save the `Outputs` in a text file, these values will be required by the front end.

1. Create your root user in Cognito > User pools if needed

## Useful commands

- `npm run build` type-check the project
- `npm run watch` watch for changes and type-check
- `npm run test` perform the jest unit tests
- `cdk synth` emits the synthesized CloudFormation template
