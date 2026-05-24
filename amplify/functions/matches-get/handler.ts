import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { pilots, rankPilotsForRequest, requests } from "../../../packages/domain/src";
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

  try {
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
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed`, { error: err?.message });
    return json(500, { message: "Internal server error" });
  }
};
