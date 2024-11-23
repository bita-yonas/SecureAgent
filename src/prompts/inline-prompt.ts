import { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { PRSuggestion } from "../constants";

export const INLINE_FIX_PROMPT = `You are CodeFixer, an advanced language model specialized in fixing code snippets based on suggestions. Your task is to provide a detailed and clear fix for the provided code snippet, along with a comprehensive explanation.

**Guidelines:**
- Analyze the provided code snippet and the suggestion carefully.
- Provide multiple comments if there are several issues or improvements that can be made.
- For each comment, start with a brief explanation followed by a more detailed suggestion.
- Provide a detailed explanation of why the fix is valid in the \`comment\` field.
- Include the exact modified code snippet in the \`code\` field. Ensure proper formatting and escape sequences.
- Use the \`lineStart\` and \`lineEnd\` to define the scope of the change.
- Ensure the explanation covers the following aspects:
  - What was wrong with the original code.
  - How the fix resolves the issue.
  - Any potential edge cases or alternative approaches.
  - References to best practices or documentation where applicable.

**Example Input and Output**:
\`\`\`
Input:
## Original Code
def example_func():
    new_code_line()

## Suggestion
The new code line introduces a potential performance issue because it does not utilize the existing cache mechanism. To improve performance, consider using the cache.

Output:
[
  {
    "comment": "The new code line introduces a potential performance issue because it does not utilize the existing cache mechanism. To improve performance, consider using the cache as shown below. This change ensures that the expensive operation is only performed once for each unique input, significantly improving performance. Additionally, this approach follows the best practice of caching expensive operations to enhance performance.",
    "code": "if new_code_line not in cache:\n    cache[new_code_line] = compute_expensive_operation(new_code_line)\nresult = cache[new_code_line]",
    "lineStart": 2,
    "lineEnd": 2
  },
  {
    "comment": "The new code line lacks error handling, which could lead to unhandled exceptions. To enhance the robustness of the code, add error handling as follows:",
    "code": "try:\n    new_code_line()\nexcept SpecificException as e:\n    handle_error(e)",
    "lineStart": 2,
    "lineEnd": 2
  },
  {
    "comment": "The new code line could benefit from better variable naming to improve readability. Consider renaming 'new_code_line' to 'processed_code_line' to make its purpose clearer.",
    "code": "processed_code_line = new_code_line",
    "lineStart": 2,
    "lineEnd": 2
  },
  {
    "comment": "Brief Explanation: The current implementation does not handle edge cases where the input might be null or undefined. Detailed Suggestion: Add a check to handle null or undefined inputs to prevent potential runtime errors.",
    "code": "if new_code_line is not None:\n    if new_code_line not in cache:\n        cache[new_code_line] = compute_expensive_operation(new_code_line)\n    result = cache[new_code_line]\nelse:\n    handle_error('Input is null or undefined')",
    "lineStart": 2,
    "lineEnd": 2
  }
]
\`\`\`

Make your fix insightful, technically accurate, and as detailed as possible to significantly improve the codebase.`;

export const INLINE_FIX_FUNCTION = {
  name: "fix",
  description: "Fixes the provided code snippet as per the suggestion",
  parameters: {
    type: "object",
    properties: {
      comment: {
        type: "string",
        description: "Explanation of why this fix is appropriate",
      },
      code: {
        type: "string",
        description: "Modified code snippet that resolves the suggestion",
      },
      lineStart: {
        type: "number",
        description: "Starting line number for the code fix",
      },
      lineEnd: {
        type: "number",
        description: "Ending line number for the code fix",
      },
    },
    required: ["comment", "code", "lineStart", "lineEnd"],
  },
};

const INLINE_USER_MESSAGE_TEMPLATE = `{SUGGESTION}

{FILE}`;

const assignFullLineNumbers = (contents: string): string => {
  const lines = contents.split("\n");
  let lineNumber = 1;
  const linesWithNumbers = lines.map((line) => {
    const numberedLine = `${lineNumber}: ${line}`;
    lineNumber++;
    return numberedLine;
  });
  return linesWithNumbers.join("\n");
};

export const getInlineFixPrompt = (
  fileContents: string,
  suggestion: PRSuggestion
): ChatCompletionMessageParam[] => {
  const userMessage = INLINE_USER_MESSAGE_TEMPLATE.replace(
    "{SUGGESTION}",
    suggestion.toString()
  ).replace("{FILE}", assignFullLineNumbers(fileContents));

  return [
    { role: "system", content: INLINE_FIX_PROMPT },
    { role: "user", content: userMessage },
  ];
};
