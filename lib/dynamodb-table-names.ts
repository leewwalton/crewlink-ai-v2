/** Stable DynamoDB table names shared by CDK and deploy scripts. */
export const DYNAMODB_TABLE_NAMES = {
  users: "crewlink-users",
  pilotProfiles: "crewlink-pilot-profiles",
  operatorProfiles: "crewlink-operator-profiles",
  staffingRequests: "crewlink-staffing-requests",
  matches: "crewlink-matches",
  availability: "crewlink-availability",
  locations: "crewlink-locations",
  contactLeads: "crewlink-contact-leads",
  conversations: "crewlink-conversations",
  messages: "crewlink-messages",
  userConversations: "crewlink-user-conversations",
} as const;

export type DynamoDbTableKey = keyof typeof DYNAMODB_TABLE_NAMES;

/** CloudFormation logical id suffix used to find legacy retained tables. */
export const LEGACY_TABLE_LOGICAL_SUFFIXES: Record<DynamoDbTableKey, string> = {
  users: "Users0A0EEA89",
  pilotProfiles: "PilotProfiles4C888116",
  operatorProfiles: "OperatorProfilesAC6C89C2",
  staffingRequests: "StaffingRequestsE71304E9",
  matches: "MatchesBB86CD35",
  availability: "Availability367DB12B",
  locations: "Locations439EEF50",
  contactLeads: "ContactLeadsAC27590C",
  conversations: "ConversationsBC91B70D",
  messages: "Messages804FA4EB",
  userConversations: "UserConversations3BFD704F",
};
