import "@microsoft/typespec-m365-copilot";
import "./prompts/instructions.tsp";

using TypeSpec.M365.Copilot.Agents;

@agent("Org Document Search", "Search OneDrive and SharePoint for documents available to you. Find relevant files using natural language, multilingual terminology, document content, metadata, authors, collaborators, projects, and organizations. Discover documents even when their filenames or language differ from your search terms.")
@instructions(Prompts.INSTRUCTIONS)
@behaviorOverrides(#{ discourageModelKnowledge: true })
@conversationStarter(#{ title: "Product requirements", text: "Find product requirements and feature specifications." })
@conversationStarter(#{ title: "Project plans", text: "Find project plans, milestones, and deliverables." })
@conversationStarter(#{ title: "Architecture", text: "Find technical architecture documents and design decisions." })
@conversationStarter(#{ title: "Product changes", text: "Find documents about product changes, improvements, and known issues." })
@conversationStarter(#{ title: "Decisions across languages", text: "Find project discussions and decisions, even when the documents use different terminology or languages." })
@conversationStarter(#{ title: "חיפוש מסמכים", text: "מצא מסמכים על דרישות מוצר, תכנון פיתוח והחלטות טכניות, גם אם הם כתובים באנגלית." })
namespace OrgDocumentSearch {
  op documents is AgentCapabilities.OneDriveAndSharePoint;
}
