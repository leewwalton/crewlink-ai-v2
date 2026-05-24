import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { pilots, rankPilotsForRequest, requests } from "../../../packages/domain/src";
import { json } from "../_shared/response";

const bedrock = new BedrockRuntimeClient({});

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
  } catch {
    return null;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.queryStringParameters?.requestId || requests[0].id;
  const request = requests.find((candidate) => candidate.id === requestId) || requests[0];
  const matches = rankPilotsForRequest(request, pilots);

  const aiSummary = await explainWithBedrock(
    `Summarize the top CrewLinkAI staffing match for ${request.title}: ${matches[0].explanation}`,
  );

  return json(200, {
    matches: aiSummary
      ? matches.map((match, index) =>
          index === 0 ? { ...match, explanation: aiSummary } : match,
        )
      : matches,
  });
};
