import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";

export class CrewLinkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, "UserPool", {
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

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
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
    const userPoolDomain = userPool.addDomain("UserPoolDomain", {
      cognitoDomain: { domainPrefix },
    });

    const identityPool = new cognito.CfnIdentityPool(this, "IdentityPool", {
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

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

    new cognito.CfnIdentityPoolRoleAttachment(this, "IdentityPoolRoleAttachment", {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

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

    const environment = {
      USERS_TABLE: tables.users.tableName,
      PILOT_PROFILES_TABLE: tables.pilotProfiles.tableName,
      OPERATOR_PROFILES_TABLE: tables.operatorProfiles.tableName,
      STAFFING_REQUESTS_TABLE: tables.staffingRequests.tableName,
      MATCHES_TABLE: tables.matches.tableName,
      AVAILABILITY_TABLE: tables.availability.tableName,
      LOCATIONS_TABLE: tables.locations.tableName,
      CONTACT_LEADS_TABLE: tables.contactLeads.tableName,
      CONVERSATIONS_TABLE: tables.conversations.tableName,
      MESSAGES_TABLE: tables.messages.tableName,
      USER_CONVERSATIONS_TABLE: tables.userConversations.tableName,
      CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL || "",
      CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL || "",
      BEDROCK_MODEL_ID:
        process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20241022-v2:0",
    };

    const domainEntry = path.join(__dirname, "../packages/domain/src/index.ts");

    const common = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(20),
      memorySize: 256,
      depsLockFilePath: path.join(__dirname, "../package-lock.json"),
      bundling: {
        externalModules: ["@aws-sdk/*"],
        alias: {
          "@crewlink/domain": domainEntry,
        },
      },
      environment,
    };

    const contactFn = new nodejs.NodejsFunction(this, "ContactFunction", {
      ...common,
      entry: "amplify/functions/contact/handler.ts",
    });
    const pilotsFn = new nodejs.NodejsFunction(this, "PilotsFunction", {
      ...common,
      entry: "amplify/functions/pilots/handler.ts",
    });
    const requestsFn = new nodejs.NodejsFunction(this, "RequestsFunction", {
      ...common,
      entry: "amplify/functions/requests/handler.ts",
    });
    const matchesFn = new nodejs.NodejsFunction(this, "MatchesFunction", {
      ...common,
      entry: "amplify/functions/matches/handler.ts",
      timeout: cdk.Duration.seconds(30),
    });
    const mapFn = new nodejs.NodejsFunction(this, "MapFunction", {
      ...common,
      entry: "amplify/functions/map/handler.ts",
    });
    const messagesFn = new nodejs.NodejsFunction(this, "MessagesFunction", {
      ...common,
      entry: "amplify/functions/messages/handler.ts",
    });

    Object.values(tables).forEach((table) => {
      table.grantReadWriteData(contactFn);
      table.grantReadWriteData(pilotsFn);
      table.grantReadWriteData(requestsFn);
      table.grantReadWriteData(matchesFn);
      table.grantReadWriteData(mapFn);
      table.grantReadWriteData(messagesFn);
    });

    contactFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      }),
    );

    matchesFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      }),
    );

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
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

    const jwtAuthorizer = new authorizers.HttpUserPoolAuthorizer(
      "CrewLinkJwtAuthorizer",
      userPool,
      { userPoolClients: [userPoolClient] },
    );

    httpApi.addRoutes({
      path: "/contact",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("ContactIntegration", contactFn),
    });
    httpApi.addRoutes({
      path: "/pilots",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("PilotsIntegration", pilotsFn),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/requests",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("RequestsIntegration", requestsFn),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/matches",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("MatchesIntegration", matchesFn),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/map",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("MapIntegration", mapFn),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/conversations",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("ConversationsIntegration", messagesFn),
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: "/messages",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("MessagesIntegration", messagesFn),
      authorizer: jwtAuthorizer,
    });

    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "IdentityPoolId", { value: identityPool.ref });
    new cdk.CfnOutput(this, "CognitoDomain", { value: userPoolDomain.domainName });
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
