import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as apigwv2Auth from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import { DYNAMODB_TABLE_NAMES } from "./dynamodb-table-names";

const LAMBDA_BUNDLING = {
  forceDockerBundling: false,
  externalModules: ["@aws-sdk/*"],
};

const PRODUCTION_WEB_ORIGINS = [
  "https://crewlink-ai.com",
  "https://crew-link-ai.com",
  "https://www.crew-link-ai.com",
];

export class CrewLinkPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ==========================
    // Cognito: User Pool, Client, Domain, Identity Pool (CDK-managed)
    // Re-use existing auth when migrating from CrewLinkStack (domain prefix is account-wide).
    // ==========================
    const existingAuth = loadExistingAuth();
    const useExistingAuth = Boolean(
      existingAuth.userPoolId && existingAuth.userPoolClientId,
    );

    let userPool: cognito.IUserPool;
    let userPoolClient: cognito.IUserPoolClient;
    let cognitoDomainName: string;
    let identityPoolIdOutput: string;

    if (useExistingAuth) {
      userPool = cognito.UserPool.fromUserPoolId(
        this,
        "UserPool",
        existingAuth.userPoolId!,
      );
      userPoolClient = cognito.UserPoolClient.fromUserPoolClientId(
        this,
        "UserPoolClient",
        existingAuth.userPoolClientId!,
      );
      cognitoDomainName =
        existingAuth.cognitoDomain || `crewlink-${this.account}`;
      identityPoolIdOutput = existingAuth.identityPoolId || "";
    } else {
      const createdPool = new cognito.UserPool(this, "UserPool", {
        userPoolName: "crewlink-user-pool",
        selfSignUpEnabled: true,
        signInAliases: { email: true },
        standardAttributes: {
          email: { required: true, mutable: true },
        },
        passwordPolicy: {
          minLength: 10,
          requireDigits: true,
          requireLowercase: true,
          requireUppercase: true,
        },
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });
      userPool = createdPool;

      const callbackUrls = parseCsv(process.env.COGNITO_CALLBACK_URLS, [
        "http://localhost:3000/dashboard",
        "http://localhost:3000/",
        ...PRODUCTION_WEB_ORIGINS.flatMap((origin) => [
          `${origin}/dashboard`,
          `${origin}/`,
        ]),
        "https://d1vpvwi7yc942a.amplifyapp.com/dashboard",
        "https://d1vpvwi7yc942a.amplifyapp.com/",
        "https://main.d1vpvwi7yc942a.amplifyapp.com/dashboard",
        "https://main.d1vpvwi7yc942a.amplifyapp.com/",
      ]);
      const logoutUrls = parseCsv(process.env.COGNITO_LOGOUT_URLS, [
        "http://localhost:3000/",
        ...PRODUCTION_WEB_ORIGINS.map((origin) => `${origin}/`),
        "https://d1vpvwi7yc942a.amplifyapp.com/",
        "https://main.d1vpvwi7yc942a.amplifyapp.com/",
      ]);

      userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
        userPool: createdPool,
        authFlows: {
          userPassword: true,
          userSrp: true,
        },
        oAuth: {
          flows: { authorizationCodeGrant: true },
          scopes: [
            cognito.OAuthScope.EMAIL,
            cognito.OAuthScope.OPENID,
            cognito.OAuthScope.PROFILE,
          ],
          callbackUrls,
          logoutUrls,
        },
        generateSecret: false,
      });

      const domainPrefix =
        process.env.COGNITO_DOMAIN_PREFIX || `crewlink-${this.account}`;
      const userPoolDomain = createdPool.addDomain("UserPoolDomain", {
        cognitoDomain: { domainPrefix },
      });
      cognitoDomainName = userPoolDomain.domainName;

      const identityPool = new cognito.CfnIdentityPool(this, "IdentityPool", {
        allowUnauthenticatedIdentities: false,
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: createdPool.userPoolProviderName,
          },
        ],
      });
      identityPoolIdOutput = identityPool.ref;

      const authenticatedRole = new iam.Role(this, "CognitoAuthenticatedRole", {
        assumedBy: new iam.FederatedPrincipal(
          "cognito-identity.amazonaws.com",
          {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": identityPool.ref,
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": "authenticated",
            },
          },
          "sts:AssumeRoleWithWebIdentity",
        ),
      });

      new cognito.CfnIdentityPoolRoleAttachment(
        this,
        "IdentityPoolRoleAttachment",
        {
          identityPoolId: identityPool.ref,
          roles: {
            authenticated: authenticatedRole.roleArn,
          },
        },
      );
    }

    // ==========================
    // DynamoDB tables
    // ==========================
    const tables = {
      users: this.table("Users", DYNAMODB_TABLE_NAMES.users),
      pilotProfiles: this.table("PilotProfiles", DYNAMODB_TABLE_NAMES.pilotProfiles),
      operatorProfiles: this.table(
        "OperatorProfiles",
        DYNAMODB_TABLE_NAMES.operatorProfiles,
      ),
      staffingRequests: this.staffingRequestsTable(
        "StaffingRequests",
        DYNAMODB_TABLE_NAMES.staffingRequests,
      ),
      matches: this.table("Matches", DYNAMODB_TABLE_NAMES.matches),
      availability: this.table("Availability", DYNAMODB_TABLE_NAMES.availability),
      locations: this.table("Locations", DYNAMODB_TABLE_NAMES.locations),
      contactLeads: this.table("ContactLeads", DYNAMODB_TABLE_NAMES.contactLeads),
      conversations: this.table(
        "Conversations",
        DYNAMODB_TABLE_NAMES.conversations,
      ),
      messages: this.messagesTable("Messages", DYNAMODB_TABLE_NAMES.messages),
      userConversations: this.userConversationsTable(
        "UserConversations",
        DYNAMODB_TABLE_NAMES.userConversations,
      ),
    };

    const contactNotifyEmail =
      process.env.CONTACT_NOTIFY_EMAIL ?? process.env.CONTACT_TO_EMAIL ?? "";
    const contactFromEmail =
      process.env.CONTACT_FROM_EMAIL ??
      process.env.CONTACT_NOTIFY_EMAIL ??
      process.env.CONTACT_TO_EMAIL ??
      "";
    const contactSesSourceArn = process.env.CONTACT_SES_SOURCE_ARN ?? "";
    const messageWebBaseUrl =
      process.env.MESSAGE_WEB_BASE_URL ?? "https://crewlink-ai.com";
    const bedrockModelId =
      process.env.BEDROCK_MODEL_ID ||
      "anthropic.claude-3-5-sonnet-20241022-v2:0";

    const messagingEnvironment = {
      CONVERSATIONS_TABLE_NAME: tables.conversations.tableName,
      MESSAGES_TABLE_NAME: tables.messages.tableName,
      USER_CONVERSATIONS_TABLE_NAME: tables.userConversations.tableName,
      OPERATOR_PROFILES_TABLE_NAME: tables.operatorProfiles.tableName,
      PILOT_PROFILES_TABLE_NAME: tables.pilotProfiles.tableName,
      MESSAGE_FROM_EMAIL: contactFromEmail,
      MESSAGE_SES_SOURCE_ARN: contactSesSourceArn,
      MESSAGE_WEB_BASE_URL: messageWebBaseUrl,
    };

    const accountEnvironment = {
      USERS_TABLE_NAME: tables.users.tableName,
      OPERATOR_PROFILES_TABLE_NAME: tables.operatorProfiles.tableName,
      PILOT_PROFILES_TABLE_NAME: tables.pilotProfiles.tableName,
    };

    // ==========================
    // Lambdas
    // ==========================
    const contactSubmitFn = new lambdaNode.NodejsFunction(
      this,
      "ContactSubmitFn",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "amplify/functions/contact-submit/handler.ts",
        handler: "handler",
        environment: {
          CONTACT_LEADS_TABLE_NAME: tables.contactLeads.tableName,
          CONTACT_NOTIFY_EMAIL: contactNotifyEmail,
          CONTACT_FROM_EMAIL: contactFromEmail,
          CONTACT_SES_SOURCE_ARN: contactSesSourceArn,
        },
        timeout: cdk.Duration.seconds(15),
        memorySize: 256,
        bundling: LAMBDA_BUNDLING,
      },
    );

    const pilotsGetFn = new lambdaNode.NodejsFunction(this, "PilotsGetFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "amplify/functions/pilots-get/handler.ts",
      handler: "handler",
      environment: {
        PILOT_PROFILES_TABLE_NAME: tables.pilotProfiles.tableName,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling: LAMBDA_BUNDLING,
    });

    const staffingRequestsFn = new lambdaNode.NodejsFunction(
      this,
      "StaffingRequestsFn",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "amplify/functions/staffing-requests/handler.ts",
        handler: "handler",
        environment: {
          ...accountEnvironment,
          STAFFING_REQUESTS_TABLE_NAME: tables.staffingRequests.tableName,
        },
        timeout: cdk.Duration.seconds(15),
        memorySize: 256,
        bundling: LAMBDA_BUNDLING,
      },
    );

    const operatorProfileFn = new lambdaNode.NodejsFunction(
      this,
      "OperatorProfileFn",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "amplify/functions/operator-profile/handler.ts",
        handler: "handler",
        environment: {
          ...accountEnvironment,
          OPERATOR_PROFILES_TABLE_NAME: tables.operatorProfiles.tableName,
        },
        timeout: cdk.Duration.seconds(15),
        memorySize: 256,
        bundling: LAMBDA_BUNDLING,
      },
    );

    const pilotProfileFn = new lambdaNode.NodejsFunction(this, "PilotProfileFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "amplify/functions/pilot-profile/handler.ts",
      handler: "handler",
      environment: {
        ...accountEnvironment,
        PILOT_PROFILES_TABLE_NAME: tables.pilotProfiles.tableName,
      },
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      bundling: LAMBDA_BUNDLING,
    });

    const matchesGetFn = new lambdaNode.NodejsFunction(this, "MatchesGetFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "amplify/functions/matches-get/handler.ts",
      handler: "handler",
      environment: {
        ...accountEnvironment,
        STAFFING_REQUESTS_TABLE_NAME: tables.staffingRequests.tableName,
        PILOT_PROFILES_TABLE_NAME: tables.pilotProfiles.tableName,
        BEDROCK_MODEL_ID: bedrockModelId,
        DISABLE_BEDROCK: process.env.DISABLE_BEDROCK ?? "",
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling: LAMBDA_BUNDLING,
    });

    const mapGetFn = new lambdaNode.NodejsFunction(this, "MapGetFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "amplify/functions/map-get/handler.ts",
      handler: "handler",
      environment: {
        STAFFING_REQUESTS_TABLE_NAME: tables.staffingRequests.tableName,
        PILOT_PROFILES_TABLE_NAME: tables.pilotProfiles.tableName,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling: LAMBDA_BUNDLING,
    });

    const conversationsFn = new lambdaNode.NodejsFunction(
      this,
      "ConversationsFn",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "amplify/functions/conversations/handler.ts",
        handler: "handler",
        environment: messagingEnvironment,
        timeout: cdk.Duration.seconds(15),
        memorySize: 256,
        bundling: LAMBDA_BUNDLING,
      },
    );

    const messagesFn = new lambdaNode.NodejsFunction(this, "MessagesFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "amplify/functions/messages/handler.ts",
      handler: "handler",
      environment: messagingEnvironment,
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      bundling: LAMBDA_BUNDLING,
    });

    const accountFn = new lambdaNode.NodejsFunction(this, "AccountFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "amplify/functions/account/handler.ts",
      handler: "handler",
      environment: accountEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling: LAMBDA_BUNDLING,
    });

    tables.contactLeads.grantReadWriteData(contactSubmitFn);
    tables.pilotProfiles.grantReadData(pilotsGetFn);
    tables.pilotProfiles.grantReadWriteData(pilotProfileFn);
    tables.staffingRequests.grantReadWriteData(staffingRequestsFn);
    tables.staffingRequests.grantReadData(matchesGetFn);
    tables.pilotProfiles.grantReadData(matchesGetFn);
    tables.staffingRequests.grantReadData(mapGetFn);
    tables.pilotProfiles.grantReadData(mapGetFn);
    tables.operatorProfiles.grantReadWriteData(operatorProfileFn);
    tables.users.grantReadWriteData(accountFn);
    tables.users.grantReadData(operatorProfileFn);
    tables.users.grantReadData(pilotProfileFn);
    tables.users.grantReadData(staffingRequestsFn);
    tables.users.grantReadData(matchesGetFn);
    tables.pilotProfiles.grantReadData(operatorProfileFn);
    tables.operatorProfiles.grantReadData(pilotProfileFn);
    tables.operatorProfiles.grantReadData(staffingRequestsFn);
    tables.operatorProfiles.grantReadData(matchesGetFn);
    tables.pilotProfiles.grantReadData(staffingRequestsFn);
    tables.pilotProfiles.grantReadData(matchesGetFn);
    tables.operatorProfiles.grantReadData(accountFn);
    tables.pilotProfiles.grantReadData(accountFn);
    for (const fn of [conversationsFn, messagesFn]) {
      tables.conversations.grantReadWriteData(fn);
      tables.messages.grantReadWriteData(fn);
      tables.userConversations.grantReadWriteData(fn);
      tables.operatorProfiles.grantReadData(fn);
      tables.pilotProfiles.grantReadData(fn);
    }

    contactSubmitFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      }),
    );

    for (const fn of [conversationsFn, messagesFn]) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["ses:SendEmail", "ses:SendRawEmail"],
          resources: ["*"],
        }),
      );
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sns:Publish"],
          resources: ["*"],
        }),
      );
    }

    matchesGetFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      }),
    );

    // ==========================
    // HTTP API
    // ==========================
    const httpApi = new apigwv2.HttpApi(this, "CrewLinkHttpApi", {
      corsPreflight: {
        allowHeaders: ["Authorization", "Content-Type"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: corsOrigins(),
      },
    });

    const jwtAuthorizer = new apigwv2Auth.HttpUserPoolAuthorizer(
      "CrewLinkJwtAuthorizer",
      userPool,
      { userPoolClients: [userPoolClient] },
    );

    httpApi.addRoutes({
      path: "/contact",
      methods: [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.OPTIONS],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "ContactIntegration",
        contactSubmitFn,
      ),
    });
    httpApi.addRoutes({
      path: "/pilots",
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "PilotsIntegration",
        pilotsGetFn,
      ),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/requests",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST, apigwv2.HttpMethod.PUT],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "RequestsIntegration",
        staffingRequestsFn,
      ),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/account",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "AccountIntegration",
        accountFn,
      ),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/operator-profile",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "OperatorProfileIntegration",
        operatorProfileFn,
      ),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/pilot-profile",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "PilotProfileIntegration",
        pilotProfileFn,
      ),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/matches",
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "MatchesIntegration",
        matchesGetFn,
      ),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/map",
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "MapIntegration",
        mapGetFn,
      ),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/conversations",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "ConversationsIntegration",
        conversationsFn,
      ),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/messages",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "MessagesIntegration",
        messagesFn,
      ),
      authorizer: jwtAuthorizer,
    });

    // ==========================
    // Stack outputs
    // ==========================
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "IdentityPoolId", { value: identityPoolIdOutput });
    new cdk.CfnOutput(this, "CognitoDomain", { value: cognitoDomainName });
    new cdk.CfnOutput(this, "HttpApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "AwsRegion", { value: this.region });
    new cdk.CfnOutput(this, "PilotProfilesTableName", {
      value: tables.pilotProfiles.tableName,
    });
    new cdk.CfnOutput(this, "OperatorProfilesTableName", {
      value: tables.operatorProfiles.tableName,
    });
    new cdk.CfnOutput(this, "StaffingRequestsTableName", {
      value: tables.staffingRequests.tableName,
    });
  }

  private table(id: string, tableName: string) {
    return new dynamodb.Table(this, id, {
      tableName,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }

  private staffingRequestsTable(id: string, tableName: string) {
    const table = new dynamodb.Table(this, id, {
      tableName,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: "byOperator",
      partitionKey: { name: "operatorId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "startDate", type: dynamodb.AttributeType.STRING },
    });
    return table;
  }

  private messagesTable(id: string, tableName: string) {
    return new dynamodb.Table(this, id, {
      tableName,
      partitionKey: {
        name: "conversationId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }

  private userConversationsTable(id: string, tableName: string) {
    return new dynamodb.Table(this, id, {
      tableName,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}

function parseCsv(value: string | undefined, defaults: string[]): string[] {
  const parsed = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : defaults;
}

function corsOrigins(): string[] {
  const amplifyAppId = process.env.AMPLIFY_APP_ID || "d1vpvwi7yc942a";
  const amplifyBranch = process.env.AMPLIFY_BRANCH_NAME || "main";
  const defaults = [
    "http://localhost:3000",
    ...PRODUCTION_WEB_ORIGINS,
    `https://${amplifyAppId}.amplifyapp.com`,
    `https://${amplifyBranch}.${amplifyAppId}.amplifyapp.com`,
  ];
  const extra = parseCsv(process.env.CORS_ORIGINS, []);
  return [...new Set([...defaults, ...extra])];
}

function loadExistingAuth(): {
  userPoolId?: string;
  userPoolClientId?: string;
  identityPoolId?: string;
  cognitoDomain?: string;
} {
  // Only honor explicit env vars. Do not read amplify_outputs.json/cdk-outputs.json here:
  // stale local files caused CDK to import a different pool than the deployed stack.
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const userPoolClientId = process.env.COGNITO_USER_POOL_CLIENT_ID;
  if (!userPoolId || !userPoolClientId) {
    return {};
  }

  return {
    userPoolId,
    userPoolClientId,
    identityPoolId: process.env.COGNITO_IDENTITY_POOL_ID,
    cognitoDomain: process.env.COGNITO_DOMAIN,
  };
}
