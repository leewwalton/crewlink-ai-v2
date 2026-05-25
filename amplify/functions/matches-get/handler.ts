import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { rankPilotsForRequest, type StaffingRequest } from "../../../packages/domain/src";
import { staffingRequestGet } from "../shared/dynamodb-client";
import { loadMarketplacePilots } from "../shared/marketplace-pilots";
import { getCognitoSubFromEvent } from "../shared/get-cognito-sub";
import { httpMethod, json } from "../shared/http";

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-west-2" });
const LOG_PREFIX = "[MATCHES-GET]";

async function explainWithBedrock(prompt: string): Promise<string | null> {
  if (!process.env.BEDROCK_MODEL_ID || process.env.DISABLE_BEDROCK === "true") return null;
  try {
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 120,
          messages: [{ role: "user", content: prompt }],
        }),
      }),
    );
    const payload = JSON.parse(new TextDecoder().decode(response.body));
    return payload.content?.[0]?.text ?? null;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Bedrock unavailable`, { error: err?.message });
    return null;
  }
}

export const handler = async (event: any) => {
  const method = httpMethod(event);
  console.log(`${LOG_PREFIX} Invoked method=${method}`);

  if (method === "OPTIONS") {
    return json(200, { message: "OK" });
  }

  if (method !== "GET") {
    return json(405, { message: "Method Not Allowed" });
  }

  const operatorId = getCognitoSubFromEvent(event);
  if (!operatorId) {
    return json(401, { message: "Authentication required." });
  }

  const requestId = event.queryStringParameters?.requestId;
  if (!requestId) {
    return json(400, { message: "requestId is required." });
  }

  try {
    const requestRow = await staffingRequestGet(requestId);
    const request = requestRow as StaffingRequest | null;
    if (!request || request.operatorId !== operatorId) {
      return json(404, { message: "Staffing request not found." });
    }

    const matches = rankPilotsForRequest(request, await loadMarketplacePilots());
    const aiSummary =
      matches.length > 0
        ? await explainWithBedrock(
            `Summarize the top CrewLinkAI staffing match for ${request.title}: ${matches[0].explanation}`,
          )
        : null;

    return json(200, {
      request,
      matches: aiSummary
        ? matches.map((match, index) =>
            index === 0 ? { ...match, explanation: aiSummary } : match,
          )
        : matches,
    });
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed`, { error: err?.message });
    return json(500, { message: "Internal server error" });
  }
};
