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

const LAMBDA_BUNDLING = {
  forceDockerBundling: false,
  externalModules: ["@aws-sdk/*"],
};

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

      const callbackUrls = parseCsv(
        process.env.COGNITO_CALLBACK_URLS,
        [
          "http://localhost:3000/dashboard",
          "http://localhost:3000/",
          "https://flycrewlink.com/dashboard",
          "https://flycrewlink.com/",
        ],
      );
      const logoutUrls = parseCsv(process.env.COGNITO_LOGOUT_URLS, [
        "http://localhost:3000/",
        "https://flycrewlink.com/",
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
      users: this.table("Users"),
      pilotProfiles: this.table("PilotProfiles"),
      operatorProfiles: this.table("OperatorProfiles"),
      staffingRequests: this.table("StaffingRequests"),
      matches: this.table("Matches"),
      availability: this.table("Availability"),
      locations: this.table("Locations"),
      contactLeads: this.table("ContactLeads"),
      conversations: this.table("Conversations"),
      messages: this.messagesTable("Messages"),
      userConversations: this.userConversationsTable("UserConversations"),
    };

    const contactNotifyEmail = process.env.CONTACT_NOTIFY_EMAIL ?? process.env.CONTACT_TO_EMAIL ?? "";
    const contactFromEmail =
      process.env.CONTACT_FROM_EMAIL ?? process.env.CONTACT_NOTIFY_EMAIL ?? process.env.CONTACT_TO_EMAIL ?? "";
    const contactSesSourceArn = process.env.CONTACT_SES_SOURCE_ARN ?? "";
    const bedrockModelId =
      process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20241022-v2:0";

    const messagingEnvironment = {
      CONVERSATIONS_TABLE_NAME: tables.conversations.tableName,
      MESSAGES_TABLE_NAME: tables.messages.tableName,
      USER_CONVERSATIONS_TABLE_NAME: tables.userConversations.tableName,
    };

    // ==========================
    // Lambdas
    // ==========================
    const contactSubmitFn = new lambdaNode.NodejsFunction(this, "ContactSubmitFn", {
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
    });

    const pilotsGetFn = new lambdaNode.NodejsFunction(this, "PilotsGetFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "amplify/functions/pilots-get/handler.ts",
      handler: "handler",
      environment: {},
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling: LAMBDA_BUNDLING,
    });

    const staffingRequestsFn = new lambdaNode.NodejsFunction(this, "StaffingRequestsFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "amplify/functions/staffing-requests/handler.ts",
      handler: "handler",
      environment: {
        STAFFING_REQUESTS_TABLE_NAME: tables.staffingRequests.tableName,
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
      environment: {},
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling: LAMBDA_BUNDLING,
    });

    const conversationsFn = new lambdaNode.NodejsFunction(this, "ConversationsFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "amplify/functions/conversations/handler.ts",
      handler: "handler",
      environment: messagingEnvironment,
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      bundling: LAMBDA_BUNDLING,
    });

    const messagesFn = new lambdaNode.NodejsFunction(this, "MessagesFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "amplify/functions/messages/handler.ts",
      handler: "handler",
      environment: messagingEnvironment,
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      bundling: LAMBDA_BUNDLING,
    });

    tables.contactLeads.grantReadWriteData(contactSubmitFn);
    tables.staffingRequests.grantReadWriteData(staffingRequestsFn);
    for (const fn of [conversationsFn, messagesFn]) {
      tables.conversations.grantReadWriteData(fn);
      tables.messages.grantReadWriteData(fn);
      tables.userConversations.grantReadWriteData(fn);
    }

    contactSubmitFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      }),
    );

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
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "RequestsIntegration",
        staffingRequestsFn,
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
  }

  private table(id: string) {
    return new dynamodb.Table(this, id, {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }

  private messagesTable(id: string) {
    return new dynamodb.Table(this, id, {
      partitionKey: { name: "conversationId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }

  private userConversationsTable(id: string) {
    return new dynamodb.Table(this, id, {
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
  const defaults = ["http://localhost:3000", "https://flycrewlink.com"];
  const extra = parseCsv(process.env.CORS_ORIGINS, []);
  return [...new Set([...defaults, ...extra])];
}

function loadExistingAuth(): {
  userPoolId?: string;
  userPoolClientId?: string;
  identityPoolId?: string;
  cognitoDomain?: string;
} {
  const fromEnv = {
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    userPoolClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
    identityPoolId: process.env.COGNITO_IDENTITY_POOL_ID,
    cognitoDomain: process.env.COGNITO_DOMAIN,
  };
  if (fromEnv.userPoolId && fromEnv.userPoolClientId) {
    return fromEnv;
  }

  const fs = require("fs") as typeof import("fs");
  for (const file of ["amplify_outputs.json", "cdk-outputs.json"]) {
    const configPath = path.join(__dirname, "..", file);
    if (!fs.existsSync(configPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
        auth?: {
          user_pool_id?: string;
          user_pool_client_id?: string;
          identity_pool_id?: string;
        };
        custom?: { cognitoDomain?: string };
      };
      const auth = data.auth;
      if (auth?.user_pool_id && auth.user_pool_client_id) {
        return {
          userPoolId: auth.user_pool_id,
          userPoolClientId: auth.user_pool_client_id,
          identityPoolId: auth.identity_pool_id,
          cognitoDomain: data.custom?.cognitoDomain ?? fromEnv.cognitoDomain,
        };
      }
    } catch {}
  }

  return {};
}
